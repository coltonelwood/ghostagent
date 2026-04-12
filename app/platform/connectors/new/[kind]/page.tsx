"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  CONNECTOR_DEFINITIONS,
} from "@/lib/connectors/base";
import type { ConnectorDefinition, ConnectorField } from "@/lib/types/platform";

type WizardStep = "auth" | "test" | "config" | "save";
const STEPS: { key: WizardStep; label: string }[] = [
  { key: "auth", label: "Credentials" },
  { key: "test", label: "Test Connection" },
  { key: "config", label: "Configuration" },
  { key: "save", label: "Save & Sync" },
];

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-2">
          <div
            className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
              i < currentIdx
                ? "bg-primary text-primary-foreground"
                : i === currentIdx
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < currentIdx ? (
              <CheckCircle className="size-4" />
            ) : (
              i + 1
            )}
          </div>
          <span
            className={`hidden text-sm sm:inline ${
              i === currentIdx ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {step.label}
          </span>
          {i < STEPS.length - 1 && (
            <div className="hidden h-px w-8 bg-border sm:block" />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ConnectorField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={field.key}>
          {field.label}
          {field.required && <span className="text-destructive"> *</span>}
        </Label>
        <textarea
          id={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.key}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={field.key}
        type={field.type === "password" ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}

export default function ConnectorSetupPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = use(params);
  const router = useRouter();

  const definition = CONNECTOR_DEFINITIONS.find(
    (d) => d.kind === kind,
  ) as ConnectorDefinition | undefined;

  const [step, setStep] = useState<WizardStep>("auth");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const [connectorName, setConnectorName] = useState(
    definition?.displayName ?? kind,
  );
  const [testResult, setTestResult] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message?: string;
  }>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!definition) {
    return (
      <div className="space-y-4">
        <Link
          href="/platform/connectors"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to Connectors
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Unknown connector type: {kind}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const updateCredential = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const canProceedAuth = definition.fields
    .filter((f) => f.required)
    .every((f) => credentials[f.key]?.trim());

  const handleTestConnection = async () => {
    setTestResult({ status: "testing" });
    setError(null);

    try {
      // First, create the connector to get an ID
      const createRes = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: connectorName,
          credentials,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        setTestResult({
          status: "error",
          message: errData.error ?? "Failed to create connector",
        });
        return;
      }

      const { data: connector } = await createRes.json();
      setConnectorId(connector.id);

      // Test the connection
      const testRes = await fetch(
        `/api/connectors/${connector.id}/test`,
        { method: "POST" },
      );
      const testData = await testRes.json();

      if (testRes.ok && testData.success) {
        setTestResult({ status: "success", message: "Connection verified!" });
      } else {
        // Test failed — clean up the orphaned connector record so it doesn't litter the DB
        await fetch(`/api/connectors/${connector.id}`, { method: "DELETE" }).catch(() => {});
        setConnectorId(null);
        setTestResult({
          status: "error",
          message: testData.error ?? "Connection test failed. Please check your credentials.",
        });
      }
    } catch {
      setTestResult({
        status: "error",
        message: "Network error. Please try again.",
      });
    }
  };

  const handleSave = async () => {
    if (!connectorId) return;
    setSaving(true);
    setError(null);

    try {
      // Update config if any
      if (Object.keys(config).length > 0) {
        await fetch(`/api/connectors/${connectorId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        });
      }

      // Trigger first sync
      await fetch(`/api/connectors/${connectorId}/sync`, {
        method: "POST",
      });

      router.push(`/platform/connectors/${connectorId}`);
    } catch {
      setError("Failed to save configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/platform/connectors"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to Connectors
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Connect {definition.displayName}
        </h1>
        <p className="text-muted-foreground">{definition.description}</p>
      </div>

      <StepIndicator currentStep={step} />

      {/* Step 1: Auth */}
      {step === "auth" && (
        <Card>
          <CardHeader>
            <CardTitle>Add your {definition.displayName} credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="connectorName">Connector Name</Label>
              <Input
                id="connectorName"
                value={connectorName}
                onChange={(e) => setConnectorName(e.target.value)}
                placeholder={definition.displayName}
              />
            </div>
            {definition.fields.map((field) => (
              <FieldInput
                key={field.key}
                field={field}
                value={credentials[field.key] ?? ""}
                onChange={(v) => updateCredential(field.key, v)}
              />
            ))}
            <div className="flex justify-end pt-2">
              <Button
                disabled={!canProceedAuth}
                onClick={() => setStep("test")}
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Test */}
      {step === "test" && (
        <Card>
          <CardHeader>
            <CardTitle>Verify connection to {definition.displayName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Spekris will attempt a live connection to {definition.displayName} using the credentials you provided. If it fails, nothing will be saved.
            </p>
            {testResult.status === "idle" && (
              <Button onClick={handleTestConnection}>
                Test Connection
              </Button>
            )}
            {testResult.status === "testing" && (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Testing connection...
              </div>
            )}
            {testResult.status === "success" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle className="size-4" />
                {testResult.message}
              </div>
            )}
            {testResult.status === "error" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  <XCircle className="size-4" />
                  {testResult.message}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTestResult({ status: "idle" });
                    setStep("auth");
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Fix Credentials
                </Button>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("auth")}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button
                disabled={testResult.status !== "success"}
                onClick={() => setStep("config")}
              >
                Next
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Config */}
      {step === "config" && (
        <Card>
          <CardHeader>
            <CardTitle>Additional settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {definition.configFields && definition.configFields.length > 0 ? (
              definition.configFields.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={config[field.key] ?? ""}
                  onChange={(v) => updateConfig(field.key, v)}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No additional configuration needed. You can proceed to save.
              </p>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("test")}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button onClick={() => setStep("save")}>
                Next
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Save */}
      {step === "save" && (
        <Card>
          <CardHeader>
            <CardTitle>Review and save</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connector</span>
                <span className="text-sm font-medium">{connectorName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <Badge variant="outline">{definition.displayName}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Connection
                </span>
                <Badge variant="secondary">
                  <CheckCircle className="mr-1 size-3" />
                  Verified
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Saving will trigger the first sync. This may take a few minutes
              depending on the size of your environment.
            </p>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("config")}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save & Sync"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
