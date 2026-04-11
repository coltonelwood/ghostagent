"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  PolicyConditionGroup,
  PolicyRule,
} from "@/lib/types/platform";

// ---- Field definitions ----

type FieldType = "string" | "number" | "select";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

const FIELD_DEFS: FieldDef[] = [
  { key: "owner_status", label: "Owner Status", type: "select", options: ["active_owner", "inactive_owner", "unknown_owner", "orphaned", "reassignment_pending", "reviewed_unassigned"] },
  { key: "risk_level", label: "Risk Level", type: "select", options: ["low", "medium", "high", "critical"] },
  { key: "risk_score", label: "Risk Score", type: "number" },
  { key: "source", label: "Source", type: "string" },
  { key: "environment", label: "Environment", type: "select", options: ["production", "staging", "development", "unknown"] },
  { key: "data_classification", label: "Data Classification", type: "string" },
  { key: "days_since_review", label: "Days Since Review", type: "number" },
  { key: "tags", label: "Tags", type: "string" },
  { key: "kind", label: "Kind", type: "select", options: ["agent", "pipeline", "workflow", "function", "script", "model", "integration", "api", "sdk_reported", "unknown"] },
  { key: "status", label: "Status", type: "select", options: ["active", "inactive", "quarantined", "archived", "decommissioned"] },
];

type Op = PolicyRule["op"];

const STRING_OPS: { value: Op; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "in", label: "in" },
  { value: "not_in", label: "not in" },
  { value: "is_null", label: "is empty" },
  { value: "is_not_null", label: "is not empty" },
];

const NUMBER_OPS: { value: Op; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
];

const SELECT_OPS: { value: Op; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "in" },
  { value: "not_in", label: "not in" },
];

function getOpsForField(fieldKey: string): { value: Op; label: string }[] {
  const def = FIELD_DEFS.find((f) => f.key === fieldKey);
  if (!def) return STRING_OPS;
  switch (def.type) {
    case "number":
      return NUMBER_OPS;
    case "select":
      return SELECT_OPS;
    default:
      return STRING_OPS;
  }
}

function getFieldDef(fieldKey: string): FieldDef | undefined {
  return FIELD_DEFS.find((f) => f.key === fieldKey);
}

function isRule(item: PolicyRule | PolicyConditionGroup): item is PolicyRule {
  return "field" in item;
}

// ---- Props ----

interface PolicyBuilderProps {
  value: PolicyConditionGroup;
  onChange: (value: PolicyConditionGroup) => void;
  className?: string;
}

// ---- Component ----

export function PolicyBuilder({
  value,
  onChange,
  className,
}: PolicyBuilderProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ConditionGroupEditor
        group={value}
        onChange={onChange}
        depth={0}
      />
    </div>
  );
}

// ---- Condition Group ----

interface ConditionGroupEditorProps {
  group: PolicyConditionGroup;
  onChange: (group: PolicyConditionGroup) => void;
  onRemove?: () => void;
  depth: number;
}

function ConditionGroupEditor({
  group,
  onChange,
  onRemove,
  depth,
}: ConditionGroupEditorProps) {
  const toggleOperator = () => {
    onChange({ ...group, operator: group.operator === "AND" ? "OR" : "AND" });
  };

  const addRule = () => {
    const newRule: PolicyRule = {
      field: "risk_level",
      op: "eq",
      value: "",
    };
    onChange({ ...group, rules: [...group.rules, newRule] });
  };

  const addGroup = () => {
    const newGroup: PolicyConditionGroup = {
      operator: "AND",
      rules: [{ field: "risk_level", op: "eq", value: "" }],
    };
    onChange({ ...group, rules: [...group.rules, newGroup] });
  };

  const updateItem = (
    index: number,
    updated: PolicyRule | PolicyConditionGroup,
  ) => {
    const next = [...group.rules];
    next[index] = updated;
    onChange({ ...group, rules: next });
  };

  const removeItem = (index: number) => {
    const next = group.rules.filter((_, i) => i !== index);
    onChange({ ...group, rules: next });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border p-3",
        depth > 0 && "ml-4 border-dashed bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggleOperator}
          className="inline-flex h-6 items-center rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          {group.operator}
        </button>
        <div className="flex items-center gap-1">
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              aria-label="Remove group"
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {group.rules.map((item, index) => (
        <div key={index}>
          {index > 0 && (
            <div className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-medium uppercase text-muted-foreground">
                {group.operator}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          {isRule(item) ? (
            <RuleEditor
              rule={item}
              onChange={(r) => updateItem(index, r)}
              onRemove={() => removeItem(index)}
            />
          ) : (
            <ConditionGroupEditor
              group={item}
              onChange={(g) => updateItem(index, g)}
              onRemove={() => removeItem(index)}
              depth={depth + 1}
            />
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={addRule}
        >
          <Plus className="size-3" />
          Add rule
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={addGroup}
        >
          <Plus className="size-3" />
          Add group
        </Button>
      </div>
    </div>
  );
}

// ---- Rule Editor ----

interface RuleEditorProps {
  rule: PolicyRule;
  onChange: (rule: PolicyRule) => void;
  onRemove: () => void;
}

function RuleEditor({ rule, onChange, onRemove }: RuleEditorProps) {
  const ops = getOpsForField(rule.field);
  const fieldDef = getFieldDef(rule.field);
  const isNullOp = rule.op === "is_null" || rule.op === "is_not_null";

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newField = e.target.value;
    const newOps = getOpsForField(newField);
    const opValid = newOps.some((o) => o.value === rule.op);
    onChange({
      ...rule,
      field: newField,
      op: opValid ? rule.op : newOps[0].value,
      value: "",
    });
  };

  const handleOpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOp = e.target.value as Op;
    const nextValue =
      newOp === "is_null" || newOp === "is_not_null" ? null : rule.value;
    onChange({ ...rule, op: newOp, value: nextValue });
  };

  const handleValueChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    onChange({ ...rule, value: e.target.value });
  };

  return (
    <div className="flex items-center gap-2">
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/50" />

      {/* Field */}
      <select
        value={rule.field}
        onChange={handleFieldChange}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {FIELD_DEFS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={rule.op}
        onChange={handleOpChange}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {ops.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Value */}
      {!isNullOp && (
        <>
          {fieldDef?.options ? (
            <select
              value={String(rule.value ?? "")}
              onChange={handleValueChange}
              className="h-8 min-w-[120px] flex-1 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">Select...</option>
              {fieldDef.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={fieldDef?.type === "number" ? "number" : "text"}
              value={String(rule.value ?? "")}
              onChange={handleValueChange}
              placeholder="Value"
              className="min-w-[120px] flex-1"
            />
          )}
        </>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label="Remove rule"
      >
        <Trash2 className="size-3.5 text-destructive" />
      </Button>
    </div>
  );
}
