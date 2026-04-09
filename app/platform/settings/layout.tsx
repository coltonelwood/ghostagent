"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/platform/settings/org", label: "Organization", icon: Building2 },
  { href: "/platform/settings/team", label: "Team", icon: Users },
  { href: "/platform/settings/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/platform/settings/billing", label: "Billing", icon: Zap },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
