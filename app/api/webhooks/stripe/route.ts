import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/admin";
import { stripeLogger } from "@/lib/logger";
import Stripe from "stripe";

export const runtime = "nodejs";
// Stripe needs raw body for signature verification — disable auto body parsing
export const dynamic = "force-dynamic";

// In-memory idempotency cache (prevents duplicate processing on webhook retries)
// Replace with Redis SET NX in high-scale production
const processedEvents = new Set<string>();

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
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    stripeLogger.warn({ message }, "webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: skip if already processed
  if (processedEvents.has(event.id)) {
    stripeLogger.info({ eventId: event.id, type: event.type }, "webhook: duplicate, skipping");
    return NextResponse.json({ received: true });
  }

  stripeLogger.info({ eventId: event.id, type: event.type }, "webhook: processing");

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!session.metadata?.workspace_id) {
          stripeLogger.warn({ sessionId: session.id }, "checkout.session.completed: no workspace_id in metadata");
          break;
        }

        const { error } = await adminClient
          .from("workspaces")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_sub_id: session.subscription as string,
            plan: "pro",
          })
          .eq("id", session.metadata.workspace_id);

        if (error) {
          stripeLogger.error({ error, workspaceId: session.metadata.workspace_id }, "failed to upgrade workspace");
          // Return 500 so Stripe retries
          return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        stripeLogger.info({ workspaceId: session.metadata.workspace_id }, "workspace upgraded to pro");
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { error } = await adminClient
          .from("workspaces")
          .update({ plan: "trial", stripe_sub_id: null })
          .eq("stripe_customer_id", sub.customer as string);

        if (error) {
          stripeLogger.error({ error, customer: sub.customer }, "failed to downgrade workspace");
          return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        stripeLogger.info({ customer: sub.customer }, "workspace downgraded to trial");
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const plan = sub.status === "active" ? "pro" : "trial";
        await adminClient
          .from("workspaces")
          .update({ plan })
          .eq("stripe_customer_id", sub.customer as string);

        stripeLogger.info({ customer: sub.customer, plan, status: sub.status }, "subscription updated");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        stripeLogger.warn(
          { customer: invoice.customer, invoiceId: invoice.id, attemptCount: invoice.attempt_count },
          "payment failed"
        );
        // Could send an email here via Resend
        break;
      }

      default:
        stripeLogger.info({ type: event.type }, "webhook: unhandled event type");
    }

    // Mark as processed after successful handling
    processedEvents.add(event.id);
    // Cap cache size to prevent memory leak
    if (processedEvents.size > 10_000) {
      const first = processedEvents.values().next().value;
      if (first) processedEvents.delete(first);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stripeLogger.error({ eventId: event.id, type: event.type, message }, "webhook handler threw");
    // Return 500 so Stripe retries
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}
