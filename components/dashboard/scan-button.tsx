"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Lock } from "lucide-react";

export function ScanButton({
  workspaceId,
  hasGithub,
  plan,
  scanCount,
}: {
  workspaceId: string;
  hasGithub: boolean;
  plan: string;
  scanCount: number;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isLimited = plan === "trial" && scanCount >= 1;

  const handleScan = async () => {
    if (!hasGithub) {
      toast.error("Connect a GitHub organization in Settings before scanning.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start scan. Please try again.");
        return;
      }
      toast.success("Scan started. This usually takes 2–4 minutes.");
      router.push(`/dashboard/scan/${data.scan.id}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isLimited) {
    return (
      <Link
        href="/dashboard/settings"
        className="flex items-center gap-1.5 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-2 transition-colors"
      >
        <Lock className="h-3.5 w-3.5" />
        Upgrade to scan again
      </Link>
    );
  }

  return (
    <button
      onClick={handleScan}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm font-medium bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground rounded-lg px-4 py-2 transition-colors"
    >
      {loading ? (
        <>
          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          Starting…
        </>
      ) : (
        <>
          <Play className="h-3.5 w-3.5" />
          Run scan
        </>
      )}
    </button>
  );
}
