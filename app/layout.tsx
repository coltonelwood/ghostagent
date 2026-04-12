import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spekris | AI System Visibility and Control",
  description:
    "Spekris scans your code, cloud, and automation platforms to discover AI agents, LLM integrations, and ML workflows. Assign ownership, score risk, enforce policies, and generate compliance documentation for EU AI Act, SOC 2, ISO 42001, and NIST AI RMF.",
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
