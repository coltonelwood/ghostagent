"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type OwnerBadgeStatus =
  | "active"
  | "inactive"
  | "unknown"
  | "orphaned"
  | "pending";

interface OwnerBadgeProps {
  name?: string | null;
  email?: string | null;
  status?: OwnerBadgeStatus;
  className?: string;
}

const STATUS_DOT: Record<OwnerBadgeStatus, string> = {
  active: "bg-emerald-500",
  inactive: "bg-yellow-500",
  unknown: "bg-gray-400",
  orphaned: "bg-red-500",
  pending: "bg-blue-500",
};

const STATUS_LABEL: Record<OwnerBadgeStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  unknown: "Unknown",
  orphaned: "Orphaned",
  pending: "Pending",
};

function getInitial(name?: string | null, email?: string | null): string {
  if (name) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return "?";
}

export function OwnerBadge({
  name,
  email,
  status = "unknown",
  className,
}: OwnerBadgeProps) {
  const displayName = name || email;

  if (!displayName) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 text-sm text-muted-foreground",
          className
        )}
      >
        <Avatar size="sm">
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
        <span className="italic">No owner</span>
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2 text-sm", className)}
    >
      <span className="relative">
        <Avatar size="sm">
          <AvatarFallback>{getInitial(name, email)}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
            STATUS_DOT[status]
          )}
          title={STATUS_LABEL[status]}
        />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-medium text-foreground truncate max-w-[180px]">
          {displayName}
        </span>
        {name && email && (
          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
            {email}
          </span>
        )}
      </span>
    </span>
  );
}
