// ---------------------------------------------------------------------------
// Built-in compliance framework definitions
// These mirror the rows seeded into the compliance_frameworks table
// (supabase/migrations/006_nexus_platform.sql).
// ---------------------------------------------------------------------------

import type { ComplianceControl } from "@/lib/types/platform";

export interface FrameworkDefinition {
  code: string;
  name: string;
  version: string;
  description: string;
  controls: ComplianceControl[];
}

// ---------------------------------------------------------------------------
// EU AI Act
// ---------------------------------------------------------------------------

export const EU_AI_ACT: FrameworkDefinition = {
  code: "eu_ai_act",
  name: "EU AI Act",
  version: "2024",
  description:
    "European Union Artificial Intelligence Act — key governance controls",
  controls: [
    {
      id: "EUAI-ART-9",
      name: "Risk Management System",
      description:
        "Maintain risk management documentation for all high-risk AI systems",
      category: "risk",
      required: true,
    },
    {
      id: "EUAI-ART-10",
      name: "Data Governance",
      description:
        "AI training data must meet quality criteria and governance requirements",
      category: "data",
      required: true,
    },
    {
      id: "EUAI-ART-11",
      name: "Technical Documentation",
      description:
        "Maintain technical documentation for each AI system before placing on market",
      category: "documentation",
      required: true,
    },
    {
      id: "EUAI-ART-12",
      name: "Record Keeping",
      description:
        "Automatic logging of events for high-risk AI systems",
      category: "logging",
      required: true,
    },
    {
      id: "EUAI-ART-13",
      name: "Transparency",
      description:
        "AI systems must be interpretable and explainable to users",
      category: "transparency",
      required: true,
    },
    {
      id: "EUAI-ART-14",
      name: "Human Oversight",
      description:
        "Human oversight mechanisms must be built into AI systems",
      category: "oversight",
      required: true,
    },
    {
      id: "EUAI-ART-17",
      name: "Quality Management",
      description:
        "Quality management system must be established for high-risk AI",
      category: "governance",
      required: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// SOC 2 AI Controls
// ---------------------------------------------------------------------------

export const SOC2_AI: FrameworkDefinition = {
  code: "soc2_ai",
  name: "SOC 2 AI Controls",
  version: "2023",
  description:
    "SOC 2 controls relevant to AI system management",
  controls: [
    {
      id: "CC6.6",
      name: "Logical Access Controls",
      description:
        "AI systems implement logical access restrictions and least-privilege",
      category: "access",
      required: true,
    },
    {
      id: "CC7.1",
      name: "System Operations",
      description:
        "AI systems are monitored for anomalies and unauthorized activity",
      category: "monitoring",
      required: true,
    },
    {
      id: "CC7.2",
      name: "Security Incidents",
      description:
        "AI-related security incidents are identified, tracked, and remediated",
      category: "incidents",
      required: true,
    },
    {
      id: "CC8.1",
      name: "Change Management",
      description:
        "AI system changes follow documented change management processes",
      category: "change",
      required: true,
    },
    {
      id: "A1.2",
      name: "Availability",
      description:
        "AI system availability is monitored and documented with SLAs",
      category: "availability",
      required: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// ISO/IEC 42001:2023
// ---------------------------------------------------------------------------

export const ISO42001: FrameworkDefinition = {
  code: "iso42001",
  name: "ISO/IEC 42001:2023",
  version: "2023",
  description:
    "International standard for AI management systems",
  controls: [
    {
      id: "4.1",
      name: "Context of the Organization",
      description:
        "Understand internal and external context for AI system deployment",
      category: "context",
      required: true,
    },
    {
      id: "5.2",
      name: "AI Policy",
      description:
        "Top management establishes and communicates AI policy",
      category: "governance",
      required: true,
    },
    {
      id: "6.1",
      name: "Risk Assessment",
      description:
        "AI risks are systematically identified and assessed",
      category: "risk",
      required: true,
    },
    {
      id: "8.4",
      name: "AI System Impact Assessment",
      description:
        "Impact assessment performed before deploying AI systems",
      category: "impact",
      required: true,
    },
    {
      id: "9.1",
      name: "Monitoring and Measurement",
      description:
        "AI systems are monitored against defined objectives",
      category: "monitoring",
      required: true,
    },
    {
      id: "10.2",
      name: "Nonconformity and Corrective Action",
      description:
        "Nonconformities are corrected and root causes addressed",
      category: "remediation",
      required: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// NIST AI Risk Management Framework
// ---------------------------------------------------------------------------

export const NIST_AI_RMF: FrameworkDefinition = {
  code: "nist_ai_rmf",
  name: "NIST AI Risk Management Framework",
  version: "1.0",
  description:
    "NIST AI RMF — Govern, Map, Measure, Manage",
  controls: [
    {
      id: "GOVERN-1",
      name: "Governance Policies",
      description:
        "AI risk governance policies and accountability are established",
      category: "govern",
      required: true,
    },
    {
      id: "GOVERN-2",
      name: "AI Accountability",
      description:
        "Organizational roles and responsibilities for AI are defined",
      category: "govern",
      required: true,
    },
    {
      id: "MAP-1",
      name: "AI Context",
      description:
        "Organizational context for AI risk is identified and mapped",
      category: "map",
      required: true,
    },
    {
      id: "MAP-3",
      name: "AI Categorization",
      description:
        "AI systems are categorized by use case, risk, and impact",
      category: "map",
      required: true,
    },
    {
      id: "MEASURE-2",
      name: "Risk Measurement",
      description:
        "AI risks are measured, documented, and tracked over time",
      category: "measure",
      required: true,
    },
    {
      id: "MANAGE-1",
      name: "Risk Response",
      description:
        "Identified risks are prioritized and responded to appropriately",
      category: "manage",
      required: true,
    },
    {
      id: "MANAGE-3",
      name: "Remediation",
      description:
        "Identified risks have documented remediation plans",
      category: "manage",
      required: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Aggregate list & lookup helper
// ---------------------------------------------------------------------------

export const BUILTIN_FRAMEWORKS: FrameworkDefinition[] = [
  EU_AI_ACT,
  SOC2_AI,
  ISO42001,
  NIST_AI_RMF,
];

export function getFrameworkByCode(
  code: string,
): FrameworkDefinition | undefined {
  return BUILTIN_FRAMEWORKS.find((f) => f.code === code);
}
