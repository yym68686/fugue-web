import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

import { finishGate, listFiles, parseArgs, ROOT, readJson } from "./lib.mjs";

const STYLE_ROOT = join(ROOT, "test", "style-audit");
const APP_ROOT = join(ROOT, "apps", "web", "app");
const SOURCE_ROOTS = [
  join(ROOT, "apps", "web", "app"),
  join(ROOT, "apps", "web", "components"),
  join(ROOT, "apps", "ui", "registry"),
  join(ROOT, "packages", "ui", "src"),
];
const SOURCE_EXTENSIONS = new Set([".css", ".js", ".jsx", ".ts", ".tsx"]);
const REQUIRED_ROUTE_KEYS = [
  "auth",
  "category",
  "id",
  "locales",
  "states",
  "themes",
  "url",
  "viewports",
];
const args = parseArgs();
const errors = [];

function routeFromPage(pagePath) {
  const segments = relative(APP_ROOT, dirname(pagePath))
    .split(/[\\/]/)
    .filter(Boolean)
    .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"))
    .map((segment) => {
      const optionalCatchAll = segment.match(/^\[\[\.\.\.(.+)\]\]$/);
      if (optionalCatchAll) {
        return `:${optionalCatchAll[1]}?`;
      }
      const catchAll = segment.match(/^\[\.\.\.(.+)\]$/);
      if (catchAll) {
        return `:${catchAll[1]}*`;
      }
      const dynamic = segment.match(/^\[(.+)\]$/);
      return dynamic ? `:${dynamic[1]}` : segment;
    });
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function selectorNeedle(selector) {
  const classMatch = selector.match(/\.([A-Za-z0-9_-]+)/);
  if (classMatch) {
    return classMatch[1];
  }
  const attributeMatch = selector.match(/\[[-A-Za-z0-9_:]+=(?:'|")([^'"]+)(?:'|")\]/);
  return attributeMatch?.[1] ?? selector;
}

if (!existsSync(STYLE_ROOT)) {
  errors.push("test/style-audit is missing");
}
if (!existsSync(APP_ROOT)) {
  errors.push("apps/web/app is missing");
}

const statesDocument = readJson(join(STYLE_ROOT, "states.json"));
const routesDocument = readJson(join(STYLE_ROOT, "routes.json"));
if (statesDocument.schemaVersion !== 1) {
  errors.push("test/style-audit/states.json schemaVersion must be 1");
}
if (routesDocument.schemaVersion !== 1) {
  errors.push("test/style-audit/routes.json schemaVersion must be 1");
}

const stateIds = new Set();
for (const state of statesDocument.states ?? []) {
  if (!state.id || !state.category || !state.fixture) {
    errors.push("Every state needs id, category and deterministic fixture fields");
    continue;
  }
  if (stateIds.has(state.id)) {
    errors.push(`Duplicate state id: ${state.id}`);
  }
  stateIds.add(state.id);
}

const sourceFiles = SOURCE_ROOTS.flatMap((directory) =>
  listFiles(directory, (path) => SOURCE_EXTENSIONS.has(extname(path))),
);
const sourceCorpus = sourceFiles.map((path) => readFileSync(path, "utf8")).join("\n");
const actualPages = listFiles(APP_ROOT, (path) =>
  /^page\.[jt]sx?$/.test(path.split(/[\\/]/).at(-1) ?? ""),
);
const pageByRoute = new Map(actualPages.map((path) => [routeFromPage(path), path]));

const routeIds = new Set();
const inventoryUrls = new Set();
let matrixCells = 0;
for (const route of routesDocument.routes ?? []) {
  for (const key of REQUIRED_ROUTE_KEYS) {
    if (route[key] === undefined || route[key] === null) {
      errors.push(`${route.id ?? "Unknown route"} is missing ${key}`);
    }
  }
  if (routeIds.has(route.id)) {
    errors.push(`Duplicate route id: ${route.id}`);
  }
  routeIds.add(route.id);
  if (inventoryUrls.has(route.url)) {
    errors.push(`Duplicate route URL: ${route.url}`);
  }
  inventoryUrls.add(route.url);

  if (!pageByRoute.has(route.url)) {
    errors.push(`${route.id} inventories ${route.url}, but no App Router page exists`);
  }
  if (!route.readySelector && !route.redirectTo) {
    errors.push(`${route.id} needs readySelector or redirectTo`);
  }
  if (route.readySelector) {
    const needle = selectorNeedle(route.readySelector);
    if (!sourceCorpus.includes(needle)) {
      errors.push(
        `${route.id} readySelector ${route.readySelector} is not present in source`,
      );
    }
  }
  if (route.redirectTo) {
    const pagePath = pageByRoute.get(route.url);
    const pageSource = pagePath ? readFileSync(pagePath, "utf8") : "";
    if (!pageSource.includes("redirect(") || !pageSource.includes(route.redirectTo)) {
      errors.push(`${route.id} does not statically redirect to ${route.redirectTo}`);
    }
  }

  for (const state of route.states ?? []) {
    if (!stateIds.has(state)) {
      errors.push(`${route.id} references unknown state ${state}`);
    }
  }
  for (const requiredTheme of ["light", "dark"]) {
    if (!route.themes?.includes(requiredTheme)) {
      errors.push(`${route.id} does not cover ${requiredTheme} theme`);
    }
  }
  for (const requiredViewport of ["desktop", "mobile"]) {
    if (!route.viewports?.includes(requiredViewport)) {
      errors.push(`${route.id} does not cover ${requiredViewport} viewport`);
    }
  }
  for (const requiredLocale of ["en", "zh-CN", "zh-TW"]) {
    if (!route.locales?.includes(requiredLocale)) {
      errors.push(`${route.id} does not cover ${requiredLocale} locale`);
    }
  }
  matrixCells +=
    (route.states?.length ?? 0) *
    (route.themes?.length ?? 0) *
    (route.locales?.length ?? 0) *
    (route.viewports?.length ?? 0);
}

for (const [route, pagePath] of pageByRoute) {
  if (!inventoryUrls.has(route)) {
    errors.push(
      `Unknown App Router page ${route} (${relative(ROOT, pagePath)}) has no style-audit inventory`,
    );
  }
}

const contractIds = new Set();
let contractCount = 0;
const contractFiles = listFiles(
  join(STYLE_ROOT, "contracts"),
  (path) => extname(path) === ".json",
);
if (contractFiles.length === 0) {
  errors.push("No style contracts were found");
}
for (const contractFile of contractFiles) {
  const document = readJson(contractFile);
  if (document.schemaVersion !== 1) {
    errors.push(`${relative(ROOT, contractFile)} schemaVersion must be 1`);
  }
  for (const contract of document.contracts ?? []) {
    contractCount += 1;
    if (!contract.id || !contract.sourceFile || !contract.rootSelector) {
      errors.push(
        `${relative(ROOT, contractFile)} contains a contract without id, sourceFile or rootSelector`,
      );
      continue;
    }
    if (contractIds.has(contract.id)) {
      errors.push(`Duplicate contract id: ${contract.id}`);
    }
    contractIds.add(contract.id);
    if (
      !new Set(["blocker", "warning", "review", "baseline"]).has(contract.strictness)
    ) {
      errors.push(`${contract.id} has invalid strictness ${contract.strictness}`);
    }
    if (!contract.surfaceOwner) {
      errors.push(`${contract.id} must name its visible surface owner`);
    }
    for (const state of contract.states ?? []) {
      if (!stateIds.has(state)) {
        errors.push(`${contract.id} references unknown state ${state}`);
      }
    }
    if (!Array.isArray(contract.states) || contract.states.length === 0) {
      errors.push(`${contract.id} must cover at least one state`);
    }

    const sourcePath = resolve(ROOT, contract.sourceFile);
    if (!existsSync(sourcePath)) {
      errors.push(`${contract.id} source file does not exist: ${contract.sourceFile}`);
      continue;
    }
    const source = readFileSync(sourcePath, "utf8");
    if (
      !Array.isArray(contract.requiredSourcePatterns) ||
      contract.requiredSourcePatterns.length === 0
    ) {
      errors.push(`${contract.id} must define requiredSourcePatterns`);
    }
    for (const pattern of contract.requiredSourcePatterns ?? []) {
      if (!source.includes(pattern)) {
        errors.push(
          `${contract.id} expected ${JSON.stringify(pattern)} in ${contract.sourceFile}`,
        );
      }
    }
  }
}

const report = {
  schemaVersion: 1,
  gate: "style-audit-static-inventory",
  mode: "static",
  passed: errors.length === 0,
  coverage: {
    actualRoutes: pageByRoute.size,
    inventoriedRoutes: inventoryUrls.size,
    states: stateIds.size,
    contracts: contractCount,
    matrixCells,
    renderedAssertions: 0,
  },
  note: "This gate proves static inventory and contract/source coverage. Playwright computed-style, axe and screenshot jobs provide rendered verification separately.",
  violations: errors,
};

console.log(
  `Style inventory: ${inventoryUrls.size}/${pageByRoute.size} routes, ${stateIds.size} states, ${contractCount} contracts, ${matrixCells} matrix cells`,
);
finishGate("Style-audit static gate", errors, report, args.value("report"));
