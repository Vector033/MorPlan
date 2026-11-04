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
};

export default nextConfig;
