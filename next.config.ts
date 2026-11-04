import type { NextConfig } from "next";

// Sent on every response, API routes and static files included. The CSP itself
// needs a per-request nonce, so it is set in src/proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API answers are per-user or per-question; never let a shared cache keep them.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  // The planner is client state and the server routes are per-request, so Cache
  // Components would add Suspense plumbing without caching anything useful.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  // Production answers with BM25 only (RAG_RETRIEVER=bm25), so keep the ~400 MB
  // embedding runtime out of the serverless bundle.
  outputFileTracingExcludes: {
    "/api/ask": ["node_modules/onnxruntime-node/**", "node_modules/onnxruntime-web/**", "node_modules/@huggingface/**", "node_modules/sharp/**", "node_modules/@img/**"],
  },
};

export default nextConfig;
