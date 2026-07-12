import path from "node:path";
import { fileURLToPath } from "node:url";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, "../..");

loadEnvConfig(workspaceRoot);

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  output: "standalone",
  outputFileTracingExcludes: {
    "/*": ["playwright-report/**/*", "scripts/**/*", "test/**/*", "test-results/**/*"],
  },
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@fugue/ui"],
};

export default nextConfig;
