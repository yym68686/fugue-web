import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@fugue/ui"],
};

export default withMDX(nextConfig);
