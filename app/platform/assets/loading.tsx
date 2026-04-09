import { Card, CardContent } from "@/components/ui/card";

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className ?? ""}`}
    />
  );
}

export default function AssetsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-48" />
        <SkeletonBlock className="h-4 w-72" />
      </div>
      <div className="flex gap-2">
        <SkeletonBlock className="h-9 w-64" />
        <SkeletonBlock className="h-9 w-24" />
        <SkeletonBlock className="h-9 w-24" />
        <SkeletonBlock className="h-9 w-24" />
      </div>
      <Card>
        <CardContent className="space-y-4 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
