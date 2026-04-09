import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { workspace_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { workspace_id } = body;
  if (!workspace_id || typeof workspace_id !== "string") {
    return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, plan, stripe_customer_id")
    .eq("id", workspace_id)
    .eq("owner_id", user.id) // ownership check
    .single();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (workspace.plan === "pro") {
    return NextResponse.json({ error: "Already on Pro plan" }, { status: 400 });
  }

  if (!process.env.STRIPE_PRO_PRICE_ID) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 500 });
  }

  try {
    // Reuse existing customer or create new one
    let customerId = workspace.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { workspace_id, user_id: user.id },
      });
      customerId = customer.id;
      await adminClient
        .from("workspaces")
        .update({ stripe_customer_id: customerId })
        .eq("id", workspace_id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
      allow_promotion_codes: true,
      metadata: { workspace_id, user_id: user.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Billing error";
    console.error("[billing/checkout]", message);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
