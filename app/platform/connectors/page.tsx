"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Plug,
  RefreshCw,
  ArrowRight,
  Code,
  Cloud,
  Zap,
  Users,
  Box,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { connectorStatusMeta } from "@/lib/design/status";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------
// Connector metadata
// --------------------------------------------------------------------------

interface ConnectorData {
  id: string;
  kind: string;
  name: string;
  status: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_asset_count: number | null;
  enabled: boolean;
  created_at: string;
}

interface ConnectorKind {
  displayName: string;
  category: "Code" | "Cloud" | "Automation" | "HR" | "Internal";
  blurb: string;
}

const CONNECTOR_INFO: Record<string, ConnectorKind> = {
  github: {
    displayName: "GitHub",
    category: "Code",
    blurb: "Scan repositories for AI-related code and integrations.",
  },
  gitlab: {
    displayName: "GitLab",
    category: "Code",
    blurb: "Scan GitLab projects for AI-related code and pipelines.",
  },
  bitbucket: {
    displayName: "Bitbucket",
    category: "Code",
    blurb: "Scan Bitbucket repositories for AI agent code.",
  },
  aws: {
    displayName: "AWS",
    category: "Cloud",
    blurb: "Discover Lambda, Bedrock, SageMaker, and Step Functions usage.",
  },
  gcp: {
    displayName: "Google Cloud",
    category: "Cloud",
    blurb: "Discover Cloud Functions, Vertex AI, and Cloud Run workloads.",
  },
  azure: {
    displayName: "Azure",
    category: "Cloud",
    blurb: "Discover Azure Functions, OpenAI, and Logic Apps.",
  },
  zapier: {
    displayName: "Zapier",
    category: "Automation",
    blurb: "Discover AI-powered Zaps across your Zapier account.",
  },
  n8n: {
    displayName: "n8n",
    category: "Automation",
    blurb: "Discover AI workflows in your n8n instance.",
  },
  make: {
    displayName: "Make",
    category: "Automation",
    blurb: "Discover AI scenarios in your Make (Integromat) account.",
  },
  rippling: {
    displayName: "Rippling",
    category: "HR",
    blurb: "Cross-reference employee data for ownership verification.",
  },
  bamboohr: {
    displayName: "BambooHR",
    category: "HR",
    blurb: "Cross-reference employee data for ownership verification.",
  },
  workday: {
    displayName: "Workday",
    category: "HR",
    blurb: "Cross-reference employee data for ownership verification.",
  },
  sdk: {
    displayName: "Internal SDK",
    category: "Internal",
    blurb: "Self-report AI systems from your own codebase.",
  },
  slack: {
    displayName: "Slack",
    category: "Internal",
    blurb: "Route alerts and violations into Slack channels.",
  },
  webhook: {
    displayName: "Webhook",
    category: "Internal",
    blurb: "Pipe events to any HTTPS endpoint.",
  },
};

const CATEGORY_ICON: Record<ConnectorKind["category"], React.ComponentType<{ className?: string }>> = {
  Code: Code,
  Cloud: Cloud,
  Automation: Zap,
  HR: Users,
  Internal: Box,
};

const ALL_KINDS = Object.keys(CONNECTOR_INFO);

// --------------------------------------------------------------------------
// Connector card (connected)
// --------------------------------------------------------------------------

function ConnectedCard({ connector }: { connector: ConnectorData }) {
  const info = CONNECTOR_INFO[connector.kind];
  const meta = connectorStatusMeta(connector.status);
  const Icon = info ? CATEGORY_ICON[info.category] : Plug;

  return (
    <Link
      href={`/platform/connectors/${connector.id}`}
      className="nx-surface group flex flex-col gap-4 p-4 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">
              {connector.name || info?.displayName || connector.kind}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {info?.category ?? "Other"}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px]">
          <span className={cn("size-1.5 rounded-full", meta.dotClass)} aria-hidden />
          <span className={meta.textClass}>{meta.label}</span>
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="nx-tabular">
          {connector.last_sync_asset_count ?? 0} assets
        </span>
        <span className="nx-tabular">
          {connector.last_sync_at
            ? `Synced ${formatRelative(connector.last_sync_at)}`
            : "Not synced"}
        </span>
      </div>
    </Link>
  );
}

// --------------------------------------------------------------------------
// Available connector card (dashed)
// --------------------------------------------------------------------------

function AvailableCard({ kind }: { kind: string }) {
  const info = CONNECTOR_INFO[kind];
  if (!info) return null;
  const Icon = CATEGORY_ICON[info.category];

  return (
    <Link
      href={`/platform/connectors/new/${kind}`}
      className="group flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 transition-colors hover:border-border-strong hover:bg-muted/30"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">{info.displayName}</p>
          <p className="text-[11px] text-muted-foreground">{info.category}</p>
        </div>
      </div>
      <p className="text-[12px] leading-snug text-muted-foreground line-clamp-2">
        {info.blurb}
      </p>
      <div className="mt-auto flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Connect
        <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}

// --------------------------------------------------------------------------
// Main page
// --------------------------------------------------------------------------

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((res) => setConnectors(res.data ?? []))
      .catch(() => {
        /* handled by error state */
      })
      .finally(() => setLoading(false));
  }, []);

  const connectedKinds = new Set(connectors.map((c) => c.kind));
  const available = ALL_KINDS.filter((k) => !connectedKinds.has(k));

  // Group available by category
  const grouped = available.reduce<Record<string, string[]>>((acc, kind) => {
    const cat = CONNECTOR_INFO[kind]?.category ?? "Internal";
    (acc[cat] ??= []).push(kind);
    return acc;
  }, {});

  const categories: ConnectorKind["category"][] = [
    "Code",
    "Cloud",
    "Automation",
    "HR",
    "Internal",
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description="Link sources so Spekris can discover, classify, and monitor every AI system in your stack."
        meta={
          connectors.length > 0 && (
            <>
              <span className="nx-tabular">{connectors.length}</span>
              <span>connected</span>
              <span>·</span>
              <span>{available.length} available</span>
            </>
          )
        }
      />

      {/* Connected */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Connected
          </h2>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="nx-surface h-[120px] animate-pulse bg-muted/30"
              />
            ))}
          </div>
        ) : connectors.length === 0 ? (
          <div className="nx-surface">
            <EmptyState
              icon={Plug}
              title="No sources connected yet"
              description="Add your first connector below. Credentials are encrypted with AES-256-GCM before storage and never returned to the client."
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connectors.map((c) => (
              <ConnectedCard key={c.id} connector={c} />
            ))}
          </div>
        )}
      </section>

      {/* Available by category */}
      {available.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Available
          </h2>

          {categories.map((cat) => {
            const kinds = grouped[cat];
            if (!kinds || kinds.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h3 className="text-[12px] font-medium text-foreground">{cat}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {kinds.map((kind) => (
                    <AvailableCard key={kind} kind={kind} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <p className="text-[11px] text-muted-foreground/70">
        Connector credentials are encrypted with AES-256-GCM before storage. We
        never return credentials to the client, and they are not included in
        audit logs or error messages.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
