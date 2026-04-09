import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrCreateOrgForUser } from "@/lib/org";
import { PlatformShell } from "@/components/platform/platform-shell";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const org = await getOrCreateOrgForUser(user.id, user.email!);

  return (
    <PlatformShell user={user} org={org}>
      {children}
    </PlatformShell>
  );
}
