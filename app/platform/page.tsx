import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CommandCenterDashboard } from "@/components/platform/command-center";

export default async function PlatformDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Forward cookies so the API route can authenticate the request
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  let analytics = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/analytics`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      analytics = json.data ?? null;
    }
  } catch {
    // Fetch may fail during build or if API is unavailable
  }

  return <CommandCenterDashboard analytics={analytics} />;
}
