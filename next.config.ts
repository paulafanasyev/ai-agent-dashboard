/**
 * File: next.config.ts
 * Purpose: Configure Next.js runtime and response headers.
 * Problem solved: Applies project-wide framework behavior and security policy from one location.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "frame-src https://*.vercel.app https://*.vercel.run https://va.vercel-scripts.com",
              "frame-ancestors 'self' https://*.vercel.app https://*.vercel.run",
              "connect-src 'self' https://*.vercel.app https://*.vercel.run",
              "img-src 'self' data: https://*.vercel.app https://*.vercel.run",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel.app https://*.vercel.run https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
