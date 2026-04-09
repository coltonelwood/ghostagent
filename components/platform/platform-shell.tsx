"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  Bell,
  ClipboardCheck,
  FileText,
  Settings,
  Menu,
  LogOut,
  User,
  ChevronLeft,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Organization } from "@/lib/types/platform";

const NAV_ITEMS = [
  { href: "/platform", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/assets", label: "Asset Registry", icon: Database },
  { href: "/platform/connectors", label: "Connectors", icon: Plug },
  { href: "/platform/policies", label: "Policies", icon: Shield },
  { href: "/platform/events", label: "Events", icon: Bell },
  { href: "/platform/compliance", label: "Compliance", icon: ClipboardCheck },
  { href: "/platform/reports", label: "Reports", icon: FileText },
  { href: "/platform/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/platform") return pathname === "/platform";
  return pathname.startsWith(href);
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
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
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
            <span className="text-sm font-bold text-primary-foreground">N</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Nexus</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav pathname={pathname} />
        </div>
        <div className="border-t px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">{org.name}</p>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <Menu className="size-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              }
            />
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b px-4">
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
                    <span className="text-sm font-bold text-primary-foreground">N</span>
                  </div>
                  Nexus
                </SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <SidebarNav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <span className="hidden text-sm font-medium text-muted-foreground sm:block">
            {org.name}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <NotificationDropdown />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="size-4" />
                    <span className="hidden text-sm sm:inline">
                      {user.email}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" side="bottom" sideOffset={8}>
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
