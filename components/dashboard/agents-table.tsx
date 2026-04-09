"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Agent } from "@/lib/types";

const riskColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

export function AgentsTable({ agents }: { agents: Agent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ghost Agents Found</CardTitle>
        <CardDescription>
          AI agents detected in your organization&apos;s repositories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Repository</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Days Stale</TableHead>
              <TableHead>Services</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {agent.file_path}
                    </div>
                    {agent.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {agent.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {agent.repo}
                </TableCell>
                <TableCell>
                  <div>
                    <div className="text-sm">{agent.owner_github ?? "Unknown"}</div>
                    {agent.owner_email && (
                      <div className="text-xs text-muted-foreground">
                        {agent.owner_email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{agent.agent_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={riskColors[agent.risk_level] ?? ""}>
                    {agent.risk_level}
                  </Badge>
                  {agent.risk_reason && (
                    <div className="text-xs text-muted-foreground mt-1 max-w-[150px]">
                      {agent.risk_reason}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {agent.days_since_commit != null ? (
                    <span
                      className={
                        agent.days_since_commit > 90
                          ? "font-semibold text-red-600"
                          : agent.days_since_commit > 30
                            ? "text-orange-500"
                            : ""
                      }
                    >
                      {agent.days_since_commit}d
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {agent.services.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                    {agent.has_secrets && (
                      <Badge variant="destructive" className="text-xs">
                        SECRETS
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
