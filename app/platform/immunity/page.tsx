import { ImmunityDashboard } from "@/components/platform/immunity-dashboard";

export default function ImmunityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Immunity Dashboard</h1>
        <p className="text-muted-foreground">
          Predictive threat analysis and automated countermeasure deployment.
        </p>
      </div>
      <ImmunityDashboard />
    </div>
  );
}
