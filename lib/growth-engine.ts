import { adminClient } from "./supabase/admin";
import { logger } from "./logger";

// ============================================================================
// Growth Automation Engine
// ============================================================================
//
// Automates the full lead lifecycle: scoring, trial management, upsell
// triggers, and conversion tracking. Designed to run the business at 95%
// automation with ~5% human touch for enterprise deals.
// ============================================================================

// ---- Lead Scoring ----

interface LeadSignal {
  signal: string;
  points: number;
  timestamp: string;
}

const SIGNAL_POINTS: Record<string, number> = {
  signup_completed: 5,
  org_created: 5,
  connector_added: 15,
  first_sync_started: 10,
  first_sync_completed: 10,
  first_assets_discovered: 15,
  team_invited: 10,
  onboarding_completed: 10,
  first_compliance_report_viewed: 10,
  first_policy_created: 10,
  demo_viewed: 5,
  // Usage milestones
  assets_25: 5,
  assets_100: 10,
  assets_250: 15,
  connectors_2: 5,
  connectors_3: 10,
  first_violation_resolved: 10,
  team_size_3: 5,
  daily_active_3_days: 10,
  daily_active_7_days: 15,
};

function computeGrade(score: number): "cold" | "warm" | "hot" | "on_fire" {
  if (score >= 80) return "on_fire";
  if (score >= 50) return "hot";
  if (score >= 25) return "warm";
  return "cold";
}

/**
 * Record an onboarding event and update the org's lead score.
 */
export async function trackOnboardingEvent(
  orgId: string,
  userId: string,
  event: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  // Insert the event
  const { error: eventError } = await adminClient
    .from("onboarding_events")
    .insert({ org_id: orgId, user_id: userId, event, metadata });

  if (eventError) {
    logger.error({ eventError, orgId, event }, "growth: failed to track onboarding event");
    return;
  }

  // Update lead score
  await updateLeadScore(orgId, event);
}

/**
 * Update the lead score for an org based on a new signal.
 */
export async function updateLeadScore(orgId: string, signal: string): Promise<void> {
  const points = SIGNAL_POINTS[signal] ?? 0;
  if (points === 0) return;

  const newSignal: LeadSignal = {
    signal,
    points,
    timestamp: new Date().toISOString(),
  };

  // Get existing score or create new
  const { data: existing } = await adminClient
    .from("lead_scores")
    .select("*")
    .eq("org_id", orgId)
    .single();

  if (existing) {
    const signals = [...(existing.signals as LeadSignal[]), newSignal];
    const newScore = Math.min(100, (existing.score as number) + points);
    const grade = computeGrade(newScore);

    await adminClient
      .from("lead_scores")
      .update({
        score: newScore,
        grade,
        signals,
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);
  } else {
    const score = Math.min(100, points);
    await adminClient
      .from("lead_scores")
      .insert({
        org_id: orgId,
        score,
        grade: computeGrade(score),
        signals: [newSignal],
      });
  }
}

// ---- Trial Lifecycle ----

/**
 * Initialize a trial for a new org. Sets trial_ends_at to 14 days from now.
 */
export async function initializeTrial(orgId: string): Promise<void> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  await adminClient
    .from("organizations")
    .update({
      trial_ends_at: trialEnd.toISOString(),
      conversion_status: "trial",
    })
    .eq("id", orgId);

  logger.info({ orgId, trialEnd: trialEnd.toISOString() }, "growth: trial initialized");
}

/**
 * Get the trial status for an org.
 */
export async function getTrialStatus(orgId: string): Promise<{
  isTrialing: boolean;
  daysRemaining: number;
  trialEndsAt: string | null;
  hasActiveSubscription: boolean;
}> {
  const { data: org } = await adminClient
    .from("organizations")
    .select("trial_ends_at, stripe_subscription_status, conversion_status")
    .eq("id", orgId)
    .single();

  if (!org) {
    return { isTrialing: false, daysRemaining: 0, trialEndsAt: null, hasActiveSubscription: false };
  }

  const hasActiveSubscription = org.stripe_subscription_status === "active";
  const trialEndsAt = org.trial_ends_at as string | null;

  if (!trialEndsAt) {
    return { isTrialing: false, daysRemaining: 0, trialEndsAt: null, hasActiveSubscription };
  }

  const now = new Date();
  const end = new Date(trialEndsAt);
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isTrialing = daysRemaining > 0 && !hasActiveSubscription;

  return { isTrialing, daysRemaining, trialEndsAt, hasActiveSubscription };
}

// ---- Usage Milestones ----

