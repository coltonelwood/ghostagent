// ============================================================
// Slack Connector — Webhook-based Alerting Integration
// ============================================================

import type { Connector, SyncResult } from "../types/platform";
import type { NexusConnector } from "./base";
import { logger } from "../logger";
import { validateSlackWebhookUrl, SSRFError } from "../ssrf-guard";

export class SlackConnector implements NexusConnector {
  kind = "slack" as const;
  displayName = "Slack";
  description = "Send alerts and notifications to Slack channels";
  category = "internal" as const;
  icon = "message-square";

  async validate(credentials: Record<string, string>) {
    try {
      const url = credentials.webhook_url;
      if (!url) return { valid: false, error: "webhook_url is required" };
      try { validateSlackWebhookUrl(url); } catch (e) {
        return { valid: false, error: e instanceof SSRFError ? e.message : "Invalid webhook URL" };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Nexus connector validation: Slack webhook is working.",
        }),
      });

      if (!res.ok) {
        return { valid: false, error: `Slack webhook failed: ${res.status}` };
      }

      logger.info("slack: webhook valid");
      return { valid: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, error: `Slack validation failed: ${message}` };
    }
  }

  async sync(_connector: Connector, _credentials: Record<string, string>): Promise<SyncResult> {
    // Slack connector is used for alerting, not asset discovery.
    return {
      assets: [],
      errors: [],
      metadata: {
        note: "Slack connector is used for alerting and notifications, not asset discovery.",
      },
    };
  }
}
