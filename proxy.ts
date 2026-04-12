import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Early-return on the auth callback path. The callback route handler
  // owns `exchangeCodeForSession` and attaches session cookies to its
  // own response — if this middleware also constructs a Supabase client
  // here, we risk racing the callback for cookie state. Simpler and
  // correct: let the route handler own the callback fully.
  if (pathname.startsWith("/auth/callback")) {
    return NextResponse.next({ request });
  }

  // Defensive safety net for magic-link flows. When the Supabase
  // dashboard's "Redirect URLs" allowlist doesn't include the URL we
  // pass as `emailRedirectTo`, Supabase silently falls back to the
  // project's configured "Site URL" and drops the `?code=...` on the
  // ROOT path — e.g. `https://site.com/?code=abc123`. There's no route
  // handler at `/` that can call `exchangeCodeForSession`, so the user
  // lands on the marketing page with an unusable code in the URL.
  //
  // Catch that case here and forward to `/auth/callback?code=...`
  // which owns the exchange. This is belt-and-suspenders — the real
  // fix is configuring the Supabase dashboard — but it means a
  // misconfiguration never produces a dead sign-in page.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Routes that require authentication
  const protectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/platform") ||
    pathname.startsWith("/onboarding");

  if (!user && protectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    // Preserve where the user was headed so login can send them back
    // on success. Skip for the two "home" destinations since they're
    // the default landings anyway.
    if (pathname !== "/platform" && pathname !== "/onboarding") {
      url.searchParams.set("redirectTo", pathname);
    }
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from the login screen
  if (user && pathname === "/auth/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/platform";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/platform/:path*",
    "/onboarding/:path*",
    "/scan/:path*",
    // Only the login page — not the entire /auth tree — so the
    // callback route is never intercepted by this middleware.
    "/auth/login",
    // Exclude static files, internal/webhook routes, and the auth
    // callback. The callback must remain free of middleware
    // interference so its response-bound cookies reach the browser.
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/internal|auth/callback).*)",
  ],
};
