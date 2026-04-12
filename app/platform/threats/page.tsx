import { ThreatDashboard } from "@/components/platform/threat-dashboard";

export default function ThreatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Threat Intelligence</h1>
        <p className="text-muted-foreground">
          Monitor and report cyber threats detected across your organization.
        </p>
      </div>
      <ThreatDashboard />
    </div>
  );
}
