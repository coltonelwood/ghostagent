import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgForUser, requireOrgMember } from "@/lib/org";
import { auditLog } from "@/lib/audit";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { validateWebhookUrl, validateSlackWebhookUrl, SSRFError } from "@/lib/ssrf-guard";

export const dynamic = "force-dynamic";

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const DEFAULTS = {
  slack_webhook_url: null,
  slack_channel: null,
  email_recipients: [],
  webhook_urls: [],
  event_filters: {},
  digest_mode: false,
  digest_schedule: "0 9 * * 1",
  suppression_rules: [],
};

export const GET = withLogging(async () => {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  const db = getAdminClient();

  const { data, error } = await db
    .from("alert_preferences")
    .select("*")
    .eq("org_id", org.id)
    .single();

  if (error && error.code !== "PGRST116") {
    logger.error({ error }, "GET /api/org/alerts error");
    return NextResponse.json({ error: "Failed to fetch alert preferences" }, { status: 500 });
  }

  const prefs = data ?? { ...DEFAULTS, org_id: org.id };
  // UI expects event_filter_matrix, DB stores event_filters — return both
  return NextResponse.json({
    data: {
      ...prefs,
      event_filter_matrix: prefs.event_filters ?? {},
    },
  });
});

export const PATCH = withLogging(async (req: NextRequest) => {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrCreateOrgForUser(user.id, user.email!);
  await requireOrgMember(user.id, org.id, "admin");

  const db = getAdminClient();
  const body = await req.json();

  // Only allow known fields
  // Note: UI sends `event_filter_matrix` which we store as `event_filters`
  const allowed = [
    "slack_webhook_url", "slack_channel", "email_recipients",
    "webhook_urls", "event_filters", "event_filter_matrix",
    "digest_mode", "digest_schedule", "suppression_rules",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in body)) continue;
    if (key === "event_filter_matrix") {
      updates.event_filters = body[key];
    } else if (key === "slack_webhook_url" && body[key]) {
      try { validateSlackWebhookUrl(String(body[key])); } catch (e) {
        return NextResponse.json({ error: e instanceof SSRFError ? e.message : "Invalid Slack webhook URL" }, { status: 400 });
      }
      updates[key] = body[key];
    } else if (key === "webhook_urls" && Array.isArray(body[key])) {
      const validated: string[] = [];
      for (const url of body[key] as unknown[]) {
        if (typeof url !== "string") continue;
        try { validateWebhookUrl(url); validated.push(url); } catch (e) {
          return NextResponse.json({ error: `Invalid webhook URL: ${e instanceof SSRFError ? e.message : String(e)}` }, { status: 400 });
        }
      }
      updates[key] = validated;
    } else if (key === "email_recipients" && Array.isArray(body[key])) {
      // Validate email format
      const emails = (body[key] as unknown[]).filter(e => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      updates[key] = emails.slice(0, 20); // cap at 20 recipients
    } else {
      updates[key] = body[key];
    }
  }

  const { data, error } = await db
    .from("alert_preferences")
    .upsert(
      { ...updates, org_id: org.id, updated_at: new Date().toISOString() },
      { onConflict: "org_id" },
    )
    .select()
    .single();

  if (error) {
    logger.error({ error }, "PATCH /api/org/alerts error");
    return NextResponse.json({ error: "Failed to update alert preferences" }, { status: 500 });
  }

  await auditLog({
    orgId: org.id,
    actorId: user.id,
    actorEmail: user.email,
    action: "alerts.updated",
    resourceType: "alert_preferences",
    resourceId: org.id,
    metadata: { fields: Object.keys(updates) },
    req,
  });

  return NextResponse.json({ data });
});
