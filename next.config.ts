import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
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
