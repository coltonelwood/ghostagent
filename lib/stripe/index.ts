import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

// Lazy proxy for backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const PLANS = {
  trial: { name: "Trial", scans: 1, agents: 25, price: 0 },
  pro: { name: "Pro", scans: -1, agents: -1, price: 399 },
  enterprise: { name: "Enterprise", scans: -1, agents: -1, price: 999 },
} as const;

export function canRunScan(plan: string, scanCount: number): boolean {
  if (plan === "pro" || plan === "enterprise") return true;
  if (plan === "trial" && scanCount < PLANS.trial.scans) return true;
  return false;
}
