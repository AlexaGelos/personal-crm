import type { NextConfig } from "next";

// Content Security Policy without a nonce: a nonce would make every page render again on each
// request, which does not go with cacheComponents. So inline scripts are allowed (Next.js puts
// the page data into them) and the main protection is "only from our own address"
const contentSecurityPolicy = [
  "default-src 'self'",
  // eval only for "next dev": React uses it there to show errors; the production build does not
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  // Components set colours and delays with style="..."
  "style-src 'self' 'unsafe-inline'",
  // data: for the film grain picture in globals.css
  "img-src 'self' data: blob:",
  // next/font/google downloads the fonts at build time, the browser never goes to Google
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // No page of the app may be shown in a frame
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  // A year, only for this very address: the domain is shared with the landing
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // The same ban on frames for old browsers that do not know frame-ancestors
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // Self-contained server only for the Docker image (see Dockerfile);
  // locally "pnpm start" runs the regular server
  output: process.env.STANDALONE_BUILD === "1" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  // The app does not name its software: no "x-powered-by: Next.js"
  poweredByHeader: false,
  async headers() {
    // Every path, including _next, /health and /api/auth, which the proxy (src/proxy.ts) skips
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
