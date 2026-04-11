// Legacy dashboard routes have been consolidated into the Nexus platform.
// This layout is a passthrough so the individual pages can redirect without
// dragging the legacy shell along with them.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
