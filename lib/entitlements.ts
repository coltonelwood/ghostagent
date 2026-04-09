import type { Organization } from "./types/platform";

export interface PlanLimits {
  maxAssets: number;
  maxConnectors: number;
  frameworks: string[] | "all";
  apiAccess: boolean;
  sso: boolean;
  multiUser: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  starter: {
    maxAssets: 50,
    maxConnectors: 3,
    frameworks: ["eu_ai_act"],
    apiAccess: false,
    sso: false,
    multiUser: true,
  },
  professional: {
    maxAssets: 500,
    maxConnectors: -1,
    frameworks: "all",
    apiAccess: true,
    sso: false,
    multiUser: true,
  },
  enterprise: {
    maxAssets: -1,
    maxConnectors: -1,
    frameworks: "all",
    apiAccess: true,
    sso: true,
    multiUser: true,
  },
};

export function getPlanLimits(org: Organization): PlanLimits {
  return PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.starter;
}

export function canAddConnector(org: Organization, currentCount: number): boolean {
  const limits = getPlanLimits(org);
  if (limits.maxConnectors === -1) return true;
  return currentCount < limits.maxConnectors;
}

export function canAddAsset(org: Organization, currentCount: number): boolean {
  const limits = getPlanLimits(org);
  if (limits.maxAssets === -1) return true;
  return currentCount < limits.maxAssets;
}

export function canAccessFramework(org: Organization, frameworkCode: string): boolean {
  const limits = getPlanLimits(org);
  if (limits.frameworks === "all") return true;
  return (limits.frameworks as string[]).includes(frameworkCode);
}

export class EntitlementError extends Error {
  code = "ENTITLEMENT_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "EntitlementError";
  }
}