/**
 * Check and record usage milestones for an org. Called after syncs complete.
 */
export async function checkUsageMilestones(orgId: string): Promise<string[]> {
  const newMilestones: string[] = [];

  // Get current usage stats
  const [assetsResult, connectorsResult, membersResult, policiesResult, complianceResult] = await Promise.all([
    adminClient.from("assets").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    adminClient.from("connectors").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    adminClient.from("org_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    adminClient.from("policies").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    adminClient.from("compliance_mappings").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  const assetCount = assetsResult.count ?? 0;
  const connectorCount = connectorsResult.count ?? 0;
  const memberCount = membersResult.count ?? 0;
  const policyCount = policiesResult.count ?? 0;
  const complianceCount = complianceResult.count ?? 0;

  // Define thresholds
  const checks: Array<{ milestone: string; met: boolean }> = [
    { milestone: "assets_25", met: assetCount >= 25 },
    { milestone: "assets_100", met: assetCount >= 100 },
    { milestone: "assets_250", met: assetCount >= 250 },
    { milestone: "assets_500", met: assetCount >= 500 },
    { milestone: "connectors_2", met: connectorCount >= 2 },
    { milestone: "connectors_3", met: connectorCount >= 3 },
    { milestone: "connectors_5", met: connectorCount >= 5 },
    { milestone: "first_policy", met: policyCount >= 1 },
    { milestone: "first_compliance_report", met: complianceCount >= 1 },
    { milestone: "team_size_3", met: memberCount >= 3 },
    { milestone: "team_size_5", met: memberCount >= 5 },
  ];

  for (const check of checks) {
    if (!check.met) continue;

    // Upsert — the unique index prevents duplicates
    const { error } = await adminClient
      .from("usage_milestones")
      .upsert(
        {
          org_id: orgId,
          milestone: check.milestone,
          metadata: { assetCount, connectorCount, memberCount, policyCount, complianceCount },
        },
        { onConflict: "org_id,milestone", ignoreDuplicates: true },
      );

    if (!error) {
      newMilestones.push(check.milestone);
      await updateLeadScore(orgId, check.milestone);
    }
  }

  if (newMilestones.length > 0) {
    logger.info({ orgId, newMilestones }, "growth: new usage milestones reached");
  }

  return newMilestones;
}

// ---- Upgrade Prompt Logic ----

export interface UpgradePrompt {
  show: boolean;
  reason: string;
  urgency: "low" | "medium" | "high";
  suggestedPlan: "professional" | "enterprise";
  message: string;
}

/**
 * Determine if and what upgrade prompt to show a user.
 */
export async function getUpgradePrompt(orgId: string): Promise<UpgradePrompt> {
  const noPrompt: UpgradePrompt = {
    show: false,
    reason: "",
    urgency: "low",
    suggestedPlan: "professional",
    message: "",
  };

  const { data: org } = await adminClient
    .from("organizations")
    .select("plan, trial_ends_at, max_assets, max_connectors, stripe_subscription_status")
    .eq("id", orgId)
    .single();

  if (!org || org.plan !== "starter") return noPrompt;
  if (org.stripe_subscription_status === "active") return noPrompt;

  // Check usage against limits
  const [assetsResult, connectorsResult] = await Promise.all([
    adminClient.from("assets").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    adminClient.from("connectors").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
  ]);

  const assetCount = assetsResult.count ?? 0;
  const connectorCount = connectorsResult.count ?? 0;
  const maxAssets = (org.max_assets as number) || 500;
  const maxConnectors = (org.max_connectors as number) || 3;

  const assetUsagePercent = (assetCount / maxAssets) * 100;
  const connectorUsagePercent = (connectorCount / maxConnectors) * 100;

  // Trial expiring soon
  if (org.trial_ends_at) {
    const daysLeft = Math.ceil(
      (new Date(org.trial_ends_at as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (daysLeft <= 3 && daysLeft > 0) {
      return {
        show: true,
        reason: "trial_expiring",
        urgency: "high",
        suggestedPlan: "professional",
        message: `Your trial expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Upgrade to keep your AI inventory and compliance reports.`,
      };
    }
  }

  // Hitting asset limits
  if (assetUsagePercent >= 80) {
    return {
      show: true,
      reason: "asset_limit",
      urgency: assetUsagePercent >= 95 ? "high" : "medium",
      suggestedPlan: "professional",
      message: `You've discovered ${assetCount} of ${maxAssets} AI assets. Upgrade to Professional for unlimited assets and all 4 compliance frameworks.`,
    };
  }

  // Hitting connector limits
  if (connectorUsagePercent >= 100) {
    return {
      show: true,
      reason: "connector_limit",
      urgency: "medium",
      suggestedPlan: "professional",
      message: `You've connected ${connectorCount} of ${maxConnectors} sources. Upgrade to Professional for unlimited connectors.`,
    };
  }

  return noPrompt;
}

// ---- Automated Growth Tasks (called by cron) ----

/**
 * Process all orgs with expiring trials and trigger appropriate actions.
 */
export async function processTrialExpiries(): Promise<{
  expiring: number;
  expired: number;
  emails_queued: number;
}> {
  const now = new Date();
  const results = { expiring: 0, expired: 0, emails_queued: 0 };

  // Find orgs where trial is expiring in the next 3 days
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: expiringOrgs } = await adminClient
    .from("organizations")
    .select("id, name, trial_ends_at")
    .eq("conversion_status", "trial")
    .gt("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", threeDaysFromNow.toISOString());

  for (const org of expiringOrgs ?? []) {
    results.expiring++;

    // Check if we already sent an expiring email
    const { data: existing } = await adminClient
      .from("email_sequences")
      .select("id")
      .eq("org_id", org.id)
      .eq("sequence", "trial_expiring")
      .limit(1);

    if (!existing?.length) {
      // Queue the trial_expiring email (actual send happens in email-sequences.ts)
      const { data: owner } = await adminClient
        .from("org_members")
        .select("user_id")
        .eq("org_id", org.id)
        .eq("role", "owner")
        .limit(1)
        .single();

      if (owner) {
        const { data: user } = await adminClient.auth.admin.getUserById(owner.user_id);
        if (user?.user?.email) {
          await adminClient.from("email_sequences").insert({
            org_id: org.id,
            user_email: user.user.email,
            sequence: "trial_expiring",
            metadata: { org_name: org.name, trial_ends_at: org.trial_ends_at },
          });
          results.emails_queued++;
        }
      }
    }
  }

  // Find orgs where trial has expired
  const { data: expiredOrgs } = await adminClient
    .from("organizations")
    .select("id")
    .eq("conversion_status", "trial")
    .lt("trial_ends_at", now.toISOString())
    .is("stripe_subscription_status", null);

  for (const org of expiredOrgs ?? []) {
    results.expired++;

    await adminClient
      .from("organizations")
      .update({ conversion_status: "expired" })
      .eq("id", org.id);

    // Check if we already sent an expired email
    const { data: existing } = await adminClient
      .from("email_sequences")
      .select("id")
      .eq("org_id", org.id)
      .eq("sequence", "trial_expired")
      .limit(1);

    if (!existing?.length) {
      const { data: owner } = await adminClient
        .from("org_members")
        .select("user_id")
        .eq("org_id", org.id)
        .eq("role", "owner")
        .limit(1)
        .single();

      if (owner) {
        const { data: user } = await adminClient.auth.admin.getUserById(owner.user_id);
        if (user?.user?.email) {
          await adminClient.from("email_sequences").insert({
            org_id: org.id,
            user_email: user.user.email,
            sequence: "trial_expired",
            metadata: { org_name: org.id },
          });
          results.emails_queued++;
        }
      }
    }
  }

  logger.info(results, "growth: processed trial expiries");
  return results;
}

/**
 * Score all active trial orgs and identify hot leads for sales outreach.
 */
export async function identifyHotLeads(): Promise<Array<{
  orgId: string;
  orgName: string;
  score: number;
  grade: string;
  ownerEmail: string;
}>> {
  const { data: hotLeads } = await adminClient
    .from("lead_scores")
    .select("org_id, score, grade")
    .in("grade", ["hot", "on_fire"])
    .order("score", { ascending: false })
    .limit(50);

  if (!hotLeads?.length) return [];

  const results = [];
  for (const lead of hotLeads) {
    const { data: org } = await adminClient
      .from("organizations")
      .select("name, conversion_status")
      .eq("id", lead.org_id)
      .single();

    if (!org || org.conversion_status !== "trial") continue;

    const { data: owner } = await adminClient
      .from("org_members")
      .select("user_id")
      .eq("org_id", lead.org_id)
      .eq("role", "owner")
      .limit(1)
      .single();

    if (!owner) continue;

    const { data: user } = await adminClient.auth.admin.getUserById(owner.user_id);

    results.push({
      orgId: lead.org_id,
      orgName: org.name as string,
      score: lead.score as number,
      grade: lead.grade as string,
      ownerEmail: user?.user?.email ?? "unknown",
    });
  }

  return results;
}
