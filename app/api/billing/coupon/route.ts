import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { requireAuth, AuthError } from "@/lib/org-auth";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/coupon
 * Apply a Stripe promotional code to the org's active subscription.
 */
export const POST = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireAuth();
    const { code } = await req.json() as { code: string };

    if (!code?.trim()) {
      return NextResponse.json({ error: "Coupon code is required" }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith("placeholder")) {
      return NextResponse.json({ error: "Billing is not configured yet" }, { status: 503 });
    }

    const db = getAdminClient();
    const { data: org } = await db
      .from("organizations")
      .select("stripe_customer_id, stripe_subscription_id, subscription_status")
      .eq("id", auth.orgId)
      .single();

    if (!org?.stripe_subscription_id) {
      return NextResponse.json({ error: "No active subscription found. Please upgrade first." }, { status: 404 });
    }

    const stripe = getStripe();

    // Look up the promotion code
    const promoCodes = await stripe.promotionCodes.list({ code: code.trim(), limit: 1, active: true });
    if (!promoCodes.data.length) {
      return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 404 });
    }

    const promoCode = promoCodes.data[0];

    // Apply to subscription
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      discounts: [{ promotion_code: promoCode.id }],
    });

    logger.info({ orgId: auth.orgId, code }, "billing: coupon applied");
    return NextResponse.json({ message: "Coupon applied successfully! Your next invoice will reflect the discount." });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    const msg = err instanceof Error ? err.message : "Failed to apply coupon";
    // Stripe errors have a message we can surface
    if (msg.includes("No such promotion code") || msg.includes("Invalid promotion")) {
      return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 404 });
    }
    logger.error({ err }, "POST /api/billing/coupon error");
    return NextResponse.json({ error: "Failed to apply coupon. Please try again." }, { status: 500 });
  }
});
