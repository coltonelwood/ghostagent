import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/org-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout
 * Creates (or reuses) a Stripe customer for the caller's organization and
 * returns a Checkout Session URL for upgrading to the Pro plan.
 */
export async function POST() {
  try {
    const auth = await requireAuth();

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith("placeholder")) {
      return NextResponse.json({ error: "Billing is not configured yet" }, { status: 503 });
    }

    if (!process.env.STRIPE_PRO_PRICE_ID) {
      return NextResponse.json({ error: "Billing is not configured yet" }, { status: 503 });
    }

    const db = getAdminClient();
    const { data: org } = await db
      .from("organizations")
      .select("id, plan, stripe_customer_id")
      .eq("id", auth.orgId)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org.plan === "professional" || org.plan === "enterprise") {
      return NextResponse.json({ error: "You're already on a paid plan" }, { status: 400 });
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Reuse existing customer or create a new one
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.email,
        metadata: { org_id: auth.orgId, user_id: auth.userId },
      });
      customerId = customer.id;
      await db
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", auth.orgId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: `${appUrl}/platform?upgraded=true`,
      cancel_url: `${appUrl}/platform/settings/billing`,
      allow_promotion_codes: true,
      metadata: { org_id: auth.orgId, user_id: auth.userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error({ err }, "POST /api/billing/checkout error");
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
