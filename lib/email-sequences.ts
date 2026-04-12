import { adminClient } from "./supabase/admin";
import { logger } from "./logger";

// ============================================================================
// Automated Email Sequences
// ============================================================================
//
// Sends lifecycle emails via Resend at key moments: welcome, scan results,
// trial milestones, upgrade nudges, and reactivation. Each email is tracked
// in the email_sequences table to prevent duplicates.
// ============================================================================

const FROM_ADDRESS = "Spekris <hello@spekris.ai>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.spekris.io";

interface EmailTemplate {
  subject: string;
  html: string;
}

// ---- Template Definitions ----

function welcomeEmail(orgName: string): EmailTemplate {
  return {
    subject: "Welcome to Spekris — your AI inventory starts now",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h1 style="font-size:22px;font-weight:600;margin-bottom:16px">Welcome to Spekris</h1>
        <p style="font-size:15px;line-height:1.6;color:#4a4a6a">
          You just created <strong>${orgName}</strong>. Here's what happens next:
        </p>
        <ol style="font-size:14px;line-height:1.8;color:#4a4a6a;padding-left:20px">
          <li><strong>Connect a source</strong> — GitHub, GitLab, AWS, or any of our 10+ integrations</li>
          <li><strong>Spekris scans automatically</strong> — AI agents, LLM integrations, and workflows are discovered in minutes</li>
          <li><strong>Review your inventory</strong> — risk scores, ownership, and compliance gaps are populated instantly</li>
        </ol>
        <a href="${APP_URL}/platform/connectors" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;margin-top:16px">Connect your first source</a>
        <p style="font-size:13px;color:#9ca3af;margin-top:24px">
          Your 14-day trial includes full access to all features. No credit card required.
        </p>
      </div>
    `,
  };
}

function firstScanResultsEmail(orgName: string, assetCount: number, criticalCount: number, orphanedCount: number): EmailTemplate {
  return {
    subject: `Spekris found ${assetCount} AI system${assetCount === 1 ? "" : "s"} in ${orgName}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h1 style="font-size:22px;font-weight:600;margin-bottom:16px">Your first scan is complete</h1>
        <p style="font-size:15px;line-height:1.6;color:#4a4a6a">
          Spekris discovered <strong>${assetCount} AI system${assetCount === 1 ? "" : "s"}</strong> across your connected sources.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
          <div style="display:flex;gap:24px">
            <div>
              <div style="font-size:24px;font-weight:700;color:#0f172a">${assetCount}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Total assets</div>
            </div>
            ${criticalCount > 0 ? `
            <div>
              <div style="font-size:24px;font-weight:700;color:#dc2626">${criticalCount}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Critical risk</div>
            </div>` : ""}
            ${orphanedCount > 0 ? `
            <div>
              <div style="font-size:24px;font-weight:700;color:#f59e0b">${orphanedCount}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Orphaned</div>
            </div>` : ""}
          </div>
        </div>
        ${criticalCount > 0 || orphanedCount > 0 ? `
        <p style="font-size:14px;line-height:1.6;color:#4a4a6a">
          ${criticalCount > 0 ? `<strong>${criticalCount} critical-risk asset${criticalCount === 1 ? "" : "s"}</strong> need immediate review. ` : ""}
          ${orphanedCount > 0 ? `<strong>${orphanedCount} orphaned system${orphanedCount === 1 ? "" : "s"}</strong> have no active owner.` : ""}
        </p>` : ""}
        <a href="${APP_URL}/platform/assets" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;margin-top:12px">Review your inventory</a>
        <p style="font-size:13px;color:#9ca3af;margin-top:24px">
          Next step: Generate a compliance report for EU AI Act, SOC 2, ISO 42001, or NIST AI RMF.
        </p>
      </div>
    `,
  };
}

function trialMilestoneEmail(daysLeft: number, orgName: string, assetCount: number): EmailTemplate {
  const urgency = daysLeft <= 3;
  return {
    subject: urgency
      ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left on your Spekris trial`
      : `Your Spekris trial — ${daysLeft} days remaining`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h1 style="font-size:22px;font-weight:600;margin-bottom:16px">
          ${urgency ? `Only ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : `${daysLeft} days remaining on your trial`}
        </h1>
        <p style="font-size:15px;line-height:1.6;color:#4a4a6a">
          ${assetCount > 0
            ? `Your Spekris inventory has <strong>${assetCount} AI system${assetCount === 1 ? "" : "s"}</strong> tracked for <strong>${orgName}</strong>. When your trial ends, you'll lose access to:`
            : `Connect a source to discover the AI systems running across ${orgName} before your trial ends.`}
        </p>
        ${assetCount > 0 ? `
        <ul style="font-size:14px;line-height:1.8;color:#4a4a6a;padding-left:20px">
          <li>Your complete AI asset inventory</li>
          <li>Risk scores and ownership tracking</li>
          <li>Compliance reports and gap analysis</li>
          <li>Policy engine and violation alerts</li>
        </ul>` : ""}
        <a href="${APP_URL}/platform/settings/billing" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;margin-top:12px">
          ${urgency ? "Upgrade now" : "View plans"}
        </a>
        <p style="font-size:13px;color:#9ca3af;margin-top:24px">
          Professional plan: $2,500/mo — unlimited connectors, all 4 compliance frameworks, Slack alerts.
        </p>
      </div>
    `,
  };
}

function trialExpiredEmail(orgName: string): EmailTemplate {
  return {
    subject: `Your Spekris trial has ended — ${orgName}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h1 style="font-size:22px;font-weight:600;margin-bottom:16px">Your trial has ended</h1>
        <p style="font-size:15px;line-height:1.6;color:#4a4a6a">
          The 14-day trial for <strong>${orgName}</strong> has expired. Your data is preserved
          for 30 days — upgrade anytime to pick up right where you left off.
        </p>
        <p style="font-size:14px;line-height:1.6;color:#4a4a6a">
          Most teams choose <strong>Professional ($2,500/mo)</strong> for unlimited connectors, all 4 compliance
          frameworks, and the full policy engine.
        </p>
        <a href="${APP_URL}/platform/settings/billing" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;margin-top:12px">Reactivate your account</a>
        <p style="font-size:13px;color:#9ca3af;margin-top:24px">
          Questions? Reply to this email and a human will get back to you within 24 hours.
        </p>
      </div>
    `,
  };
}

function onboardingIncompleteEmail(orgName: string, step: string): EmailTemplate {
  return {
    subject: `Finish setting up ${orgName} on Spekris — one step left`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h1 style="font-size:22px;font-weight:600;margin-bottom:16px">You're almost there</h1>
        <p style="font-size:15px;line-height:1.6;color:#4a4a6a">
          You created <strong>${orgName}</strong> but haven't ${step === "connector" ? "connected a data source yet" : "completed your first scan"}.
          Most teams find undocumented AI systems on their first scan.
        </p>
        <a href="${APP_URL}/${step === "connector" ? "platform/connectors" : "onboarding"}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;margin-top:12px">
          ${step === "connector" ? "Connect your first source" : "Continue setup"}
        </a>
        <p style="font-size:13px;color:#9ca3af;margin-top:24px">
          Setup takes under 5 minutes. Your first scan runs automatically after connecting a source.
        </p>
      </div>
    `,
  };
}

