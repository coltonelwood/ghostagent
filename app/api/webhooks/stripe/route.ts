import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.workspace_id) {
        await adminClient
          .from("workspaces")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_sub_id: session.subscription as string,
            plan: "pro",
          })
          .eq("id", session.metadata.workspace_id);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await adminClient
        .from("workspaces")
        .update({ plan: "trial", stripe_sub_id: null })
        .eq("stripe_customer_id", sub.customer as string);
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const plan = sub.status === "active" ? "pro" : "trial";
      await adminClient
        .from("workspaces")
        .update({ plan })
        .eq("stripe_customer_id", sub.customer as string);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
