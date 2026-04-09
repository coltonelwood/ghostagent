import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { scoreAsset, buildRiskContext } from "@/lib/risk-engine";
import { emitEvent } from "@/lib/event-system";
import { logger } from "@/lib/logger";
import type { Asset, AssetKind } from "@/lib/types/platform";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sdkKey = authHeader.slice(7);

    const { data: org, error: orgErr } = await adminClient
      .from("organizations")
      .select("id, name, plan")
      .eq("sdk_api_key", sdkKey)
      .single();

    if (orgErr || !org) {
      return NextResponse.json({ error: "Invalid SDK API key" }, { status: 401 });
    }

    const body = await req.json() as {
      name: string;
      kind?: string;
      owner?: string;
      services?: string[];
      version?: string;
      environment?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const externalId = `sdk:${body.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const aiServices = (body.services ?? []).map((s) => ({ provider: s }));

    // Find or create SDK connector
    let { data: connector } = await adminClient
      .from("connectors")
      .select("id")
      .eq("org_id", org.id)
      .eq("kind", "sdk")
      .limit(1)
      .single();

    if (!connector) {
      const { data: newConnector } = await adminClient
        .from("connectors")
        .insert({
          org_id: org.id,
          kind: "sdk",
          name: "Internal SDK",
          status: "active",
          credentials_encrypted: "",
          created_by: "00000000-0000-0000-0000-000000000000",
        })
        .select("id")
        .single();
      connector = newConnector;
    }

    // Check for existing asset
    const { data: existing } = await adminClient
      .from("assets")
      .select("id, risk_score")
      .eq("org_id", org.id)
      .eq("external_id", externalId)
      .single();

    const assetData = {
      org_id: org.id,
      connector_id: connector?.id ?? null,
      external_id: externalId,
      name: body.name,
      description: body.description ?? null,
      kind: (body.kind as AssetKind) ?? "sdk_reported",
      source: "sdk",
      environment: (body.environment ?? "unknown") as Asset["environment"],
      owner_email: body.owner ?? null,
      owner_status: body.owner ? "active_owner" : "unknown_owner",
      owner_confidence: body.owner ? 80 : 0,
      owner_source: body.owner ? "sdk_reported" : null,
      ai_services: aiServices,
      last_seen_at: new Date().toISOString(),
      raw_metadata: { version: body.version, ...(body.metadata ?? {}) },
    };

    let assetId: string;

    if (existing) {
      await adminClient.from("assets")
        .update({ ...assetData, last_changed_at: new Date().toISOString() })
        .eq("id", existing.id);
      assetId = existing.id;
    } else {
      const { data: created } = await adminClient
        .from("assets")
        .insert({ ...assetData, first_seen_at: new Date().toISOString() })
        .select("id")
        .single();
      assetId = created?.id as string;
      await emitEvent({
        orgId: org.id,
        kind: "asset_discovered",
        severity: "info",
        title: `New SDK-reported asset: ${body.name}`,
        assetId,
      });
    }

    // Score the asset
    const { data: fullAsset } = await adminClient.from("assets").select("*").eq("id", assetId).single();
    if (fullAsset) {
      const ctx = buildRiskContext(fullAsset as unknown as Asset);
      const { score, level, breakdown } = scoreAsset(fullAsset as unknown as Asset, ctx);
      await adminClient.from("assets")
        .update({ risk_score: score, risk_level: level, risk_breakdown: breakdown, risk_scored_at: new Date().toISOString() })
        .eq("id", assetId);
    }

    logger.info({ orgId: org.id, assetId, name: body.name }, "sdk: asset reported");

    return NextResponse.json({ success: true, assetId }, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    logger.error({ err }, "POST /api/sdk/report error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
