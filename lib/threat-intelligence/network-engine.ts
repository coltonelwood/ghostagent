import { adminClient } from "@/lib/supabase/admin";
import { emitEvent } from "@/lib/event-system";
import { logger } from "@/lib/logger";
import { generateContributorHash, anonymizeSignature, generalizeIndustry, generalizeTechStack } from "./anonymizer";

/**
 * Join the Collective Defense Network.
 */
export async function joinNetwork(
  orgId: string,
  options?: {
    contribution_tier?: string;
    share_threat_fingerprints?: boolean;
    share_genome_profile?: boolean;
    anonymization_level?: string;
  },
): Promise<{ id: string; status: string }> {
  // Check if already a member
  const { data: existing } = await adminClient
    .from("network_memberships")
    .select("id, status")
    .eq("org_id", orgId)
    .single();

  if (existing) {
    if (existing.status === "withdrawn") {
      // Rejoin
      await adminClient
        .from("network_memberships")
        .update({ status: "active", joined_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { id: existing.id, status: "active" };
    }
    return { id: existing.id, status: existing.status };
  }

  const { data, error } = await adminClient
    .from("network_memberships")
    .insert({
      org_id: orgId,
      status: "active",
      contribution_tier: options?.contribution_tier ?? "standard",
      share_threat_fingerprints: options?.share_threat_fingerprints ?? true,
      share_genome_profile: options?.share_genome_profile ?? true,
      anonymization_level: options?.anonymization_level ?? "full",
      joined_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();

  if (error) throw new Error("Failed to join network: " + error.message);

  await emitEvent({
    orgId,
    kind: "member_joined" as any,
    severity: "info",
    title: "Joined the Collective Defense Network",
    body: "Your organization is now part of the collective cybercrime immunity network.",
    metadata: { tier: options?.contribution_tier ?? "standard" },
  });

  logger.info({ orgId }, "network-engine: org joined collective defense");
  return data;
}

/**
 * Get network membership for an org.
 */
export async function getMembership(orgId: string) {
  const { data } = await adminClient
    .from("network_memberships")
    .select("*")
    .eq("org_id", orgId)
    .single();
  return data;
}

/**
 * Update network membership preferences.
 */
export async function updateMembership(
  orgId: string,
  updates: {
    contribution_tier?: string;
    share_threat_fingerprints?: boolean;
    share_genome_profile?: boolean;
    share_countermeasure_outcomes?: boolean;
    anonymization_level?: string;
  },
) {
  const { data, error } = await adminClient
    .from("network_memberships")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) throw new Error("Failed to update membership: " + error.message);
  return data;
}

/**
 * Withdraw from the network.
 */
export async function withdrawFromNetwork(orgId: string) {
  await adminClient
    .from("network_memberships")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("org_id", orgId);
  logger.info({ orgId }, "network-engine: org withdrew from collective defense");
}

/**
 * Share a behavioral fingerprint to the network.
 * Anonymizes the data before inserting into shared_threat_intelligence.
 */
export async function shareToNetwork(
  orgId: string,
  fingerprintId: string,
): Promise<{ shared_id: string }> {
  // Get the membership to check permissions and anonymization level
  const membership = await getMembership(orgId);
  if (!membership || membership.status !== "active") {
    throw new Error("Organization is not an active network member");
  }
  if (!membership.share_threat_fingerprints) {
    throw new Error("Threat fingerprint sharing is disabled for this organization");
  }

  // Get the fingerprint
  const { data: fingerprint } = await adminClient
    .from("threat_behavioral_fingerprints")
    .select("*")
    .eq("id", fingerprintId)
    .eq("reporting_org_id", orgId)
    .single();

  if (!fingerprint) throw new Error("Fingerprint not found");
  if (fingerprint.shared_fingerprint_id) throw new Error("Fingerprint already shared");

  // Get org genome for context
  const { data: genome } = await adminClient
    .from("threat_surface_genomes")
    .select("industry_classification, tech_stack_fingerprint, org_size_tier")
    .eq("org_id", orgId)
    .order("genome_version", { ascending: false })
    .limit(1)
    .single();

  // Anonymize the behavioral signature
  const anonymized = anonymizeSignature(
    fingerprint.behavioral_signature as Record<string, unknown>,
    membership.anonymization_level as "full" | "partial" | "minimal",
  );

  // Generate unlinkable contributor hash
  const contributorHash = generateContributorHash(orgId);

  // Build anonymized context
  const affected_industries = genome?.industry_classification
    ? [generalizeIndustry(genome.industry_classification)]
    : [];
  const affected_tech_stacks = genome?.tech_stack_fingerprint
    ? generalizeTechStack(genome.tech_stack_fingerprint as Record<string, string[]>)
    : [];
  const affected_size_tiers = genome?.org_size_tier ? [genome.org_size_tier] : [];

  // Insert into shared intelligence
  const { data: shared, error } = await adminClient
    .from("shared_threat_intelligence")
    .insert({
      contributor_hash: contributorHash,
      fingerprint_type: fingerprint.fingerprint_type,
      behavioral_signature: anonymized,
      attack_stage: fingerprint.attack_stage,
      severity: fingerprint.severity,
      confidence: fingerprint.confidence,
      corroboration_count: 1,
      affected_industries,
      affected_tech_stacks,
      affected_size_tiers,
      status: "active",
      ttl_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 day TTL
    })
    .select("id")
    .single();

  if (error) throw new Error("Failed to share to network: " + error.message);

  // Link the fingerprint to its shared version
  await adminClient
    .from("threat_behavioral_fingerprints")
    .update({ shared_fingerprint_id: shared.id, updated_at: new Date().toISOString() })
    .eq("id", fingerprintId);

  // Increment contribution count
  await adminClient
    .from("network_memberships")
    .update({
      threats_contributed: (membership.threats_contributed ?? 0) + 1,
      last_contribution_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  // Emit events
  await emitEvent({
    orgId,
    kind: "asset_discovered" as any, // Will be 'threat_shared'
    severity: "info",
    title: "Threat intelligence shared to network",
    body: `Behavioral fingerprint for ${fingerprint.fingerprint_type} shared anonymously to the collective defense network.`,
    metadata: { shared_id: shared.id, type: fingerprint.fingerprint_type },
  });

  logger.info({ orgId, sharedId: shared.id, type: fingerprint.fingerprint_type }, "network-engine: shared to network");

  return { shared_id: shared.id };
}

/**
 * Receive relevant threat intelligence from the network.
 * Matches incoming threats against the org's genome.
 */
export async function receiveFromNetwork(
  orgId: string,
  options?: { limit?: number; offset?: number; since?: string },
): Promise<{ data: any[]; total: number }> {
  // Get org's genome for relevance matching
  const { data: genome } = await adminClient
    .from("threat_surface_genomes")
    .select("*")
    .eq("org_id", orgId)
    .order("genome_version", { ascending: false })
    .limit(1)
    .single();

  let q = adminClient
    .from("shared_threat_intelligence")
    .select("*", { count: "exact" })
    .eq("status", "active")
    .order("last_seen_network_at", { ascending: false });

  if (options?.since) q = q.gte("first_seen_network_at", options.since);
  if (options?.limit) q = q.limit(options.limit);
  if (options?.offset) q = q.range(options.offset, options.offset + (options.limit ?? 20) - 1);

  const { data, count } = await q;

  // If we have a genome, sort by relevance
  if (genome && data?.length) {
    const orgIndustry = generalizeIndustry(genome.industry_classification);
    const orgTech = generalizeTechStack(genome.tech_stack_fingerprint as Record<string, string[]>);
    const orgSize = genome.org_size_tier;

    // Simple relevance scoring
    for (const item of data) {
      let relevance = 50; // Base relevance
      const industries = item.affected_industries as string[] ?? [];
      const techs = item.affected_tech_stacks as string[] ?? [];
      const sizes = item.affected_size_tiers as string[] ?? [];

      if (industries.includes(orgIndustry)) relevance += 20;
      if (orgTech.some((t: string) => techs.includes(t))) relevance += 15;
      if (sizes.includes(orgSize)) relevance += 10;
      if (item.corroboration_count > 1) relevance += 5;

      (item as any)._relevance = Math.min(100, relevance);
    }

    data.sort((a: any, b: any) => (b._relevance ?? 0) - (a._relevance ?? 0));
  }

  return { data: data ?? [], total: count ?? 0 };
}

/**
 * Corroborate shared intelligence when another org observes the same pattern.
 */
export async function corroborateIntelligence(
  intelId: string,
  orgId: string,
): Promise<void> {
  const { data: intel } = await adminClient
    .from("shared_threat_intelligence")
    .select("corroboration_count, confidence, status")
    .eq("id", intelId)
    .single();

  if (!intel) throw new Error("Intelligence not found");

  const newCount = (intel.corroboration_count ?? 1) + 1;
  // Boost confidence with corroboration (diminishing returns)
  const confidenceBoost = Math.min(10, 20 / newCount);
  const newConfidence = Math.min(100, (intel.confidence ?? 50) + confidenceBoost);

  await adminClient
    .from("shared_threat_intelligence")
    .update({
      corroboration_count: newCount,
      confidence: newConfidence,
      last_seen_network_at: new Date().toISOString(),
      status: newCount >= 3 ? "confirmed" : intel.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intelId);

  logger.info({ intelId, corroborations: newCount }, "network-engine: intel corroborated");
}

/**
 * Get aggregate network statistics (all anonymized).
 */
export async function getNetworkStats(): Promise<{
  total_members: number;
  threats_shared_this_week: number;
  active_threats: number;
  countermeasures_deployed: number;
  top_threat_types: Array<{ type: string; count: number }>;
}> {
  const [membersResult, weeklyResult, activeResult, deploymentsResult] = await Promise.all([
    adminClient.from("network_memberships").select("id", { count: "exact" }).eq("status", "active"),
    adminClient.from("shared_threat_intelligence").select("id", { count: "exact" })
      .gte("first_seen_network_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    adminClient.from("shared_threat_intelligence").select("id", { count: "exact" }).eq("status", "active"),
    adminClient.from("countermeasure_deployments").select("id", { count: "exact" }).in("status", ["deployed", "active"]),
  ]);

  // Get top threat types
  const { data: threats } = await adminClient
    .from("shared_threat_intelligence")
    .select("fingerprint_type")
    .eq("status", "active");

  const typeCounts: Record<string, number> = {};
  for (const t of threats ?? []) {
    typeCounts[t.fingerprint_type] = (typeCounts[t.fingerprint_type] ?? 0) + 1;
  }
  const top_threat_types = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total_members: membersResult.count ?? 0,
    threats_shared_this_week: weeklyResult.count ?? 0,
    active_threats: activeResult.count ?? 0,
    countermeasures_deployed: deploymentsResult.count ?? 0,
    top_threat_types,
  };
}
