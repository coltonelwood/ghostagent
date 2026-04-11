"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, AlertTriangle, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/platform/settings/org", label: "Organization", icon: Building2 },
  { href: "/platform/settings/team", label: "Team", icon: Users },
  { href: "/platform/settings/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/platform/settings/billing", label: "Billing", icon: CreditCard },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your organization, team, alerts, and billing.
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex h-9 items-center gap-2 border-b-2 px-3 text-[13px] font-medium transition-colors whitespace-nowrap",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  );
}
