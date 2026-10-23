import path from "node:path";
import type { NextConfig } from "next";

/*
 * Internal tool (PRD §21): images are only ever served by this app's own API, so the browser may only talk to
 * this origin. Dev needs 'unsafe-eval' and websockets for hot reload, so the policy is production-only.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // sharp and firebase-admin are native / Node-only: load them from node_modules at runtime instead of bundling.
  serverExternalPackages: ["sharp", "firebase-admin"],
  experimental: {
    // Uploads are capped at 10 MB by the app (lib/validation/files.ts); leave room for the multipart envelope.
    proxyClientMaxBodySize: "12mb",
  },
  turbopack: {
    // Pin the root to this project: a lockfile higher up would otherwise be picked as the workspace root.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    if (process.env.NODE_ENV === "production") headers.push({ key: "Content-Security-Policy", value: csp });
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
