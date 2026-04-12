import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Shared server-side Supabase client for READ-ONLY session usage
 * inside Server Components and page layouts.
 *
 * IMPORTANT — do not use this helper inside a Route Handler that
 * needs to WRITE session cookies (e.g. /auth/callback running
 * `exchangeCodeForSession`). In a Route Handler, `next/headers`
 * `cookies()` returns a read-only view of the request cookies — any
 * `cookieStore.set()` call silently throws and is caught by the
 * try/catch below. Supabase thinks the session was saved but no
 * cookies reach the browser, so the user ends up stuck in a redirect
 * loop back to /auth/login.
 *
 * For route handlers that need to write session cookies, construct a
 * `createServerClient` inline with a cookies adapter that writes onto
 * a `NextResponse` you control. See `/auth/callback/route.ts` for the
 * canonical pattern.
 */
export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component — cookies() is read-only here. This is
            // expected and safe as long as the caller is only reading
            // the session. DO NOT use this helper to write session
            // cookies in a Route Handler — see the JSDoc above.
          }
        },
      },
    },
  );
};
