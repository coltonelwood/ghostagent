import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/org-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/portal
 * Opens a Stripe billing portal session for the caller's organization.
 */
export async function POST() {
  try {
    const auth = await requireAuth();

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith("placeholder")) {
      return NextResponse.json({ error: "Billing is not configured yet" }, { status: 503 });
    }

    const db = getAdminClient();
    const { data: org } = await db
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", auth.orgId)
      .single();

    if (!org?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found yet. Upgrade to a paid plan first." },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/platform/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    logger.error({ err }, "POST /api/billing/portal error");
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
