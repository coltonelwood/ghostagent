"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Settings, Zap } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Workspace } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({
  user,
  workspace,
  children,
}: {
  user: User;
  workspace: Workspace;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/platform" className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-violet-600">
                <span className="text-xs font-bold text-white">S</span>
              </div>
              <span className="font-semibold text-sm">Spekris</span>
            </Link>

            <nav className="hidden items-center gap-0.5 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Plan + Email + Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/platform"
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 border border-violet-200 hover:border-violet-300 bg-violet-50 hover:bg-violet-100 rounded-lg px-3 py-1.5 transition-all"
            >
              <Zap className="h-3 w-3" />
              Open Platform
            </Link>
            <Badge variant="outline" className="hidden sm:inline-flex text-xs capitalize">
              {workspace.plan === "trial" ? "Free Trial" : workspace.plan}
            </Badge>
            <span className="hidden lg:block text-xs text-muted-foreground truncate max-w-[180px]">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
