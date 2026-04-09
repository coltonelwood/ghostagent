import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip TypeScript type checking in builds (we run tsc --noEmit separately)
  typescript: { ignoreBuildErrors: true },

  // Security headers applied to all responses
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // XSS protection (modern browsers use CSP, but belt-and-suspenders)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Don't send Referer to external sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Only allow HTTPS
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Limit what can be embedded
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content Security Policy
          // Restricts which scripts, styles, and connections are allowed.
          // 'unsafe-inline' is required for Next.js inline scripts and Tailwind styles—
          // when moving to a nonce-based CSP in future, this can be tightened.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + Next.js inline scripts + Vercel analytics
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
              // Styles: self + inline (required for Tailwind)
              "style-src 'self' 'unsafe-inline'",
              // Images: self + data URIs (for icons) + github avatars
              "img-src 'self' data: blob: https://avatars.githubusercontent.com",
              // Fonts: self
              "font-src 'self'",
              // Connections: self + Supabase + Stripe + Sentry
              `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://vercel.live`,
              // Frames: Stripe checkout iframe only
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              // Objects: none
              "object-src 'none'",
              // Base URI: self only (no base tag hijacking)
              "base-uri 'self'",
              // Form actions: self only
              "form-action 'self'",
              // Upgrade insecure requests in production
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Prevent source maps from leaking in production
  productionBrowserSourceMaps: false,

  // instrumentation.ts is auto-detected in Next.js 15+
};

export default nextConfig;
