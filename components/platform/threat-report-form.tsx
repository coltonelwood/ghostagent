"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldAlert,
  Mail,
  Key,
  Bug,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe,
  Code,
  Smartphone,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

const THREAT_TYPES = [
  { id: "phishing", label: "Phishing", icon: Mail },
  { id: "bec", label: "Business Email Compromise", icon: Mail },
  { id: "credential_stuffing", label: "Credential Stuffing", icon: Key },
  { id: "ransomware", label: "Ransomware", icon: Bug },
  { id: "supply_chain", label: "Supply Chain Attack", icon: Globe },
  { id: "zero_day", label: "Zero-Day Exploit", icon: Code },
  { id: "social_engineering", label: "Social Engineering", icon: Smartphone },
  { id: "ddos", label: "DDoS Attack", icon: Server },
] as const;

type ThreatTypeId = (typeof THREAT_TYPES)[number]["id"];

const SEVERITY_LEVELS = ["critical", "high", "medium", "low"] as const;
type Severity = (typeof SEVERITY_LEVELS)[number];

const severityColors: Record<
  Severity,
  string
> = {
  critical:
    "border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20",
  high: "border-destructive/60 bg-destructive/5 text-destructive hover:bg-destructive/15",
  medium:
    "border-warning bg-warning/10 text-warning hover:bg-warning/20",
  low: "border-border bg-muted text-muted-foreground hover:bg-muted/80",
};

interface ReportResult {
  id: string;
  fingerprint: string;
  type: string;
  severity: string;
  created_at: string;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export function ThreatReportForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  // Step 1
  const [threatType, setThreatType] = useState<ThreatTypeId | null>(null);

  // Step 2
  const [indicators, setIndicators] = useState("");
  const [timeline, setTimeline] = useState("");
  const [narrative, setNarrative] = useState("");

  // Step 3
  const [severity, setSeverity] = useState<Severity | null>(null);

  function canProceed() {
    if (step === 1) return threatType !== null;
    if (step === 2) return indicators.trim().length > 0;
    if (step === 3) return true;
    return false;
  }

  async function handleSubmit() {
    if (!threatType) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: threatType,
          indicators: indicators.trim(),
          timeline: timeline.trim(),
          narrative: narrative.trim(),
          severity: severity ?? "medium",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResult(json.data ?? null);
        setStep(4);
        toast.success("Threat report submitted successfully");
      } else {
        const json = await res.json();
        toast.error(json.error ?? "Failed to submit threat report");
      }
    } catch {
      toast.error("Failed to submit threat report");
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------------------------------------------------------
  // Step 4: Success
  // --------------------------------------------------------------------------

  if (step === 4 && result) {
    return (
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center py-8">
            <div className="flex size-14 items-center justify-center rounded-full bg-success/10 mb-4">
              <CheckCircle2 className="size-7 text-success" />
            </div>
            <h3 className="text-lg font-semibold">Threat Reported</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Your threat report has been submitted and a behavioral fingerprint
              has been generated.
            </p>

            <div className="mt-6 w-full max-w-sm rounded-lg border border-border p-4 text-left">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Report ID
                  </span>
                  <span className="text-xs font-mono">{result.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Fingerprint
                  </span>
                  <span className="text-xs font-mono truncate max-w-[180px]">
                    {result.fingerprint}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <span className="text-xs capitalize">{result.type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Severity
                  </span>
                  <Badge
                    variant={
                      result.severity === "critical" ||
                      result.severity === "high"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {result.severity}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/platform/threats")}
              >
                <ArrowLeft className="size-3.5" />
                Back to Threats
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setStep(1);
                  setThreatType(null);
                  setIndicators("");
                  setTimeline("");
                  setNarrative("");
                  setSeverity(null);
                  setResult(null);
                }}
              >
                Report Another
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --------------------------------------------------------------------------
  // Steps 1-3
  // --------------------------------------------------------------------------

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  s
                )}
              </div>
              {s < 3 && (
                <div
                  className={`h-px w-8 ${
                    step > s ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <CardTitle>
          {step === 1 && "Select Threat Type"}
          {step === 2 && "Threat Details"}
          {step === 3 && "Set Severity"}
        </CardTitle>
        <CardDescription>
          {step === 1 && "Choose the type of threat you have observed."}
          {step === 2 &&
            "Provide indicators, timeline, and a narrative of the threat."}
          {step === 3 &&
            "Optionally set the severity level for this threat report."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Step 1: Threat type selection */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {THREAT_TYPES.map((tt) => {
              const Icon = tt.icon;
              const selected = threatType === tt.id;
              return (
                <button
                  key={tt.id}
                  type="button"
                  onClick={() => setThreatType(tt.id)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <Icon
                    className={`size-5 shrink-0 ${
                      selected
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      selected ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {tt.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Indicators of Compromise
              </label>
              <textarea
                value={indicators}
                onChange={(e) => setIndicators(e.target.value)}
                placeholder="Enter IOCs — IPs, domains, file hashes, URLs (one per line)"
                rows={4}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Timeline
              </label>
              <Input
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="e.g., First observed 2026-04-10 14:30 UTC"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Narrative
              </label>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Describe the threat — what happened, how it was detected, affected systems..."
                rows={4}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Step 3: Severity */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a severity level. If unsure, leave it as medium and the
              analysis engine will adjust based on the indicators.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {SEVERITY_LEVELS.map((s) => {
                const selected = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`rounded-lg border p-3 text-center text-sm font-medium capitalize transition-colors ${
                      selected
                        ? severityColors[s] + " ring-1 ring-current"
                        : "border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={step === 1}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>

        {step < 3 ? (
          <Button
            size="sm"
            disabled={!canProceed()}
            onClick={() => setStep((s) => s + 1)}
          >
            Next
            <ArrowRight className="size-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldAlert className="size-3.5" />
            )}
            Submit Report
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
