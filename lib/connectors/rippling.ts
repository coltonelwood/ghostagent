import type { Connector, SyncResult, HRSyncResult, HREmployee } from "../types/platform";
import type { NexusConnector, NexusHRConnector } from "./base";
import { logger } from "../logger";

export class RipplingConnector implements NexusHRConnector {
  kind = "rippling" as const;
  displayName = "Rippling";
  description = "Sync employee data for ownership verification and offboarding detection";
  category = "hr" as const;
  icon = "users";

  async validate(credentials: Record<string, string>) {
    try {
      const res = await fetch("https://api.rippling.com/platform/api/me", {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
      });
      if (!res.ok) throw new Error(`Rippling returned ${res.status}`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // HR connectors return no assets — they provide employee lists for ownership engine
  async sync(_connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const { errors } = await this.fetchEmployees(credentials);
    return { assets: [], errors, metadata: { source: "rippling", note: "HR connector — employees synced to ownership engine" } };
  }

  async fetchEmployees(credentials: Record<string, string>): Promise<HRSyncResult> {
    const employees: HREmployee[] = [];
    const errors: Array<{ resource: string; message: string; recoverable: boolean }> = [];

    try {
      const res = await fetch("https://api.rippling.com/platform/api/employees?employment_type=EMPLOYEE&status=ACTIVE", {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
      });

      if (!res.ok) throw new Error(`Rippling returned ${res.status}`);
      const data = await res.json() as RipplingEmployee[];

      for (const emp of data) {
        if (!emp.work_email) continue;
        employees.push({
          email: emp.work_email,
          name: `${emp.first_name} ${emp.last_name}`.trim(),
          status: emp.employment_status === "ACTIVE" ? "active" : "inactive",
          department: emp.department?.name,
        });
      }
    } catch (err) {
      errors.push({ resource: "employees", message: err instanceof Error ? err.message : String(err), recoverable: false });
    }

    logger.info({ employees: employees.length }, "rippling: employees fetched");
    return { employees, errors };
  }
}

interface RipplingEmployee {
  id: string;
  first_name: string;
  last_name: string;
  work_email?: string;
  employment_status: string;
  department?: { name: string };
}
