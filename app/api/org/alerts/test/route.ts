import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { validateSlackWebhookUrl, validateWebhookUrl } from "@/lib/ssrf-guard";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/org/alerts/test
 *
 * Sends a test message through a configured alert channel (slack, email, or webhook).
 * Requires admin role.
 */
export const POST = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireRole("admin");

    const body = (await req.json()) as { channel: "slack" | "email" | "webhook" };
    const { channel } = body;

    if (!channel || !["slack", "email", "webhook"].includes(channel)) {
      return NextResponse.json(
        { error: "channel must be one of: slack, email, webhook" },
        { status: 400 },
      );
    }

    const db = getAdminClient();
    const { data: prefs } = await db
      .from("alert_preferences")
      .select("*")
      .eq("org_id", auth.orgId)
      .single();

    if (!prefs) {
      return NextResponse.json(
        { error: "No alert preferences configured. Save your preferences first." },
        { status: 400 },
      );
    }

    switch (channel) {
      case "slack": {
        const slackUrl = prefs.slack_webhook_url as string | null;
        if (!slackUrl) {
          return NextResponse.json(
            { error: "No Slack webhook URL configured." },
            { status: 400 },
          );
        }

        try {
          validateSlackWebhookUrl(slackUrl);
        } catch {
          return NextResponse.json(
            { error: "Slack webhook URL failed validation. Please check the URL and save again." },
            { status: 400 },
          );
        }

        const res = await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Spekris test alert \u2014 your Slack integration is working.",
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          logger.warn({ status: res.status, text }, "alert-test: slack failed");
          return NextResponse.json(
            { error: `Slack returned HTTP ${res.status}. Check your webhook URL.` },
            { status: 502 },
          );
        }

        return NextResponse.json({ success: true, message: "Test message sent to Slack." });
      }

      case "email": {
        const recipients = (prefs.email_recipients as string[]) ?? [];
        if (recipients.length === 0) {
          return NextResponse.json(
            { error: "No email recipients configured." },
            { status: 400 },
          );
        }

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          return NextResponse.json(
            { error: "Email sending is not configured on this instance (missing RESEND_API_KEY)." },
            { status: 503 },
          );
        }

        const html = `<div style="font-family:sans-serif;max-width:600px"><h2>Spekris Test Alert</h2><p>This is a test email from Spekris. Your email alert integration is working correctly.</p><p style="color:#6b7280;font-size:12px">You can ignore this message.</p></div>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Spekris <alerts@spekris.ai>",
            to: recipients,
            subject: "[Spekris] Test Alert",
            html,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          logger.warn({ status: res.status, text }, "alert-test: email failed");
          return NextResponse.json(
            { error: `Email provider returned HTTP ${res.status}. Check your configuration.` },
            { status: 502 },
          );
        }

        return NextResponse.json({
          success: true,
          message: `Test email sent to ${recipients.length} recipient(s).`,
        });
      }

      case "webhook": {
        const webhookUrls = (prefs.webhook_urls as string[]) ?? [];
        if (webhookUrls.length === 0) {
          return NextResponse.json(
            { error: "No webhook URLs configured." },
            { status: 400 },
          );
        }

        const url = webhookUrls[0];
        try {
          validateWebhookUrl(url);
        } catch {
          return NextResponse.json(
            { error: "Webhook URL failed validation. Please check the URL and save again." },
            { status: 400 },
          );
        }

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "test",
            message: "Spekris test \u2014 your webhook is receiving events.",
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          logger.warn({ status: res.status, text }, "alert-test: webhook failed");
          return NextResponse.json(
            { error: `Webhook returned HTTP ${res.status}. Check your endpoint.` },
            { status: 502 },
          );
        }

        return NextResponse.json({ success: true, message: "Test payload sent to webhook." });
      }

      default:
        return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
