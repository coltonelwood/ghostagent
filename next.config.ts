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
        ],
      },
    ];
  },

  // Prevent source maps from leaking in production
  productionBrowserSourceMaps: false,

  // instrumentation.ts is auto-detected in Next.js 15+
};

export default nextConfig;
