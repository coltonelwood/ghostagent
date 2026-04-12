import { ConsumerDashboard } from "@/components/consumer/dashboard";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Protection Dashboard</h1>
        <p className="text-muted-foreground">
          See your protection score, active threats, and the impact of your reports.
        </p>
      </div>
      <ConsumerDashboard />
    </div>
  );
}
