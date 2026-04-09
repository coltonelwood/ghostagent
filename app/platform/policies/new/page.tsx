"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { PolicyRule, PolicyConditionGroup } from "@/lib/types/platform";

const FIELDS = [
  { value: "owner_status", label: "Owner Status" },
  { value: "risk_level", label: "Risk Level" },
  { value: "risk_score", label: "Risk Score (number)" },
  { value: "source", label: "Source" },
  { value: "environment", label: "Environment" },
  { value: "status", label: "Asset Status" },
  { value: "review_status", label: "Review Status" },
  { value: "days_since_review", label: "Days Since Review" },
  { value: "days_since_seen", label: "Days Since Last Seen" },
  { value: "data_classification", label: "Data Classification" },
  { value: "ai_provider", label: "AI Provider" },
];

const OPS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "gte", label: "greater than or equal" },
  { value: "lte", label: "less than or equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "is_null", label: "is empty" },
  { value: "is_not_null", label: "is not empty" },
];

const OWNER_STATUS_VALUES = ["orphaned", "inactive_owner", "unknown_owner", "active_owner", "reassignment_pending"];
const RISK_LEVELS = ["critical", "high", "medium", "low"];
const ENVIRONMENTS = ["production", "staging", "development", "unknown"];

const SOURCE_OPTIONS = ["github", "gitlab", "bitbucket", "aws", "gcp", "azure", "zapier", "n8n", "make", "sdk"];
const ACTION_TYPES = [
  { id: "notify_slack", label: "Notify Slack", description: "Send alert to Slack channel" },
  { id: "notify_email", label: "Notify Email", description: "Send email notification" },
  { id: "create_task", label: "Create Task", description: "Create a remediation task" },
  { id: "quarantine", label: "Quarantine Asset", description: "Quarantine the matching asset" },
  { id: "webhook", label: "Fire Webhook", description: "POST to an external webhook URL" },
];

function RuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: PolicyRule;
  onChange: (r: PolicyRule) => void;
  onRemove: () => void;
}) {
  const noValue = rule.op === "is_null" || rule.op === "is_not_null";

  const getValueOptions = () => {
    if (rule.field === "owner_status") return OWNER_STATUS_VALUES;
    if (rule.field === "risk_level") return RISK_LEVELS;
    if (rule.field === "environment") return ENVIRONMENTS;
    if (rule.field === "status") return ["active", "inactive", "quarantined", "archived"];
    if (rule.field === "review_status") return ["unreviewed", "in_review", "reviewed", "flagged"];
    return null;
  };

  const options = getValueOptions();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        className="px-2 py-1.5 border rounded text-sm bg-background"
        value={rule.field}
        onChange={(e) => onChange({ ...rule, field: e.target.value })}
      >
        {FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <select
        className="px-2 py-1.5 border rounded text-sm bg-background"
        value={rule.op}
        onChange={(e) => onChange({ ...rule, op: e.target.value as PolicyRule["op"] })}
      >
        {OPS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {!noValue && (
        options ? (
          <select
            className="px-2 py-1.5 border rounded text-sm bg-background"
            value={rule.value as string}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
          >
            <option value="">Select...</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <Input
            className="w-32 h-8 text-sm"
            value={(rule.value as string) ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...rule, value: isNaN(Number(v)) ? v : Number(v) });
            }}
            placeholder="value"
          />
        )
      )}

      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function NewPolicyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [operator, setOperator] = useState<"AND" | "OR">("AND");
  const [rules, setRules] = useState<PolicyRule[]>([
    { field: "owner_status", op: "eq", value: "orphaned" },
  ]);

  // Scope
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Actions
  const [selectedActions, setSelectedActions] = useState<Record<string, boolean>>({});
  const [actionConfigs, setActionConfigs] = useState<Record<string, string>>({});

  // Options
  const [dryRun, setDryRun] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Dry run preview
  const [previewing, setPreviewing] = useState(false);
  const [previewResults, setPreviewResults] = useState<Array<{ id: string; name: string; risk_level: string }> | null>(null);

  function addRule() {
    setRules([...rules, { field: "owner_status", op: "eq", value: "" }]);
  }

  function updateRule(i: number, rule: PolicyRule) {
    const next = [...rules];
    next[i] = rule;
    setRules(next);
  }

  function removeRule(i: number) {
    setRules(rules.filter((_, idx) => idx !== i));
  }

  function toggleSource(source: string) {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }

  function toggleEnvironment(env: string) {
    setSelectedEnvironments((prev) =>
      prev.includes(env) ? prev.filter((e) => e !== env) : [...prev, env]
    );
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function dryRunPreview() {
    setPreviewing(true);
    setPreviewResults(null);
    try {
      const conditions: PolicyConditionGroup = { operator, rules };
      const res = await fetch("/api/policies/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conditions,
          scope: {
            sources: selectedSources.length > 0 ? selectedSources : undefined,
            environments: selectedEnvironments.length > 0 ? selectedEnvironments : undefined,
            tags: tags.length > 0 ? tags : undefined,
          },
        }),
      });
      const data = await res.json();
      setPreviewResults(data.data ?? []);
    } catch {
      setPreviewResults([]);
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    if (!name) {
      setError("Policy name is required");
      return;
    }
    if (rules.length === 0) {
      setError("Add at least one condition");
      return;
    }

    setSaving(true);
    setError("");

    const conditions: PolicyConditionGroup = { operator, rules };

    const actions = Object.entries(selectedActions)
      .filter(([, enabled]) => enabled)
      .map(([type]) => ({
        type,
        config: actionConfigs[type] ? { value: actionConfigs[type] } : {},
      }));

    const res = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        severity,
        conditions,
        dry_run_mode: dryRun,
        scope: {
          sources: selectedSources.length > 0 ? selectedSources : undefined,
          environments: selectedEnvironments.length > 0 ? selectedEnvironments : undefined,
          tags: tags.length > 0 ? tags : undefined,
        },
        actions: actions.length > 0 ? actions : undefined,
      }),
    });

    const data = (await res.json()) as { data?: { id: string }; error?: string };

    if (!res.ok) {
      setError(data.error ?? "Failed to create policy");
      setSaving(false);
      return;
    }

    router.push(`/platform/policies/${data.data?.id}`);
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/platform/policies"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Policies
        </Link>
        <h1 className="text-2xl font-bold">New Policy</h1>
        <p className="text-muted-foreground mt-1">Define conditions that trigger alerts and actions</p>
      </div>

      {/* Policy Details */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Policy Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Orphaned Production Agents"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this policy detect?"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Severity</Label>
            <select
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              {["info", "low", "medium", "high", "critical"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Conditions</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Logic:</span>
              <select
                className="px-2 py-1 border rounded text-xs bg-background"
                value={operator}
                onChange={(e) => setOperator(e.target.value as "AND" | "OR")}
              >
                <option value="AND">ALL conditions (AND)</option>
                <option value="OR">ANY condition (OR)</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.map((rule, i) => (
            <RuleRow
              key={i}
              rule={rule}
              onChange={(r) => updateRule(i, r)}
              onRemove={() => removeRule(i)}
            />
          ))}
          <Button variant="outline" size="sm" onClick={addRule}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Condition
          </Button>
        </CardContent>
      </Card>

      {/* Scope */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Scope</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Sources</Label>
            <p className="text-xs text-muted-foreground">Limit this policy to assets from specific sources</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {SOURCE_OPTIONS.map((source) => (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedSources.includes(source)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Environments</Label>
            <p className="text-xs text-muted-foreground">Limit to specific environments</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {ENVIRONMENTS.map((env) => (
                <button
                  key={env}
                  onClick={() => toggleEnvironment(env)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedEnvironments.includes(env)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs gap-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-destructive">&times;</button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Select actions to take when a violation is detected.</p>
          {ACTION_TYPES.map((action) => (
            <div key={action.id} className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedActions[action.id] ?? false}
                  onChange={(e) =>
                    setSelectedActions({ ...selectedActions, [action.id]: e.target.checked })
                  }
                  className="rounded"
                />
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </label>
              {selectedActions[action.id] && action.id === "webhook" && (
                <Input
                  className="h-8 text-sm ml-7"
                  value={actionConfigs[action.id] ?? ""}
                  onChange={(e) =>
                    setActionConfigs({ ...actionConfigs, [action.id]: e.target.value })
                  }
                  placeholder="https://your-system.com/webhook"
                />
              )}
              {selectedActions[action.id] && action.id === "notify_email" && (
                <Input
                  className="h-8 text-sm ml-7"
                  value={actionConfigs[action.id] ?? ""}
                  onChange={(e) =>
                    setActionConfigs({ ...actionConfigs, [action.id]: e.target.value })
                  }
                  placeholder="alerts@company.com"
                />
              )}
              {selectedActions[action.id] && action.id === "notify_slack" && (
                <Input
                  className="h-8 text-sm ml-7"
                  value={actionConfigs[action.id] ?? ""}
                  onChange={(e) =>
                    setActionConfigs({ ...actionConfigs, [action.id]: e.target.value })
                  }
                  placeholder="#channel-name"
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Options</CardTitle></CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded"
            />
            <div>
              <p className="text-sm font-medium">Dry Run Mode</p>
              <p className="text-xs text-muted-foreground">
                Policy will detect violations but not take any actions
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Dry Run Preview */}
      <Button variant="outline" onClick={dryRunPreview} disabled={previewing || rules.length === 0}>
        {previewing ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running preview...</>
        ) : (
          <><Eye className="h-4 w-4 mr-2" />Dry Run Preview</>
        )}
      </Button>

      {previewResults !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Preview Results ({previewResults.length} affected asset{previewResults.length !== 1 ? "s" : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No assets match these conditions.
              </p>
            ) : (
              <div className="divide-y max-h-60 overflow-y-auto">
                {previewResults.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{asset.name}</span>
                    <Badge variant="outline" className="capitalize text-xs">{asset.risk_level}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
          ) : (
            "Create Policy"
          )}
        </Button>
        <LinkButton href="/platform/policies" variant="outline">Cancel</LinkButton>
      </div>
    </div>
  );
}
