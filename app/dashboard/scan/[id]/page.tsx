import { redirect } from "next/navigation";

// Legacy scan detail — redirected into the Nexus platform assets view.
export default function LegacyScanDetailPage() {
  redirect("/platform/assets");
}
