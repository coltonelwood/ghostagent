import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, AuthError } from "@/lib/org-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { createIndividualProfile } from "@/lib/threat-intelligence";
import { withLogging } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withLogging(async (req: NextRequest) => {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminClient();
    const { data: profile, error } = await db
      .from("individual_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ data: profile });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

export const POST = withLogging(async (req: NextRequest) => {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      display_name?: string;
      risk_profile?: Record<string, unknown>;
    };

    const profile = await createIndividualProfile(user.id, {
      display_name: body.display_name,
      risk_profile: body.risk_profile,
    });

    return NextResponse.json({ data: profile });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});

export const PATCH = withLogging(async (req: NextRequest) => {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      display_name?: string;
      risk_profile?: Record<string, unknown>;
      alert_preferences?: Record<string, boolean>;
    };

    const updates: Record<string, unknown> = {};
    if (body.display_name !== undefined) updates.display_name = body.display_name;
    if (body.risk_profile !== undefined) updates.risk_profile = body.risk_profile;
    if (body.alert_preferences !== undefined) updates.alert_preferences = body.alert_preferences;
    updates.updated_at = new Date().toISOString();

    const db = getAdminClient();
    const { data: profile, error } = await db
      .from("individual_profiles")
      .update(updates)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !profile) {
      logger.error({ error }, "PATCH /api/consumer/profile error");
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ data: profile });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
});