function upgradeNudgeEmail(orgName: string, reason: string, details: string): EmailTemplate {
  return {
    subject: `${orgName} is growing — time to upgrade?`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">
        <h1 style="font-size:22px;font-weight:600;margin-bottom:16px">You're hitting your plan limits</h1>
        <p style="font-size:15px;line-height:1.6;color:#4a4a6a">${details}</p>
        <p style="font-size:14px;line-height:1.6;color:#4a4a6a">
          Upgrade to <strong>Professional ($2,500/mo)</strong> for:
        </p>
        <ul style="font-size:14px;line-height:1.8;color:#4a4a6a;padding-left:20px">
          <li>Unlimited connectors and assets</li>
          <li>EU AI Act, SOC 2, ISO 42001, and NIST AI RMF compliance</li>
          <li>Full policy engine with Slack and webhook alerts</li>
          <li>Audit log export</li>
        </ul>
        <a href="${APP_URL}/platform/settings/billing" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500;margin-top:12px">Upgrade now</a>
      </div>
    `,
  };
}

// ---- Send Logic ----

async function sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("email-sequences: RESEND_API_KEY not set, skipping send");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject: template.subject,
        html: template.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, "email-sequences: send failed");
      return false;
    }

    return true;
  } catch (err) {
    logger.error({ err }, "email-sequences: send threw");
    return false;
  }
}

// ---- Public API ----

/**
 * Send a welcome email after signup. Idempotent — won't resend.
 */
export async function sendWelcomeEmail(orgId: string, email: string, orgName: string): Promise<void> {
  const { data: existing } = await adminClient
    .from("email_sequences")
    .select("id")
    .eq("org_id", orgId)
    .eq("sequence", "welcome")
    .limit(1);

  if (existing?.length) return;

  const template = welcomeEmail(orgName);
  const sent = await sendEmail(email, template);

  if (sent) {
    await adminClient.from("email_sequences").insert({
      org_id: orgId,
      user_email: email,
      sequence: "welcome",
      step: 1,
    });
  }
}

/**
 * Send scan results email after first sync completes. Idempotent.
 */
export async function sendFirstScanResultsEmail(
  orgId: string,
  email: string,
  orgName: string,
): Promise<void> {
  const { data: existing } = await adminClient
    .from("email_sequences")
    .select("id")
    .eq("org_id", orgId)
    .eq("sequence", "first_scan_results")
    .limit(1);

  if (existing?.length) return;

  // Get scan stats
  const [assetsResult, criticalResult, orphanedResult] = await Promise.all([
    adminClient.from("assets").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    adminClient.from("assets").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("risk_level", "critical"),
    adminClient.from("assets").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("owner_status", "orphaned"),
  ]);

  const assetCount = assetsResult.count ?? 0;
  const criticalCount = criticalResult.count ?? 0;
  const orphanedCount = orphanedResult.count ?? 0;

  if (assetCount === 0) return; // Don't send if nothing was found

  const template = firstScanResultsEmail(orgName, assetCount, criticalCount, orphanedCount);
  const sent = await sendEmail(email, template);

  if (sent) {
    await adminClient.from("email_sequences").insert({
      org_id: orgId,
      user_email: email,
      sequence: "first_scan_results",
      step: 1,
      metadata: { assetCount, criticalCount, orphanedCount },
    });
  }
}

/**
 * Process and send all pending lifecycle emails. Called by cron.
 */
export async function processEmailQueue(): Promise<{ sent: number; errors: number }> {
  const results = { sent: 0, errors: 0 };

  // Process pending trial milestone emails
  const { data: pendingEmails } = await adminClient
    .from("email_sequences")
    .select("*")
    .eq("status", "sent")
    .in("sequence", ["trial_expiring", "trial_expired"])
    .order("sent_at", { ascending: true })
    .limit(50);

  for (const record of pendingEmails ?? []) {
    const metadata = record.metadata as Record<string, unknown>;
    let template: EmailTemplate;

    if (record.sequence === "trial_expiring") {
      const trialEndsAt = metadata.trial_ends_at as string;
      const daysLeft = Math.max(1, Math.ceil(
        (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      ));

      // Get asset count
      const { count } = await adminClient
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("org_id", record.org_id);

      template = trialMilestoneEmail(daysLeft, (metadata.org_name as string) ?? "your organization", count ?? 0);
    } else {
      template = trialExpiredEmail((metadata.org_name as string) ?? "your organization");
    }

    const sent = await sendEmail(record.user_email as string, template);
    if (sent) {
      results.sent++;
    } else {
      results.errors++;
    }
  }

  // Check for incomplete onboardings (signed up > 24h ago, no connector)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: staleOrgs } = await adminClient
    .from("organizations")
    .select("id, name")
    .eq("conversion_status", "trial")
    .is("onboarding_completed_at", null)
    .lt("created_at", oneDayAgo)
    .limit(50);

  for (const org of staleOrgs ?? []) {
    // Check if email already sent
    const { data: existing } = await adminClient
      .from("email_sequences")
      .select("id")
      .eq("org_id", org.id)
      .eq("sequence", "onboarding_incomplete")
      .limit(1);

    if (existing?.length) continue;

    // Find what step they're stuck on
    const { count: connectorCount } = await adminClient
      .from("connectors")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id);

    const step = (connectorCount ?? 0) === 0 ? "connector" : "scan";

    // Get owner email
    const { data: owner } = await adminClient
      .from("org_members")
      .select("user_id")
      .eq("org_id", org.id)
      .eq("role", "owner")
      .limit(1)
      .single();

    if (!owner) continue;

    const { data: user } = await adminClient.auth.admin.getUserById(owner.user_id);
    if (!user?.user?.email) continue;

    const template = onboardingIncompleteEmail(org.name as string, step);
    const sent = await sendEmail(user.user.email, template);

    if (sent) {
      await adminClient.from("email_sequences").insert({
        org_id: org.id,
        user_email: user.user.email,
        sequence: "onboarding_incomplete",
        step: 1,
        metadata: { stuck_step: step },
      });
      results.sent++;
    } else {
      results.errors++;
    }
  }

  logger.info(results, "email-sequences: processed queue");
  return results;
}
