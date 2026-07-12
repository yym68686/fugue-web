import path from "node:path";
import { fileURLToPath } from "node:url";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, "../..");
// Local and Playwright builds use `next start`; the Docker builder opts into the
// standalone artifact explicitly so each build is started by its supported server.
const buildsStandaloneRuntime = process.env.FUGUE_NEXT_OUTPUT === "standalone";

loadEnvConfig(workspaceRoot);

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  ...(buildsStandaloneRuntime ? { output: "standalone" } : {}),
  outputFileTracingExcludes: {
    "/*": ["playwright-report/**/*", "scripts/**/*", "test/**/*", "test-results/**/*"],
  },
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@fugue/ui"],
};

export default nextConfig;
