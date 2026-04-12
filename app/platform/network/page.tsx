import { NetworkDashboard } from "@/components/platform/network-dashboard";

export default function NetworkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collective Defense Network</h1>
        <p className="text-muted-foreground">
          Join the collective cybercrime immunity network. When one member
          detects a threat, all members become immune.
        </p>
      </div>
      <NetworkDashboard />
    </div>
  );
}
