import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { CommandCenterDashboard } from "@/components/platform/command-center";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Dashboard v2 — deployed 2026-04-12
export default async function PlatformDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const baseUrl =
    host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let analytics = null;
  try {
    const res = await fetch(`${baseUrl}/api/analytics`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      analytics = json.data ?? null;
    }
  } catch (err) {
    logger.warn({ err }, "platform page: analytics fetch failed");
  }

  return <CommandCenterDashboard analytics={analytics} />;
}
