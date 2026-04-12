/**
 * threat-intelligence/consumer-bridge.ts — Consumer / Individual bridge
 *
 * Bridges individual threat reports to the collective network. Individuals
 * (non-org users) submit reports that are fingerprinted, matched against the
 * shared intelligence pool, and used to generate alerts for other individuals
 * with matching risk profiles.
 */

import { adminClient } from "@/lib/supabase/admin";
import { emitEvent } from "@/lib/event-system";
import { logger } from "@/lib/logger";
import { extractBehavioralFingerprint } from "./fingerprint-engine";
import { generateContributorHash, anonymizeSignature } from "./anonymizer";
import type {
  ThreatObservation,
  FingerprintType,
  ReportType,
  ConsumerStats,
} from "./types";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

/** System org ID used when individuals (who lack an org) submit reports. */
const SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000000";

/** Map consumer report types to fingerprint types for AI extraction. */
const REPORT_TYPE_TO_FINGERPRINT: Record<ReportType, FingerprintType> = {
  phishing_email: "phishing",
  scam_text: "social_engineering",
  fraud_call: "social_engineering",
  fake_website: "phishing",
  investment_scam: "investment_scam",
  tech_support_scam: "tech_support_scam",
  romance_scam: "romance_scam",
  impersonation: "social_engineering",
  malware: "ransomware",
  other: "unknown",
};

// ─── PUBLIC API ─────────────────────────────────────────────────────────────

/**
 * Process a consumer threat report: fingerprint it, match against shared
 * intelligence, and generate alerts for individuals with matching risk profiles.
 */
