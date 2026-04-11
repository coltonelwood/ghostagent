import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { AssetDetail } from "@/components/platform/asset-detail";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const baseUrl = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let asset = null;
  let fetchError = false;

  try {
    const res = await fetch(`${baseUrl}/api/assets/${id}`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) notFound();
      fetchError = true;
    } else {
      const body = await res.json();
      asset = body.data;
    }
  } catch {
    fetchError = true;
  }

  if (fetchError || !asset) {
    return (
      <div className="mx-auto max-w-lg text-center py-20 space-y-4">
        <h2 className="text-lg font-semibold">We couldn&apos;t load this asset</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong fetching this record. Refresh the page or head back
          to the asset registry.
        </p>
        <Link
          href="/platform/assets"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          ← Back to assets
        </Link>
      </div>
    );
  }

  return <AssetDetail asset={asset} />;
}
