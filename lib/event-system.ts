import { adminClient } from "./supabase/admin";
import { logger } from "./logger";
import { withRetry } from "./retry";
import { validateSlackWebhookUrl, validateWebhookUrl } from "./ssrf-guard";
import type { EventKind, Severity } from "./types/platform";

// ============================================================
// Nexus Event System
// ============================================================

interface EmitEventParams {
  orgId: string;
  kind: EventKind;
  severity: Severity;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  assetId?: string;
  connectorId?: string;
  policyId?: string;
  actorId?: string;
}

const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function emitEvent(params: EmitEventParams): Promise<string | null> {
  const { orgId, kind, severity, title, body, metadata = {}, assetId, connectorId, policyId, actorId } = params;

  // Deduplication
  if (assetId) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: existing } = await adminClient
      .from("events")
      .select("id")
      .eq("org_id", orgId)
      .eq("kind", kind)
      .eq("asset_id", assetId)
      .gte("created_at", since)
      .limit(1);

    if (existing?.length) {
      logger.debug({ orgId, kind, assetId }, "event_system: deduped event");
      return null;
    }
  }

  const { data: event, error } = await adminClient
    .from("events")
    .insert({
      org_id: orgId,
      kind,
      severity,
      title,
      body: body ?? null,
      metadata,
      asset_id: assetId ?? null,
      connector_id: connectorId ?? null,
      policy_id: policyId ?? null,
      actor_id: actorId ?? null,
    })
    .select("id")
    .single();

  if (error || !event) {
    logger.error({ error }, "event_system: failed to create event");
    return null;
  }

  const eventId = event.id as string;

  // Create in-app notifications for org admins (async, don't block)
  createNotifications(orgId, eventId, kind, severity, title, body ?? null).catch((err) =>
    logger.error({ err, eventId }, "event_system: notification error")
  );

  // Dispatch external alerts
  dispatchAlerts(orgId, eventId, kind, severity, title, body ?? null, metadata).catch((err) =>
    logger.error({ err, eventId }, "event_system: alert dispatch error")
  );

  return eventId;
}

async function createNotifications(
  orgId: string,
  eventId: string,
  kind: string,
  severity: Severity,
  title: string,
  body: string | null
): Promise<void> {
  if (severity === "info" || severity === "low") return;

  const { data: members } = await adminClient
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .in("role", ["owner", "admin"]);

  if (!members?.length) return;

  const notifications = members.map((m: { user_id: string }) => ({
    org_id: orgId,
    user_id: m.user_id,
    event_id: eventId,
    title,
    body,
    kind,
    severity,
  }));

  await adminClient.from("notifications").insert(notifications);
}

async function dispatchAlerts(
  orgId: string,
  eventId: string,
  kind: EventKind,
  severity: Severity,
  title: string,
  body: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  const { data: prefs } = await adminClient
    .from("alert_preferences")
    .select("*")
    .eq("org_id", orgId)
    .single();

  if (!prefs) return;

  const tasks: Promise<void>[] = [];

  if (prefs.slack_webhook_url) {
    const slackUrl = prefs.slack_webhook_url as string;
    try {
      validateSlackWebhookUrl(slackUrl); // Re-validate at dispatch time
      tasks.push(dispatchSlack(orgId, eventId, slackUrl, prefs.slack_channel as string | null, kind, severity, title, body));
    } catch {
      logger.warn({ orgId }, "event-system: skipping invalid slack webhook URL at dispatch");
    }
  }

  for (const url of (prefs.webhook_urls as string[]) ?? []) {
    try {
      validateWebhookUrl(url); // Re-validate at dispatch time
      tasks.push(dispatchWebhook(orgId, eventId, url, kind, severity, title, body, metadata));
    } catch {
      logger.warn({ orgId, url: url.slice(0, 40) }, "event-system: skipping invalid webhook URL at dispatch");
    }
  }

  const emailRecipients = (prefs.email_recipients as string[]) ?? [];
  if (emailRecipients.length > 0 && process.env.RESEND_API_KEY && severity !== "info") {
    tasks.push(dispatchEmail(orgId, eventId, emailRecipients, kind, severity, title, body));
  }

  await Promise.allSettled(tasks);
}

async function dispatchSlack(
  orgId: string,
  eventId: string,
  webhookUrl: string,
  channel: string | null,
  kind: EventKind,
  severity: Severity,
  title: string,
  body: string | null
): Promise<void> {
  const icons: Record<Severity, string> = { info: "ℹ️", low: "🔵", medium: "🟡", high: "🟠", critical: "🔴" };
  const payload: Record<string, unknown> = {
    text: `${icons[severity]} *Nexus Alert* — ${title}`,
    blocks: [{
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${icons[severity]} *${title}*\n${body ?? ""}\n\n*Severity:* ${severity.toUpperCase()} | *Event:* ${kind}`,
      },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "View in Nexus" },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/platform/events`,
      },
    }],
  };
  if (channel) payload.channel = channel;

  try {
    await withRetry(async () => {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Slack returned ${res.status}`);
    }, { maxAttempts: 3, baseDelayMs: 1000 });

    await adminClient.from("alert_deliveries").insert({
      org_id: orgId, event_id: eventId, channel: "slack",
      destination: channel ?? webhookUrl, status: "delivered", delivered_at: new Date().toISOString(),
    });
  } catch (err) {
    await adminClient.from("alert_deliveries").insert({
      org_id: orgId, event_id: eventId, channel: "slack",
      destination: channel ?? webhookUrl, status: "failed", error: String(err),
    });
  }
}

async function dispatchWebhook(
  orgId: string,
  eventId: string,
  url: string,
  kind: EventKind,
  severity: Severity,
  title: string,
  body: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await withRetry(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, org_id: orgId, kind, severity, title, body, metadata, timestamp: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    }, { maxAttempts: 3, baseDelayMs: 2000 });

    await adminClient.from("alert_deliveries").insert({
      org_id: orgId, event_id: eventId, channel: "webhook",
      destination: url, status: "delivered", delivered_at: new Date().toISOString(),
    });
  } catch (err) {
    await adminClient.from("alert_deliveries").insert({
      org_id: orgId, event_id: eventId, channel: "webhook",
      destination: url, status: "failed", error: String(err),
    });
  }
}

async function dispatchEmail(
  orgId: string,
  eventId: string,
  recipients: string[],
  kind: EventKind,
  severity: Severity,
  title: string,
  body: string | null
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const html = `<div style="font-family:sans-serif;max-width:600px"><h2>${title}</h2>${body ? `<p>${body}</p>` : ""}<p style="color:#6b7280;font-size:12px">Severity: ${severity.toUpperCase()} | Event: ${kind}</p><a href="${process.env.NEXT_PUBLIC_APP_URL}/platform/events" style="background:#0f172a;color:white;padding:8px 16px;border-radius:6px;text-decoration:none">View in Nexus</a></div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Nexus <alerts@nexus.ai>", to: recipients, subject: `[Nexus] ${severity.toUpperCase()}: ${title}`, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);

    await adminClient.from("alert_deliveries").insert({
      org_id: orgId, event_id: eventId, channel: "email",
      destination: recipients.join(", "), status: "delivered", delivered_at: new Date().toISOString(),
    });
  } catch (err) {
    await adminClient.from("alert_deliveries").insert({
      org_id: orgId, event_id: eventId, channel: "email",
      destination: recipients.join(", "), status: "failed", error: String(err),
    });
    logger.error({ err, orgId, eventId }, "event_system: email dispatch failed");
  }
}
