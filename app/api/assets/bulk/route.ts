import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { auditLog } from "@/lib/audit";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BULK_IDS = 100;

export const POST = withLogging(async (req: NextRequest) => {
  try {
    const auth = await requireRole("operator");

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    const body = (await req.json()) as {
      assetIds: string[];
      action: "reassign" | "tag" | "review" | "archive";
      params: Record<string, unknown>;
    };

    if (!body.assetIds || !Array.isArray(body.assetIds) || body.assetIds.length === 0) {
      return NextResponse.json(
        { error: "assetIds array is required" },
        { status: 400 },
      );
    }

    if (body.assetIds.length > MAX_BULK_IDS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BULK_IDS} assets per bulk operation` },
        { status: 400 },
      );
    }

    if (!body.action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 },
      );
    }

    const validActions = ["reassign", "tag", "review", "archive"];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 },
      );
    }

    const db = getAdminClient();
    const now = new Date().toISOString();
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    // Verify all assets belong to the org
    const { data: assets } = await db
      .from("assets")
      .select("id")
      .eq("org_id", auth.orgId)
      .in("id", body.assetIds);

    const validIds = new Set((assets ?? []).map((a: { id: string }) => a.id));

    for (const assetId of body.assetIds) {
      if (!validIds.has(assetId)) {
        results.push({ id: assetId, success: false, error: "Not found" });
        continue;
      }

      try {
        switch (body.action) {
          case "reassign": {
            const ownerEmail = body.params?.ownerEmail as string;
            if (!ownerEmail) {
              results.push({
                id: assetId,
                success: false,
                error: "ownerEmail param required",
              });
              break;
            }
            await db
              .from("assets")
              .update({
                owner_email: ownerEmail,
                owner_status: "active_owner",
                owner_confidence: 100,
                owner_source: "manual_assignment",
                last_changed_at: now,
              })
              .eq("id", assetId);
            results.push({ id: assetId, success: true });
            break;
          }

          case "tag": {
            const tags = body.params?.tags as string[];
            if (!tags || !Array.isArray(tags)) {
              results.push({
                id: assetId,
                success: false,
                error: "tags param required",
              });
              break;
            }
            // Merge with existing tags
            const { data: existing } = await db
              .from("assets")
              .select("tags")
              .eq("id", assetId)
              .single();
            const existingTags = (existing?.tags as string[]) ?? [];
            const merged = [...new Set([...existingTags, ...tags])];
            await db
              .from("assets")
              .update({ tags: merged, last_changed_at: now })
              .eq("id", assetId);
            results.push({ id: assetId, success: true });
            break;
          }

          case "review": {
            await db
              .from("assets")
              .update({
                review_status: "reviewed",
                reviewed_by: auth.userId,
                reviewed_at: now,
                last_changed_at: now,
              })
              .eq("id", assetId);
            results.push({ id: assetId, success: true });
            break;
          }

          case "archive": {
            await db
              .from("assets")
              .update({ status: "archived", last_changed_at: now })
              .eq("id", assetId);
            results.push({ id: assetId, success: true });
            break;
          }
        }
      } catch {
        results.push({
          id: assetId,
          success: false,
          error: "Processing failed",
        });
      }
    }

    await auditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      actorEmail: auth.email,
      action: `asset.bulk.${body.action}`,
      resourceType: "asset",
      metadata: {
        assetCount: body.assetIds.length,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
        params: body.params,
      },
      req,
    });

    return NextResponse.json({
      data: results,
      total: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
