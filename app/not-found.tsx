import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <div className="text-5xl">👻</div>
        <h1 className="text-3xl font-bold">404 — Page not found</h1>
        <p className="text-muted-foreground">
          This page doesn&apos;t exist. Maybe it was a ghost.
        </p>
        <Link href="/">
          <Button>Go home</Button>
        </Link>
      </div>
    </div>
  );
}
