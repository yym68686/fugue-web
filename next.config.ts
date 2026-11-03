import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Bound parallel page workers in memory-constrained image builders.
    cpus: 1,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
