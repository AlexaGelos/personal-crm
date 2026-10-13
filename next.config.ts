import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server only for the Docker image (see Dockerfile);
  // locally "pnpm start" runs the regular server
  output: process.env.STANDALONE_BUILD === "1" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
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
