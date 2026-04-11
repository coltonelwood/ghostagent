import { redirect } from "next/navigation";

// Legacy route — the GhostAgent dashboard has been consolidated into the
// Nexus platform at /platform. Redirect any lingering links here.
export default function LegacyDashboardPage() {
  redirect("/platform");
}
