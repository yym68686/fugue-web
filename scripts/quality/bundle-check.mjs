import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

import { finishGate, parseArgs, ROOT, readJson } from "./lib.mjs";

const args = parseArgs();
const configPath = resolve(ROOT, args.value("config", "test/bundle/budgets.json"));
const config = readJson(configPath);
const errors = [];

if (config.schemaVersion !== 1) {
  errors.push(`${relative(ROOT, configPath)} schemaVersion must be 1`);
}

const appDirectory = resolve(ROOT, args.value("app", config.appDir));
const statsPath = resolve(appDirectory, config.statsFile);
const buildManifestPath = resolve(appDirectory, config.buildManifestFile);
if (!existsSync(statsPath)) {
  errors.push(
    `${relative(ROOT, statsPath)} is missing; run a production Next.js build before bundle:check`,
  );
}
if (!existsSync(buildManifestPath)) {
  errors.push(`${relative(ROOT, buildManifestPath)} is missing`);
}

const stats = existsSync(statsPath) ? readJson(statsPath) : [];
const buildManifest = existsSync(buildManifestPath) ? readJson(buildManifestPath) : {};
if (!Array.isArray(stats)) {
  errors.push(`${relative(ROOT, statsPath)} must contain a route array`);
}

const rootFiles = new Set(
  [...(buildManifest.rootMainFiles ?? []), ...(buildManifest.polyfillFiles ?? [])].map(
    (path) => path.replace(/^\.next\//, ""),
  ),
);

function matches(pattern, route) {
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return route === prefix || route.startsWith(`${prefix}/`);
  }
  return pattern === route;
}

function routeBudget(route) {
  const candidates = (config.routeBudgets ?? [])
    .filter((entry) => matches(entry.pattern, route))
    .sort((left, right) => right.pattern.length - left.pattern.length);
  return candidates[0]?.maxGzipKiB ?? config.defaultRouteBudgetGzipKiB;
}

const routeReports = [];
const seenRoutes = new Set();
const chunkReports = new Map();
for (const routeStat of Array.isArray(stats) ? stats : []) {
  if (!routeStat.route || !Array.isArray(routeStat.firstLoadChunkPaths)) {
    errors.push("Next route bundle stats contains an invalid route entry");
    continue;
  }
  seenRoutes.add(routeStat.route);
  let routeGzipBytes = 0;
  const chunks = [];
  for (const chunkPath of [...new Set(routeStat.firstLoadChunkPaths)]) {
    const normalizedPath = chunkPath.replace(/^\.next\//, "");
    const absolutePath = join(appDirectory, ".next", normalizedPath);
    if (!existsSync(absolutePath)) {
      errors.push(`${routeStat.route} references missing chunk ${chunkPath}`);
      continue;
    }
    const contents = readFileSync(absolutePath);
    const gzipBytes = gzipSync(contents, { level: 9 }).byteLength;
    const chunk = {
      path: normalizedPath,
      rawBytes: contents.byteLength,
      gzipBytes,
      appOwned: !rootFiles.has(normalizedPath),
    };
    routeGzipBytes += gzipBytes;
    chunks.push(chunk);
    if (!chunkReports.has(normalizedPath)) {
      chunkReports.set(normalizedPath, chunk);
    }
  }

  const budgetKiB = routeBudget(routeStat.route);
  const budgetBytes = Math.round(budgetKiB * 1024);
  const baselineKiB = config.baselineRoutesGzipKiB?.[routeStat.route];
  const growthLimitBytes = baselineKiB
    ? Math.round(baselineKiB * (1 + config.baselineGrowthPercent / 100) * 1024)
    : null;
  if (routeGzipBytes > budgetBytes) {
    errors.push(
      `${routeStat.route} is ${(routeGzipBytes / 1024).toFixed(1)} KiB gzip; budget is ${budgetKiB} KiB`,
    );
  }
  if (growthLimitBytes && routeGzipBytes > growthLimitBytes) {
    errors.push(
      `${routeStat.route} grew beyond ${config.baselineGrowthPercent}% of its ${baselineKiB} KiB baseline`,
    );
  }
  routeReports.push({
    route: routeStat.route,
    rawBytes: routeStat.firstLoadUncompressedJsBytes,
    gzipBytes: routeGzipBytes,
    budgetBytes,
    baselineBytes: baselineKiB ? Math.round(baselineKiB * 1024) : null,
    growthLimitBytes,
    chunks,
  });
}

for (const route of config.requiredRoutes ?? []) {
  if (!seenRoutes.has(route)) {
    errors.push(`Required route ${route} is missing from Next route bundle stats`);
  }
}

const appChunkBudgetBytes = Math.round(config.maxAppChunkGzipKiB * 1024);
for (const chunk of chunkReports.values()) {
  if (chunk.appOwned && chunk.gzipBytes > appChunkBudgetBytes) {
    errors.push(
      `${chunk.path} is ${(chunk.gzipBytes / 1024).toFixed(1)} KiB gzip; app-owned chunk budget is ${config.maxAppChunkGzipKiB} KiB`,
    );
  }
}

const report = {
  schemaVersion: 1,
  gate: "next-route-bundle-budget",
  appDir: relative(ROOT, appDirectory),
  source: relative(ROOT, statsPath),
  passed: errors.length === 0,
  budgets: {
    defaultRouteGzipKiB: config.defaultRouteBudgetGzipKiB,
    maxAppChunkGzipKiB: config.maxAppChunkGzipKiB,
    baselineGrowthPercent: config.baselineGrowthPercent,
  },
  routes: routeReports.sort((left, right) => left.route.localeCompare(right.route)),
  chunks: [...chunkReports.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  ),
  violations: errors,
};

console.log(
  `Bundle manifest: ${routeReports.length} routes, ${chunkReports.size} unique initial chunks`,
);
for (const route of report.routes) {
  console.log(
    `${route.route}: ${(route.gzipBytes / 1024).toFixed(1)} KiB gzip / ${(route.budgetBytes / 1024).toFixed(0)} KiB budget`,
  );
}
finishGate("Next route bundle gate", errors, report, args.value("report"));
