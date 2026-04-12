"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  MessageSquare,
  Phone,
  Globe,
  TrendingUp,
  Monitor,
  Heart,
  UserX,
  Bug,
  HelpCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

const REPORT_TYPES = [
  { value: "phishing_email", label: "Phishing Email", icon: Mail, description: "Suspicious email trying to steal info" },
  { value: "scam_text", label: "Scam Text", icon: MessageSquare, description: "SMS/text message scam" },
  { value: "fraud_call", label: "Fraud Call", icon: Phone, description: "Suspicious phone call" },
  { value: "fake_website", label: "Fake Website", icon: Globe, description: "Website impersonating a real one" },
  { value: "investment_scam", label: "Investment Scam", icon: TrendingUp, description: "Fraudulent investment opportunity" },
  { value: "tech_support_scam", label: "Tech Support Scam", icon: Monitor, description: "Fake tech support contact" },
  { value: "romance_scam", label: "Romance Scam", icon: Heart, description: "Fake romantic interest asking for money" },
  { value: "impersonation", label: "Impersonation", icon: UserX, description: "Someone pretending to be someone else" },
  { value: "malware", label: "Malware", icon: Bug, description: "Suspicious software or download" },
  { value: "other", label: "Other", icon: HelpCircle, description: "Something else suspicious" },
] as const;

type Step = "type" | "details" | "submitting" | "done";

interface SubmitResult {
  id: string;
  ai_analysis?: Record<string, unknown>;
  matched_existing?: boolean;
  people_alerted?: number;
}

export function ThreatReportForm() {
  const [step, setStep] = useState<Step>("type");
  const [reportType, setReportType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [sender, setSender] = useState("");
  const [urls, setUrls] = useState("");
  const [result, setResult] = useState<SubmitResult | null>(null);

  function selectType(type: string) {
    setReportType(type);
    const typeDef = REPORT_TYPES.find((t) => t.value === type);
    setTitle(typeDef?.label ?? type);
    setStep("details");
  }

  async function handleSubmit() {
    if (!rawContent.trim() && !description.trim()) {
      toast.error("Please provide some details about the threat.");
      return;
    }
    setStep("submitting");

    try {
      const res = await fetch("/api/consumer/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: reportType,
          title,
          description: description || undefined,
          evidence: {
            raw_content: rawContent || undefined,
            sender: sender || undefined,
            urls: urls ? urls.split("\n").filter(Boolean) : undefined,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to submit report");
      const data = await res.json();
      setResult(data);
      setStep("done");
      toast.success("Threat reported! Thank you for protecting the community.");
    } catch {
      toast.error("Failed to submit report. Please try again.");
      setStep("details");
    }
  }

  function reset() {
    setStep("type");
    setReportType("");
    setTitle("");
    setDescription("");
    setRawContent("");
    setSender("");
    setUrls("");
    setResult(null);
  }

  // Step 1: Select type
  if (step === "type") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">What kind of threat did you encounter?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_TYPES.map(({ value, label, icon: Icon, description: desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectType(value)}
              className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Details
  if (step === "details") {
    const selectedType = REPORT_TYPES.find((t) => t.value === reportType);
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep("type")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Change type
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {selectedType && <selectedType.icon className="size-5" />}
              {selectedType?.label}
            </CardTitle>
            <CardDescription>Share the details so our AI can analyze the threat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Paste the suspicious content <span className="text-destructive">*</span>
              </label>
              <textarea
                value={rawContent}
                onChange={(e) => setRawContent(e.target.value)}
                rows={4}
                placeholder="Paste the scam text, email body, or suspicious message here..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Sender (optional)</label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Email address, phone number, or username"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Suspicious URLs (optional)</label>
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={2}
                placeholder="One URL per line"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Additional details (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Anything else you noticed..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <Button onClick={handleSubmit} className="w-full">
              Submit Report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Submitting
  if (step === "submitting") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="font-medium">Analyzing threat...</p>
          <p className="text-sm text-muted-foreground">
            Our AI is extracting the behavioral fingerprint and checking the network.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Step 4: Done
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="size-8 text-success" />
        </div>
        <h2 className="text-xl font-bold">Threat Reported!</h2>
        <p className="max-w-md text-muted-foreground">
          Your report has been analyzed and shared with the collective defense network.
          {result?.people_alerted
            ? ` ${result.people_alerted} people have been alerted about this threat.`
            : " The network is now immunized against this attack pattern."}
        </p>
        {result?.matched_existing && (
          <Badge variant="secondary">Matches a known campaign</Badge>
        )}
        <div className="flex gap-3 pt-4">
          <Button onClick={reset}>Report another</Button>
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
            Go to dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
