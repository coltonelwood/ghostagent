import { ThreatReportForm } from "@/components/platform/threat-report-form";

export default function ThreatReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Report a Threat</h1>
        <p className="text-muted-foreground">
          Submit threat intelligence to the collective defense network.
        </p>
      </div>
      <ThreatReportForm />
    </div>
  );
}
