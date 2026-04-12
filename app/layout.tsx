import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spekris — AI Asset Management for Modern Companies",
  description:
    "Spekris scans connected sources for AI agents, LLM integrations, and automation workflows — then assigns ownership, scores risk, and maps findings to HIPAA, SOC 2, EU AI Act, and ISO 42001 controls.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