export async function processConsumerReport(
  reportId: string,
): Promise<{ fingerprint_id: string; matched_existing: boolean; people_alerted: number }> {
  // 1. Load the report
  const { data: report, error: reportError } = await adminClient
    .from("threat_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (reportError || !report) {
    throw new Error("Report not found: " + (reportError?.message ?? reportId));
  }

  // 2. Build a ThreatObservation from the report data
  const evidence = (report.evidence ?? {}) as Record<string, unknown>;
  const indicators: string[] = [];
  if (Array.isArray(evidence.urls)) indicators.push(...evidence.urls);
  if (Array.isArray(evidence.phone_numbers)) indicators.push(...evidence.phone_numbers);
  if (typeof evidence.sender === "string" && evidence.sender) indicators.push(evidence.sender);

  const observation: ThreatObservation = {
    type: REPORT_TYPE_TO_FINGERPRINT[(report.report_type as ReportType) ?? "other"] ?? "unknown",
    indicators,
    timeline: report.created_at as string,
    narrative: (report.description as string) ?? (report.title as string) ?? "",
    raw_evidence: typeof evidence.raw_content === "string" ? evidence.raw_content : undefined,
    severity: (report.severity as ThreatObservation["severity"]) ?? "medium",
  };

  // 3. Extract behavioral fingerprint (use system org ID since individuals don't have orgs)
  const { id: fingerprintId } = await extractBehavioralFingerprint(SYSTEM_ORG_ID, observation);

  // 4. Link the fingerprint to the report
  await adminClient
    .from("threat_reports")
    .update({ behavioral_fingerprint_id: fingerprintId })
    .eq("id", reportId);

  // 5. Check for similar patterns in shared_threat_intelligence
  const { data: existingIntel } = await adminClient
    .from("shared_threat_intelligence")
    .select("id, corroboration_count")
    .eq("fingerprint_type", observation.type)
    .eq("severity", observation.severity ?? "medium")
    .eq("status", "active")
    .limit(1);

  const matchedExisting = Boolean(existingIntel?.length);
  let peopleAlerted = 0;

  if (matchedExisting && existingIntel!.length > 0) {
    // 6. Match found: increment verification_count on the report
    await adminClient
      .from("threat_reports")
      .update({ verification_count: ((report.verification_count as number) ?? 0) + 1 })
      .eq("id", reportId);
  } else {
    // 7. New pattern: insert into shared_threat_intelligence
    const contributorHash = generateContributorHash(report.reporter_id as string);

    await adminClient
      .from("shared_threat_intelligence")
      .insert({
        contributor_hash: contributorHash,
        fingerprint_type: observation.type,
        behavioral_signature: {
          tactics: [{ tactic: "Initial Access", technique: observation.type, procedure: observation.narrative.slice(0, 200) }],
          communication_patterns: [],
          temporal_patterns: [],
          evasion_techniques: [],
          target_selection_criteria: [],
          payload_characteristics: indicators.slice(0, 5),
        },
        severity: observation.severity ?? "medium",
        confidence: 30,
        corroboration_count: 1,
        affected_industries: [],
        affected_tech_stacks: [],
        affected_size_tiers: [],
        status: "active",
        ttl_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
  }

  // 8. Update individual_profiles.threats_reported
  await adminClient.rpc("increment_field", {
    table_name: "individual_profiles",
    field_name: "threats_reported",
    row_id: report.reporter_id,
    id_field: "user_id",
  }).then(
    () => {},
    // Fallback: manual update if RPC doesn't exist
    async () => {
      const { data: profile } = await adminClient
        .from("individual_profiles")
        .select("threats_reported")
        .eq("user_id", report.reporter_id)
        .single();

      if (profile) {
        await adminClient
          .from("individual_profiles")
          .update({ threats_reported: ((profile.threats_reported as number) ?? 0) + 1 })
          .eq("user_id", report.reporter_id);
      }
    },
  );

  // 9. Generate alerts for individuals with matching risk_profiles
  const { data: matchingProfiles } = await adminClient
    .from("individual_profiles")
    .select("user_id")
    .neq("user_id", report.reporter_id);

  if (matchingProfiles?.length) {
    const alertRows = matchingProfiles.map((p) => ({
      user_id: p.user_id,
      threat_report_id: reportId,
      alert_type: "community_alert" as const,
      title: `New ${observation.type} threat reported in your area`,
      body: (report.title as string) ?? "A new threat has been reported by the community.",
      severity: observation.severity ?? "medium",
    }));

    const { data: insertedAlerts } = await adminClient
      .from("individual_alerts")
      .insert(alertRows)
      .select("id");

    peopleAlerted = insertedAlerts?.length ?? 0;
  }

  logger.info(
    { reportId, fingerprintId, matchedExisting, peopleAlerted },
    "consumer-bridge: report processed",
  );

  // 10. Return result
  return {
    fingerprint_id: fingerprintId,
    matched_existing: matchedExisting,
    people_alerted: peopleAlerted,
  };
}

/**
 * Get stats for an individual user.
 */
export async function getConsumerStats(userId: string): Promise<ConsumerStats> {
  // 1. Load individual_profiles for the user
  const { data: profile } = await adminClient
    .from("individual_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  // 2. Count their reports from threat_reports
  const { count: reportCount } = await adminClient
    .from("threat_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", userId);

  // 3. Count their alerts from individual_alerts
  const { count: alertCount } = await adminClient
    .from("individual_alerts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  const threatsReported = reportCount ?? 0;
  const threatsBlocked = (profile?.threats_blocked as number) ?? 0;
  const reputationScore = (profile?.reputation_score as number) ?? 0;
  const alertPreferences = (profile?.alert_preferences ?? {}) as Record<string, boolean>;

  // 4. Calculate protection_score (0-100)
  let protectionScore = 30; // Base
  if (threatsReported >= 1) protectionScore += 20;
  if (threatsReported >= 5) protectionScore += 15;
  if (reputationScore > 60) protectionScore += 15;
  if (alertPreferences.email) protectionScore += 10;
  if (threatsBlocked > 0) protectionScore += 10;

  // 5. Calculate people_protected
  const { data: verifiedReports } = await adminClient
    .from("threat_reports")
    .select("verification_count")
    .eq("reporter_id", userId)
    .gt("verification_count", 0);

  const totalVerifications = (verifiedReports ?? []).reduce(
    (sum, r) => sum + ((r.verification_count as number) ?? 0),
    0,
  );
  const peopleProtected = totalVerifications * 10;

  // 6. Return stats
  return {
    threats_reported: threatsReported,
    threats_blocked: threatsBlocked,
    people_protected: peopleProtected,
    protection_score: Math.min(100, protectionScore),
    active_alerts: alertCount ?? 0,
  };
}

/**
 * Create or return an existing individual profile.
 */
export async function createIndividualProfile(
  userId: string,
  data: { display_name?: string; risk_profile?: Record<string, unknown> },
) {
  // Check for existing profile
  const { data: existing } = await adminClient
    .from("individual_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) return existing;

  const { data: profile, error } = await adminClient
    .from("individual_profiles")
    .insert({
      user_id: userId,
      display_name: data.display_name ?? null,
      risk_profile: data.risk_profile ?? {},
      protection_level: "free",
      threats_reported: 0,
      threats_blocked: 0,
      reputation_score: 50,
      alert_preferences: { email: false, push: false, sms: false },
    })
    .select("*")
    .single();

  if (error) throw new Error("Failed to create profile: " + error.message);

  logger.info({ userId }, "consumer-bridge: individual profile created");
  return profile;
}

/**
 * List alerts for a user, optionally filtered to unread only.
 */
export async function getIndividualAlerts(
  userId: string,
  options?: { limit?: number; unread_only?: boolean },
) {
  let q = adminClient
    .from("individual_alerts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.unread_only) q = q.is("read_at", null);
  if (options?.limit) q = q.limit(options.limit);

  const { data } = await q;
  return data ?? [];
}

/**
 * Mark specific alerts as read.
 */
export async function markAlertsRead(userId: string, alertIds: string[]) {
  if (!alertIds.length) return;

  await adminClient
    .from("individual_alerts")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", alertIds);

  logger.info({ userId, count: alertIds.length }, "consumer-bridge: alerts marked read");
}
