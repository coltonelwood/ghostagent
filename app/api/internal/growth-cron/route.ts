import { NextRequest, NextResponse } from "next/server";
import { verifyInternalKey, verifyCronSecret } from "@/lib/internal-auth";
import { processTrialExpiries } from "@/lib/growth-engine";
import { processEmailQueue } from "@/lib/email-sequences";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Internal growth automation cron job. Runs daily to:
 * 1. Process trial expiries (mark expired, queue emails)
 * 2. Send queued lifecycle emails (trial reminders, onboarding nudges)
 *
 * Called by Vercel cron (GET with CRON_SECRET) or internal service
 * (POST with INTERNAL_API_KEY).
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return handleGrowthCron();
}

export async function POST(req: NextRequest) {
  if (!verifyInternalKey(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return handleGrowthCron();
}

async function handleGrowthCron() {
  apiLogger.info("growth-cron: starting");

  const [trialResults, emailResults] = await Promise.all([
    processTrialExpiries().catch((err) => {
      apiLogger.error({ err }, "growth-cron: trial processing failed");
      return { expiring: 0, expired: 0, emails_queued: 0, error: true };
    }),
    processEmailQueue().catch((err) => {
      apiLogger.error({ err }, "growth-cron: email processing failed");
      return { sent: 0, errors: 0, error: true };
    }),
  ]);

  const result = {
    trials: trialResults,
    emails: emailResults,
    completedAt: new Date().toISOString(),
  };

  apiLogger.info(result, "growth-cron: completed");
  return NextResponse.json(result);
}
