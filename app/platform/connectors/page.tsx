"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plug,
  Plus,
  CheckCircle,
  XCircle,
  Pause,
  Clock,
  RefreshCw,
} from "lucide-react";

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

const CONNECTOR_INFO: Record<string, { displayName: string; category: string }> = {
  github: { displayName: "GitHub", category: "Code" },
  gitlab: { displayName: "GitLab", category: "Code" },
  bitbucket: { displayName: "Bitbucket", category: "Code" },
  aws: { displayName: "AWS", category: "Cloud" },
  gcp: { displayName: "Google Cloud", category: "Cloud" },
  azure: { displayName: "Azure", category: "Cloud" },
  zapier: { displayName: "Zapier", category: "Automation" },
  n8n: { displayName: "n8n", category: "Automation" },
  make: { displayName: "Make", category: "Automation" },
  rippling: { displayName: "Rippling", category: "HR" },
  bamboohr: { displayName: "BambooHR", category: "HR" },
  workday: { displayName: "Workday", category: "HR" },
  sdk: { displayName: "Internal SDK", category: "Internal" },
  slack: { displayName: "Slack", category: "Internal" },
  webhook: { displayName: "Webhook", category: "Internal" },
};

const ALL_KINDS = Object.keys(CONNECTOR_INFO);

const STATUS_ICON: Record<string, React.ReactNode> = {
  active: <CheckCircle className="size-4 text-green-500" />,
  error: <XCircle className="size-4 text-red-500" />,
  paused: <Pause className="size-4 text-yellow-500" />,
  pending: <Clock className="size-4 text-muted-foreground" />,
};

function ConnectorCard({ connector }: { connector: ConnectorData }) {
  const info = CONNECTOR_INFO[connector.kind];
  return (
    <Link href={`/platform/connectors/${connector.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="size-5 text-primary" />
              <span className="font-medium">
                {connector.name || info?.displayName || connector.kind}
              </span>
            </div>
            {STATUS_ICON[connector.status] ?? null}
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{info?.category ?? "Other"}</Badge>
            <Badge variant="outline" className="capitalize">
              {connector.status}
            </Badge>
          </div>
          {connector.last_sync_at && (
            <p className="text-xs text-muted-foreground">
              Last sync: {new Date(connector.last_sync_at).toLocaleDateString()}
              {connector.last_sync_asset_count !== null &&
                ` -- ${connector.last_sync_asset_count} assets`}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function AvailableConnectorCard({ kind }: { kind: string }) {
  const info = CONNECTOR_INFO[kind];
  return (
    <Link href={`/platform/connectors/new/${kind}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer border-dashed h-full">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
          <Plus className="size-8 text-muted-foreground" />
          <span className="font-medium">{info?.displayName ?? kind}</span>
          <Badge variant="outline">{info?.category ?? "Other"}</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((res) => setConnectors(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const connectedKinds = new Set(connectors.map((c) => c.kind));
  const availableKinds = ALL_KINDS.filter((k) => !connectedKinds.has(k));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connectors</h1>
        <p className="text-muted-foreground">
          Connect data sources to discover and monitor AI assets across your
          organization.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Connected connectors */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Connected</h2>
            {connectors.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Plug className="mx-auto size-10 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">
                    No connectors yet
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your first connector below to start discovering AI
                    assets.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {connectors.map((c) => (
                  <ConnectorCard key={c.id} connector={c} />
                ))}
              </div>
            )}
          </section>

          {/* Available connectors */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Available</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {availableKinds.map((kind) => (
                <AvailableConnectorCard key={kind} kind={kind} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
