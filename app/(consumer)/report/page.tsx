import { ThreatReportForm } from "@/components/consumer/threat-report-form";

export default function ReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Report a Threat</h1>
        <p className="text-muted-foreground">
          Spotted something suspicious? Report it and help protect thousands of people.
        </p>
      </div>
      <ThreatReportForm />
    </div>
  );
}
