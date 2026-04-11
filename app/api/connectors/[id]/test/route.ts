import { NextRequest, NextResponse } from "next/server";
import { withLogging } from "@/lib/api-handler";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireRole, AuthError } from "@/lib/org-auth";
import { getConnector } from "@/lib/connectors";
import { decryptCredentials } from "@/lib/crypto";
import { apiRateLimiter, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/connectors/[id]/test
 *
 * Re-validates a stored connector's credentials. Accepts an optional
 * { credentials } body to test new credentials before saving them;
 * when omitted, decrypts and re-tests whatever is currently stored.
 */
export const POST = withLogging(
  async (req: NextRequest, ctx: unknown) => {
    try {
      const { id } = await (ctx as { params: Promise<{ id: string }> }).params;
      const auth = await requireRole("admin");

      const rl = apiRateLimiter.check(auth.userId);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded", success: false },
          { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) },
        );
      }

      const db = getAdminClient();
      const { data: connector } = await db
        .from("connectors")
        .select("id, org_id, kind, credentials_encrypted, config")
        .eq("id", id)
        .eq("org_id", auth.orgId)
        .single();

      if (!connector) {
        return NextResponse.json(
          { error: "Connector not found", success: false },
          { status: 404 },
        );
      }

      // Accept body credentials if provided, otherwise decrypt stored ones.
      let credentials: Record<string, string> | null = null;
      try {
        const body = (await req.json()) as {
          credentials?: Record<string, string>;
        };
        if (body?.credentials) credentials = body.credentials;
      } catch {
        // Empty body is fine — fall through to stored credentials.
      }

      if (!credentials) {
        if (!connector.credentials_encrypted) {
          return NextResponse.json(
            {
              success: false,
              error: "No credentials on file for this connector.",
            },
            { status: 400 },
          );
        }
        try {
          credentials = decryptCredentials(connector.credentials_encrypted);
        } catch {
          return NextResponse.json(
            {
              success: false,
              error:
                "Failed to decrypt stored credentials. Please re-enter them.",
            },
            { status: 500 },
          );
        }
      }

      // Merge connector config so validators that need org/region/etc. work.
      const merged = {
        ...(credentials ?? {}),
        ...((connector.config as Record<string, string>) ?? {}),
      };

      const impl = getConnector(connector.kind as never);
      const result = await impl.validate(merged);

      return NextResponse.json({
        success: result.valid,
        error: result.error,
        data: result,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }
  },
);
