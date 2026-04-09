"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

  const handleScan = async () => {
    if (!hasGithub) {
      toast.error("Configure GitHub in Settings first.");
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
        toast.error(data.error);
        return;
      }

      toast.success("Scan started!");
      router.push(`/dashboard/scan/${data.scan.id}`);
    } catch {
      toast.error("Failed to start scan");
    } finally {
      setLoading(false);
    }
  };

  const isLimited = plan === "trial" && scanCount >= 1;

  return (
    <Button onClick={handleScan} disabled={loading || isLimited}>
      {loading
        ? "Starting..."
        : isLimited
          ? "Upgrade to Scan"
          : "Run Scan"}
    </Button>
  );
}
