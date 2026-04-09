import type { Connector, SyncResult, HRSyncResult, HREmployee } from "../types/platform";
import type { NexusHRConnector } from "./base";
import { logger } from "../logger";

export class BambooHRConnector implements NexusHRConnector {
  kind = "bamboohr" as const;
  displayName = "BambooHR";
  description = "Sync employee data for ownership verification and offboarding detection";
  category = "hr" as const;
  icon = "users";

  private getBase(credentials: Record<string, string>): string {
    return `https://api.bamboohr.com/api/gateway.php/${credentials.subdomain}/v1`;
  }

  private getHeaders(credentials: Record<string, string>) {
    const encoded = Buffer.from(`${credentials.apiKey}:x`).toString("base64");
    return { Authorization: `Basic ${encoded}`, Accept: "application/json" };
  }

  async validate(credentials: Record<string, string>) {
    try {
      const res = await fetch(`${this.getBase(credentials)}/employees/directory`, {
        headers: this.getHeaders(credentials),
      });
      if (!res.ok) throw new Error(`BambooHR returned ${res.status}`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sync(_connector: Connector, credentials: Record<string, string>): Promise<SyncResult> {
    const { errors } = await this.fetchEmployees(credentials);
    return { assets: [], errors, metadata: { source: "bamboohr", note: "HR connector" } };
  }

  async fetchEmployees(credentials: Record<string, string>): Promise<HRSyncResult> {
    const employees: HREmployee[] = [];
    const errors: Array<{ resource: string; message: string; recoverable: boolean }> = [];

    try {
      const res = await fetch(`${this.getBase(credentials)}/employees/directory`, {
        headers: this.getHeaders(credentials),
      });
      if (!res.ok) throw new Error(`BambooHR returned ${res.status}`);

      const data = await res.json() as { employees: BambooEmployee[] };
      for (const emp of data.employees ?? []) {
        if (!emp.workEmail) continue;
        employees.push({
          email: emp.workEmail,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          status: "active", // directory only returns active employees
          department: emp.department ?? undefined,
        });
      }
    } catch (err) {
      errors.push({ resource: "directory", message: err instanceof Error ? err.message : String(err), recoverable: false });
    }

    logger.info({ employees: employees.length }, "bamboohr: employees fetched");
    return { employees, errors };
  }
}

interface BambooEmployee {
  id: string;
  firstName: string;
  lastName: string;
  workEmail?: string;
  department?: string;
  jobTitle?: string;
}
