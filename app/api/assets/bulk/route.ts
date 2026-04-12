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
    const auth = await requireRole("admin");

    const rl = apiRateLimiter.check(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
      );
    }

    const body = (await req.json()) as {
      asset_ids: string[];
      action: "reassign" | "tag" | "review" | "archive";
      payload: {
        owner_email?: string;
        tags?: string[];
        review_status?: string;
      };
    };

    if (!body.asset_ids || !Array.isArray(body.asset_ids) || body.asset_ids.length === 0) {
      return NextResponse.json(
        { error: "asset_ids array is required" },
        { status: 400 },
      );
    }

    if (body.asset_ids.length > MAX_BULK_IDS) {
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
    let updated = 0;

    // Verify all assets belong to the org
    const { data: assets } = await db
      .from("assets")
      .select("id")
      .eq("org_id", auth.orgId)
      .in("id", body.asset_ids);

    const validIds = (assets ?? []).map((a: { id: string }) => a.id);

    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "No matching assets found" },
        { status: 404 },
      );
    }

    switch (body.action) {
      case "reassign": {
        const ownerEmail = body.payload?.owner_email;
        if (!ownerEmail) {
          return NextResponse.json(
            { error: "payload.owner_email is required for reassign" },
            { status: 400 },
          );
        }
        const { data: reassigned } = await db
          .from("assets")
          .update({
            owner_email: ownerEmail,
            owner_status: "active",
            last_changed_at: now,
          })
          .in("id", validIds)
          .select("id");
        updated = reassigned?.length ?? 0;
        break;
      }

      case "tag": {
        const tags = body.payload?.tags;
        if (!tags || !Array.isArray(tags) || tags.length === 0) {
          return NextResponse.json(
            { error: "payload.tags is required for tag action" },
            { status: 400 },
          );
        }
        // Read-modify-write to append tags without duplicates
        for (const assetId of validIds) {
          const { data: existing } = await db
            .from("assets")
            .select("tags")
            .eq("id", assetId)
            .single();
          const existingTags = (existing?.tags as string[]) ?? [];
          const merged = [...new Set([...existingTags, ...tags])];
          const { error } = await db
            .from("assets")
            .update({ tags: merged, last_changed_at: now })
            .eq("id", assetId);
          if (!error) updated++;
        }
        break;
      }

      case "review": {
        const reviewStatus = body.payload?.review_status;
        if (!reviewStatus) {
          return NextResponse.json(
            { error: "payload.review_status is required for review action" },
            { status: 400 },
          );
        }
        const { data: reviewed } = await db
          .from("assets")
          .update({
            review_status: reviewStatus,
            reviewed_by: auth.userId,
            reviewed_at: now,
            last_changed_at: now,
          })
          .in("id", validIds)
          .select("id");
        updated = reviewed?.length ?? 0;
        break;
      }

      case "archive": {
        const { data: archived } = await db
          .from("assets")
          .update({ status: "archived", last_changed_at: now })
          .in("id", validIds)
          .select("id");
        updated = archived?.length ?? 0;
        break;
      }
    }

    await auditLog({
      orgId: auth.orgId,
      actorId: auth.userId,
      actorEmail: auth.email,
      action: `asset.bulk.${body.action}`,
      resourceType: "asset",
      metadata: {
        asset_ids: body.asset_ids,
        updated,
        payload: body.payload,
      },
      req,
    });

    return NextResponse.json({ success: true, updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
