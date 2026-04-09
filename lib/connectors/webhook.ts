// ============================================================
// Webhook Connector — Generic Inbound Webhook for Asset Reports
// ============================================================

import type { Connector, SyncResult } from "../types/platform";
import type { NexusConnector } from "./base";
import { logger } from "../logger";

export class WebhookConnector implements NexusConnector {
  kind = "webhook" as const;
  displayName = "Webhook";
  description = "Receive asset reports via inbound webhooks";
  category = "internal" as const;
  icon = "webhook";

  async validate(credentials: Record<string, string>) {
    const secret = credentials.webhook_secret;
    if (!secret || secret.trim().length === 0) {
      return { valid: false, error: "Webhook secret is required." };
    }
    if (secret.length < 16) {
      return {
        valid: false,
        error: "Webhook secret should be at least 16 characters for security.",
      };
    }
    logger.info("webhook: secret format valid");
    return { valid: true };
  }

  async sync(_connector: Connector, _credentials: Record<string, string>): Promise<SyncResult> {
    // Webhook connector receives assets via inbound HTTP — no outbound sync.
    return {
      assets: [],
      errors: [],
      metadata: {
        note: "Webhook connector receives assets via inbound POST requests, not outbound sync.",
      },
    };
  }
}
