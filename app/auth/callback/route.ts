import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { adminClient } from "@/lib/supabase/admin";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Magic-link callback. This is the entry point every sign-in email
 * links to. It has ONE job that must not fail:
 *
 *   1. Take the `code` from the URL
 *   2. Exchange it for a real Supabase session
 *   3. Write the session cookies onto the response the browser follows
 *
 * The previous implementation used `createClient()` from
 * `lib/supabase/server.ts`, which internally tries to write cookies via
 * `next/headers` `cookies()`. In a Next.js **Route Handler**, that
 * function returns a read-only view of the request cookies — any
 * `cookieStore.set()` call silently throws and is swallowed by the
 * try/catch. Result: exchangeCodeForSession "succeeded" in Supabase's
 * API but the session cookies were NEVER attached to the browser's
 * response. The user followed the redirect to /platform with no
 * session → middleware bounced them back to /auth/login → dead page.
 *
 * The correct pattern, per the @supabase/ssr docs, is:
 *
 *   - Create a NextResponse FIRST
 *   - Construct the server client with a cookies adapter that reads
 *     from `req.cookies` and writes to `response.cookies`
 *   - Call exchangeCodeForSession, which now writes the session
 *     cookies onto THAT response
 *   - Return the response (as a redirect) — cookies travel with it
 *
 * This file inlines the adapter so it never accidentally shares
 * plumbing with the read-only server helper.
 */

/**
 * Accept only same-origin relative paths so a crafted
 *   /auth/callback?next=https://evil.com
 * can't turn a successful sign-in into an off-site redirect.
 */
function safeNextPath(value: string | null): string | null {
  if (!value) return null;
  if (value.length > 200) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/^\/\w+:/.test(value)) return null;
  return value;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const authError = searchParams.get("error");
  const authErrorDesc = searchParams.get("error_description");

  // Some Supabase providers return the error on the callback URL
  // itself (not as a `code`). Surface them to the login page with a
  // human-friendly slug rather than a dead redirect.
  if (authError) {
    apiLogger.warn(
      { authError, authErrorDesc },
      "auth callback: provider returned error",
    );
    const u = new URL("/auth/login", req.url);
    u.searchParams.set("error", "provider_error");
    if (authErrorDesc) u.searchParams.set("error_description", authErrorDesc.slice(0, 200));
    return NextResponse.redirect(u);
  }

  if (!code) {
    apiLogger.warn({ url: req.url }, "auth callback: missing code");
    return NextResponse.redirect(
      new URL("/auth/login?error=no_code", req.url),
    );
  }

  // Build the redirect response FIRST so the cookies adapter can
  // attach Supabase's session cookies to it.
  const tempRedirect = NextResponse.redirect(new URL("/platform", req.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // CRITICAL: write to the response, not to `next/headers`
          // cookies(), because cookies() is read-only inside a Route
          // Handler. These cookies are what makes the browser
          // authenticated after it follows our redirect.
          cookiesToSet.forEach(({ name, value, options }) => {
            tempRedirect.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    apiLogger.warn(
      {
        err: error?.message,
        hasUser: !!data?.user,
      },
      "auth callback: exchangeCodeForSession failed",
    );
    return NextResponse.redirect(
      new URL("/auth/login?error=exchange_failed", req.url),
    );
  }

  const user = data.user;
  const email = user.email ?? "";

  apiLogger.info(
    { userId: user.id, email },
    "auth callback: session exchanged successfully",
  );

  // --- Legacy: ensure GhostAgent workspace exists ---
  try {
    const { data: workspaces } = await adminClient
      .from("workspaces")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1);

    if (!workspaces || workspaces.length === 0) {
      await adminClient.from("workspaces").insert({
        owner_id: user.id,
        name: email.split("@")[0] ?? "My Workspace",
      });
    }
  } catch (err) {
    // Never fail the sign-in because of legacy-workspace provisioning.
    // The user can still use /platform without a legacy workspace row.
    apiLogger.error(
      { err, userId: user.id },
      "auth callback: legacy workspace provisioning failed",
    );
  }

  // --- Nexus: ensure org + membership exist ---
  let isNewUser = false;
  try {
    const { data: membership } = await adminClient
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      // Brand new user — create their first organization.
      const slug =
        (email.split("@")[0] ?? "user")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 20) +
        "-" +
        Math.random().toString(36).slice(2, 6);

      const { data: org, error: orgErr } = await adminClient
        .from("organizations")
        .insert({
          name: (email.split("@")[0] ?? "My Organization") + "'s Organization",
          slug,
          plan: "starter",
        })
        .select("id")
        .single();

      if (orgErr || !org) {
        apiLogger.error(
          { err: orgErr, userId: user.id },
          "auth callback: failed to create organization — user will land on /platform with no org, platform layout will self-heal",
        );
      } else {
        const { error: memberErr } = await adminClient
          .from("org_members")
          .insert({
            org_id: org.id,
            user_id: user.id,
            role: "owner",
            accepted_at: new Date().toISOString(),
          });
        if (memberErr) {
          apiLogger.error(
            { err: memberErr, userId: user.id, orgId: org.id },
            "auth callback: failed to add user to org",
          );
        } else {
          isNewUser = true;
        }
      }
    }
  } catch (err) {
    apiLogger.error(
      { err, userId: user.id },
      "auth callback: org provisioning threw",
    );
  }

  // Decide final destination. Prefer the caller's `next` (already
  // validated as a same-origin relative path). New users go to
  // onboarding; returning users to /platform.
  const finalPath = next ? next : isNewUser ? "/onboarding" : "/platform";

  // Build the FINAL redirect response. Copy cookies from the temporary
  // response we used to capture Supabase's session cookies. We can't
  // just mutate tempRedirect's Location header because NextResponse
  // doesn't expose a setter — constructing a new response and copying
  // cookies is the documented pattern.
  const finalResponse = NextResponse.redirect(new URL(finalPath, req.url));
  for (const cookie of tempRedirect.cookies.getAll()) {
    finalResponse.cookies.set(cookie);
  }
  return finalResponse;
}
