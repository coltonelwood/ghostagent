// ============================================================
// Workday Connector
// ============================================================

import type { Connector, SyncResult, HRSyncResult, HREmployee } from "../types/platform";
import type { NexusHRConnector } from "./base";
import { withRetry } from "../retry";
import { logger } from "../logger";

async function getWorkdayToken(
  credentials: Record<string, string>,
): Promise<string> {
  const tokenUrl = `${credentials.tenantUrl.replace(/\/$/, "")}/oauth2/token`;

  const res = await withRetry(
    () =>
      fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
      }),
    { label: "workday:token" },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workday token request failed: HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

export class WorkdayConnector implements NexusHRConnector {
  kind = "workday" as const;
  displayName = "Workday";
  description = "Sync employee data for ownership verification and offboarding detection";
  category = "hr" as const;
  icon = "users";

  async validate(credentials: Record<string, string>) {
    const { tenantUrl, clientId, clientSecret } = credentials;

    if (!tenantUrl || !clientId || !clientSecret) {
      return { valid: false, error: "tenantUrl, clientId, and clientSecret are required" };
    }

    try {
      await getWorkdayToken(credentials);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sync(_connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const { errors } = await this.fetchEmployees(credentials);
    return { assets: [], errors, metadata: { source: "workday", note: "HR connector — employees synced to ownership engine" } };
  }

  async fetchEmployees(credentials: Record<string, string>): Promise<HRSyncResult> {
    const tenantUrl = credentials.tenantUrl.replace(/\/$/, "");
    const employees: HREmployee[] = [];
    const errors: Array<{ resource: string; message: string; recoverable: boolean }> = [];

    let token: string;
    try {
      token = await getWorkdayToken(credentials);
    } catch (err) {
      return {
        employees: [],
        errors: [{ resource: "auth", message: err instanceof Error ? err.message : String(err), recoverable: false }],
      };
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    try {
      let offset = 0;
      let hasMore = true;

      while (hasMore && employees.length < 5000) {
        const url = `${tenantUrl}/api/v1/workers?limit=100&offset=${offset}`;
        const res = await withRetry(
          () => fetch(url, { headers }),
          { label: "workday:workers:list" },
        );

        if (!res.ok) throw new Error(`Workday returned ${res.status}`);

        const data = await res.json();
        const workers = data.data ?? [];

        for (const worker of workers) {
          const email = worker.primaryWorkEmail ?? worker.emailAddress ?? "";
          if (!email) continue;

          employees.push({
            email,
            name: worker.descriptor ?? [worker.firstName, worker.lastName].filter(Boolean).join(" "),
            status: mapStatus(worker.workerStatus),
            department: worker.department ?? worker.supervisoryOrganization ?? undefined,
            managerId: worker.manager?.id ?? undefined,
          });
        }

        hasMore = workers.length === 100;
        offset += 100;
      }
    } catch (err) {
      errors.push({
        resource: "workers",
        message: err instanceof Error ? err.message : String(err),
        recoverable: false,
      });
    }

    logger.info({ employees: employees.length }, "workday: employees fetched");
    return { employees, errors };
  }
}

function mapStatus(status: string | undefined): HREmployee["status"] {
  if (!status) return "active";
  const lower = status.toLowerCase();
  if (lower.includes("terminated") || lower.includes("inactive")) return "terminated";
  if (lower.includes("leave")) return "inactive";
  return "active";
}
