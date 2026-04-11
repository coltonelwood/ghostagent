import { redirect } from "next/navigation";

// Legacy in-progress scan screen — replaced by the connector sync flow in
// /platform/connectors/[id]. Redirect any lingering links home.
export default function LegacyScanRunningPage() {
  redirect("/platform/connectors");
}
