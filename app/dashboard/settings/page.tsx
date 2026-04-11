import { redirect } from "next/navigation";

// Legacy route — settings live at /platform/settings now.
export default function LegacyDashboardSettingsPage() {
  redirect("/platform/settings");
}
