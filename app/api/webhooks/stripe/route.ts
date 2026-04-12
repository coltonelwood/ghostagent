import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/admin";
import { stripeLogger } from "@/lib/logger";
import Stripe from "stripe";

export const runtime = "nodejs";
// Stripe needs raw body for signature verification — disable auto body parsing
export const dynamic = "force-dynamic";

/**
 * Stripe webhook handler — idempotent, signature-verified, and writes
 * to BOTH legacy `workspaces` and current `organizations` rows so the
 * older single-workspace flow and the multi-connector Nexus org flow
 * stay consistent no matter which surface the customer went through.
 *
 * On any DB failure we return 5xx so Stripe retries. On signature or
 * idempotency-hit we return 2xx so Stripe stops retrying.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    stripeLogger.warn("webhook received without stripe-signature header");
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    stripeLogger.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    stripeLogger.warn({ message }, "webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Persistent idempotency check — DB survives restarts and cold starts.
  const { data: existing } = await adminClient
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    stripeLogger.info(
      { eventId: event.id, type: event.type },
      "webhook: duplicate, skipping",
    );
    return NextResponse.json({ received: true });
  }

  stripeLogger.info(
    { eventId: event.id, type: event.type },
    "webhook: processing",
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id ?? null;
        const workspaceId = session.metadata?.workspace_id ?? null;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        if (!orgId && !workspaceId) {
          stripeLogger.warn(
            { sessionId: session.id },
            "checkout.session.completed: no org_id or workspace_id in metadata",
          );
          // 200 so Stripe stops retrying — we can't recover from missing metadata.
          break;
        }

        if (orgId) {
          const { error } = await adminClient
            .from("organizations")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: "professional",
              subscription_status: "active",
            })
            .eq("id", orgId);
          if (error) {
            stripeLogger.error(
              { error, orgId },
              "failed to upgrade organization — will retry",
            );
            return NextResponse.json(
              { error: "Database error" },
              { status: 500 },
            );
          }
          stripeLogger.info({ orgId }, "organization upgraded to professional");
        }

        if (workspaceId) {
          const { error } = await adminClient
            .from("workspaces")
            .update({
              stripe_customer_id: customerId,
              stripe_sub_id: subscriptionId,
              plan: "pro",
            })
            .eq("id", workspaceId);
          if (error) {
            stripeLogger.error(
              { error, workspaceId },
              "failed to upgrade workspace — will retry",
            );
            return NextResponse.json(
              { error: "Database error" },
              { status: 500 },
            );
          }
          stripeLogger.info({ workspaceId }, "workspace upgraded to pro");
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const plan = sub.status === "active" ? "professional" : "starter";
        const legacyPlan = sub.status === "active" ? "pro" : "trial";

        const orgRes = await adminClient
          .from("organizations")
          .update({
            plan,
            subscription_status: sub.status,
            stripe_subscription_id: sub.id,
          })
          .eq("stripe_customer_id", customerId);
        if (orgRes.error) {
          stripeLogger.error(
            { error: orgRes.error, customerId },
            "failed to update organization subscription — will retry",
          );
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        const wsRes = await adminClient
          .from("workspaces")
          .update({ plan: legacyPlan })
          .eq("stripe_customer_id", customerId);
        if (wsRes.error) {
          stripeLogger.error(
            { error: wsRes.error, customerId },
            "failed to update workspace subscription — will retry",
          );
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        stripeLogger.info(
          { customerId, plan, status: sub.status },
          "subscription updated",
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const orgRes = await adminClient
          .from("organizations")
          .update({
            plan: "starter",
            subscription_status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("stripe_customer_id", customerId);
        if (orgRes.error) {
          stripeLogger.error(
            { error: orgRes.error, customerId },
            "failed to downgrade organization — will retry",
          );
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        const wsRes = await adminClient
          .from("workspaces")
          .update({ plan: "trial", stripe_sub_id: null })
          .eq("stripe_customer_id", customerId);
        if (wsRes.error) {
          stripeLogger.error(
            { error: wsRes.error, customerId },
            "failed to downgrade workspace — will retry",
          );
          return NextResponse.json(
            { error: "Database error" },
            { status: 500 },
          );
        }

        stripeLogger.info({ customerId }, "subscription canceled");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        stripeLogger.warn(
          {
            customer: invoice.customer,
            invoiceId: invoice.id,
            attemptCount: invoice.attempt_count,
          },
          "payment failed",
        );
        // Surface to the user's dashboard via an event — non-blocking.
        // A dedicated mailer should also run here (future work).
        break;
      }

      default:
        stripeLogger.info({ type: event.type }, "webhook: unhandled event type");
    }

    // Record that we successfully processed this event so a retry from
    // Stripe becomes a no-op. Done LAST so any error above skips this
    // insert and Stripe retries the whole event.
    const obj = event.data.object as {
      metadata?: { workspace_id?: string; org_id?: string };
    };
    const workspaceIdForIdx = obj?.metadata?.workspace_id ?? null;
    await adminClient.from("stripe_events").upsert(
      {
        id: event.id,
        type: event.type,
        workspace_id: workspaceIdForIdx,
        processed_at: new Date().toISOString(),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stripeLogger.error(
      { eventId: event.id, type: event.type, message },
      "webhook handler threw",
    );
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}
