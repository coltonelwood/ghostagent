"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SERVICES = [
  "Online Banking",
  "Email (Gmail, Outlook)",
  "Social Media",
  "Online Shopping",
  "Cryptocurrency",
  "Investment Apps",
  "Cloud Storage",
  "Payment Apps (Venmo, PayPal)",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  function toggleService(service: string) {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return next;
    });
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/consumer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name || undefined,
          risk_profile: {
            services: Array.from(selectedServices),
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to create profile");
      toast.success("Profile created! Welcome to GhostAgent.");
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome to GhostAgent</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us a little about yourself so we can protect you better.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your name</CardTitle>
          <CardDescription>Optional — helps personalize your experience.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What do you use online?</CardTitle>
          <CardDescription>
            Select the services you use so we can alert you about relevant threats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {SERVICES.map((service) => (
              <button
                key={service}
                type="button"
                onClick={() => toggleService(service)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  selectedServices.has(service)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {service}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? "Setting up..." : "Start protecting yourself"}
      </Button>
    </div>
  );
}
