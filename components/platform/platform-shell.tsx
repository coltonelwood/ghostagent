"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { NotificationDropdown } from "@/components/platform/notification-dropdown";
import {
  LayoutDashboard,
  Database,
  Plug,
  Shield,
  ShieldAlert,
  Globe,
  Zap,
  Bell,
  ClipboardCheck,
  FileText,
  Settings,
  Menu,
  LogOut,
  Users,
  Search,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Organization } from "@/lib/types/platform";

// --------------------------------------------------------------------------
// Navigation — grouped by intent
// --------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operate",
    items: [
      { href: "/platform", label: "Dashboard", icon: LayoutDashboard },
      { href: "/platform/assets", label: "Assets", icon: Database },
      { href: "/platform/events", label: "Events", icon: Bell },
    ],
  },
  {
    label: "Govern",
    items: [
      { href: "/platform/policies", label: "Policies", icon: Shield },
      { href: "/platform/compliance", label: "Compliance", icon: ClipboardCheck },
      { href: "/platform/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Defend",
    items: [
      { href: "/platform/threats", label: "Threat Intel", icon: ShieldAlert },
      { href: "/platform/network", label: "Network", icon: Globe },
      { href: "/platform/immunity", label: "Immunity", icon: Zap },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/platform/connectors", label: "Connectors", icon: Plug },
      { href: "/platform/settings/team", label: "Team", icon: Users },
      { href: "/platform/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/platform") return pathname === "/platform";
  if (href === "/platform/settings") {
    return (
      pathname === "/platform/settings" ||
      (pathname.startsWith("/platform/settings/") &&
        !pathname.startsWith("/platform/settings/team"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({
  pathname,
  org,
  onNavigate,
}: {
  pathname: string;
  org: Organization;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex size-7 items-center justify-center rounded bg-primary">
          <span className="text-xs font-semibold text-primary-foreground">N</span>
        </div>
        <span className="text-[15px] font-semibold tracking-tight">Nexus</span>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="flex flex-col gap-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5 px-3">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group/nav relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {active && (
                      <span
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                        aria-hidden
                      />
                    )}
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="mx-3 mb-3 rounded-md border border-sidebar-border bg-sidebar-accent/50 p-3">
        <p className="truncate text-[11px] font-medium text-sidebar-accent-foreground">
          {org.name}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {org.plan} plan
        </p>
        {org.plan === "starter" && (
          <Link
            href="/platform/settings/billing"
            className="mt-2 inline-flex items-center text-[11px] font-medium text-primary hover:underline"
          >
            Upgrade plan →
          </Link>
        )}
      </div>
    </div>
  );
}

export function PlatformShell({
  user,
  org,
  children,
}: {
  user: SupabaseUser;
  org: Organization;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <Sidebar pathname={pathname} org={org} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="lg:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              }
            />
            <SheetContent side="left" className="w-60 bg-sidebar p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <Sidebar
                pathname={pathname}
                org={org}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Command palette trigger */}
          <button
            type="button"
            className="group/search hidden h-8 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted/50 sm:flex"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search assets, policies, events…</span>
            <kbd className="inline-flex h-5 items-center rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <NotificationDropdown />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" className="gap-2 h-8">
                    <div
                      className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
                      aria-hidden
                    >
                      {(user.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <span className="hidden max-w-[140px] truncate text-xs font-medium sm:inline">
                      {user.email}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/platform/settings")}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/platform/settings/team")}>
                  Team
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/platform/settings/billing")}>
                  Billing
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
