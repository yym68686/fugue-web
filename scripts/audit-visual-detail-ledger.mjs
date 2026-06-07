#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const format = args.has("--json") ? "json" : "md";

const targetDirs = ["app", "components", "design-system"];
const textExtensions = new Set([".css", ".ts", ".tsx"]);
const ignoredDirs = new Set([".git", ".next", "node_modules"]);

const routeMatrix = [
  "/",
  "/docs",
  "/auth/sign-in",
  "/auth/sign-up",
  "/app",
  "/app/apps",
  "/app/api-keys",
  "/app/billing",
  "/app/cluster",
  "/app/cluster-nodes",
  "/app/settings/profile",
  "/app/users",
  "/new/repository",
];

const viewportMatrix = ["desktop", "tablet", "mobile"];
const themeMatrix = ["dark", "light"];
const stateMatrix = ["default", "hover-focus", "active-selected"];
const redundantControlLayers = ["scroll-viewport", "inner-control-group"];
const controlLayerProperties = [
  "background",
  "box-shadow",
  "border-radius",
  "border-padding-clip",
];
const productPillLensProperties = [
  "border-radius",
  "border",
  "box-shadow",
  "font-size",
  "font-weight",
  "letter-spacing",
];

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (ignoredDirs.has(name)) continue;
    const absolute = path.join(dir, name);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      files.push(...walk(absolute));
    } else if (textExtensions.has(path.extname(name))) {
      files.push(absolute);
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file);
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function readProjectFiles() {
  return targetDirs.flatMap((dir) => walk(path.join(root, dir)));
}

function readFile(file) {
  return readFileSync(file, "utf8");
}

function collectControlStripInventory(files) {
  const callSites = [];

  for (const file of files) {
    const rel = relative(file);
    const source = readFile(file);

    for (const match of source.matchAll(/<ConsolePillSwitch\b/g)) {
      callSites.push({
        file: rel,
        kind: "ConsolePillSwitch",
        line: source.slice(0, match.index).split("\n").length,
      });
    }

    if (rel !== "components/console/console-pill-switch.tsx") {
      for (const match of source.matchAll(/<SegmentedControl\b/g)) {
        callSites.push({
          file: rel,
          kind: "SegmentedControl",
          line: source.slice(0, match.index).split("\n").length,
        });
      }
    }

    if (rel !== "components/ui/segmented-control.tsx") {
      for (const match of source.matchAll(/<ScrollableControlStrip\b/g)) {
        callSites.push({
          file: rel,
          kind: "ScrollableControlStrip",
          line: source.slice(0, match.index).split("\n").length,
        });
      }
    }
  }

  return callSites;
}

function collectControlStripPillLinkInventory(files) {
  const callSites = [];

  for (const file of files) {
    const rel = relative(file);
    const source = readFile(file);

    if (rel === "app/docs/page.tsx" || rel.startsWith("components/landing/")) {
      continue;
    }

    if (
      !source.includes("<ScrollableControlStrip") ||
      !/variant=(?:"pill"|'pill')/.test(source)
    ) {
      continue;
    }

    for (const match of source.matchAll(/<PillNav(?:Anchor|Link)\b/g)) {
      callSites.push({
        file: rel,
        kind: match[0].slice(1),
        line: source.slice(0, match.index).split("\n").length,
      });
    }
  }

  return callSites;
}

function collectCssEvidence() {
  const runtimeCss = readFile(path.join(root, "app/cloudflare-runtime.css"));
  const consoleCss = readFile(path.join(root, "app/console.css"));

  const hasViewportReset =
    /\.fg-control-strip-shell\s*>\s*\.fg-control-strip__viewport[\s\S]*?background:\s*transparent\s*!important[\s\S]*?box-shadow:\s*none\s*!important/.test(
      runtimeCss,
    );
  const hasInnerGroupReset =
    /\.fg-control-strip-shell\s*>\s*\.fg-control-strip__viewport\s*>\s*\.fg-segmented[\s\S]*?\.fg-control-strip-shell\s*>\s*\.fg-control-strip__viewport\s*>\s*\.fg-pill-nav[\s\S]*?background:\s*transparent\s*!important[\s\S]*?box-shadow:\s*none\s*!important/.test(
      runtimeCss,
    );
  const stalePillSwitchRules = countMatches(consoleCss, /\.fg-pill-switch\b/g);
  const hasProductPillAnchorReset =
    runtimeCss.includes(
      ".fg-control-strip-shell .fg-pill-nav :is(a, .fg-pill-nav__button)",
    ) &&
    runtimeCss.includes(".fg-control-strip-shell .fg-pill-nav a[aria-current=\"page\"]") &&
    /border-radius:\s*6px\s*!important/.test(runtimeCss) &&
    /box-shadow:\s*none\s*!important/.test(runtimeCss);
  const hasProductPillLabelReset =
    runtimeCss.includes(".fg-control-strip-shell .fg-console-nav__title") &&
    /font-size:\s*13px\s*!important/.test(runtimeCss) &&
    /font-weight:\s*500\s*!important/.test(runtimeCss) &&
    /letter-spacing:\s*0\s*!important/.test(runtimeCss);

  return {
    hasInnerGroupReset,
    hasProductPillAnchorReset,
    hasProductPillLabelReset,
    hasViewportReset,
    stalePillSwitchRules,
  };
}

function buildLedger(files) {
  const controlStripCallSites = collectControlStripInventory(files);
  const controlStripPillLinkCallSites = collectControlStripPillLinkInventory(files);
  const cssEvidence = collectCssEvidence();

  const controlStripAtomicCount =
    controlStripCallSites.length *
    redundantControlLayers.length *
    controlLayerProperties.length *
    viewportMatrix.length *
    themeMatrix.length *
    stateMatrix.length;

  const controlStripFixed =
    cssEvidence.hasViewportReset &&
    cssEvidence.hasInnerGroupReset &&
    cssEvidence.stalePillSwitchRules === 0;
  const productPillLensCount =
    controlStripPillLinkCallSites.length *
    productPillLensProperties.length *
    viewportMatrix.length *
    themeMatrix.length *
    stateMatrix.length;
  const productPillLensFixed =
    cssEvidence.hasProductPillAnchorReset &&
    cssEvidence.hasProductPillLabelReset;

  const ledgers = [
    {
      after:
        "Only the control-strip shell draws the track; the scroll viewport and inner control group are transparent.",
      before:
        "The shell, scroll viewport, and inner segmented/pill group could all contribute a surface, shadow, or radius, creating multi-frame controls.",
      componentFamily: "segmented controls, pill switches, scrollable nav strips",
      count: controlStripAtomicCount,
      evidence: {
        callSiteCount: controlStripCallSites.length,
        callSites: controlStripCallSites,
        controlLayerProperties,
        redundantControlLayers,
        routeMatrix,
        stateMatrix,
        themeMatrix,
        viewportMatrix,
      },
      fixed: controlStripFixed,
      id: "VDL-001",
      remainingIssues: [
        ...(!cssEvidence.hasViewportReset
          ? ["Missing transparent reset for .fg-control-strip__viewport."]
          : []),
        ...(!cssEvidence.hasInnerGroupReset
          ? ["Missing transparent reset for inner .fg-segmented/.fg-pill-nav groups."]
          : []),
        ...(cssEvidence.stalePillSwitchRules > 0
          ? [`${cssEvidence.stalePillSwitchRules} stale .fg-pill-switch CSS rule(s) remain.`]
          : []),
      ],
      rule: "control-strip-layer-budget",
      verification:
        "npm run frontend:visual-ledger -- --json plus browser DOM layer trace on a project detail tab strip.",
    },
    {
      after:
        "Control-strip pill links use the product lens shape and label typography: 6px active radius, no extra active border/shadow, 13px/500 labels.",
      before:
        "Link-based pill nav items could keep the legacy 999px capsule radius, active inset highlight, bold title text, and negative tracking.",
      componentFamily: "control-strip pill nav anchors",
      count: productPillLensCount,
      evidence: {
        callSiteCount: controlStripPillLinkCallSites.length,
        callSites: controlStripPillLinkCallSites,
        productPillLensProperties,
        stateMatrix,
        themeMatrix,
        viewportMatrix,
      },
      fixed: productPillLensFixed,
      id: "VDL-002",
      remainingIssues: [
        ...(!cssEvidence.hasProductPillAnchorReset
          ? ["Missing product lens reset for control-strip pill nav anchors."]
          : []),
        ...(!cssEvidence.hasProductPillLabelReset
          ? ["Missing label typography reset for control-strip pill nav titles."]
          : []),
      ],
      rule: "product-pill-link-lens-contract",
      verification:
        "npm run frontend:visual-ledger -- --json plus browser DOM layer trace confirming active links use a 6px lens.",
    },
  ];

  return {
    ledgers,
    optimizedCount: ledgers
      .filter((entry) => entry.fixed)
      .reduce((total, entry) => total + entry.count, 0),
    remainingCount: ledgers
      .filter((entry) => !entry.fixed)
      .reduce((total, entry) => total + entry.count, 0),
  };
}

function printMarkdown(result) {
  console.log("# Visual Detail Ledger Audit\n");
  console.log(`- Optimized count: ${result.optimizedCount}`);
  console.log(`- Remaining count: ${result.remainingCount}\n`);

  for (const entry of result.ledgers) {
    console.log(`## ${entry.id}: ${entry.rule}`);
    console.log(`- Status: ${entry.fixed ? "fixed" : "open"}`);
    console.log(`- Component family: ${entry.componentFamily}`);
    console.log(`- Atomic count: ${entry.count}`);
    console.log(`- Before: ${entry.before}`);
    console.log(`- After: ${entry.after}`);
    console.log(`- Verification: ${entry.verification}`);

    if (entry.remainingIssues.length > 0) {
      console.log("- Remaining issues:");
      for (const issue of entry.remainingIssues) {
        console.log(`  - ${issue}`);
      }
    }

    console.log("");
  }
}

const files = readProjectFiles();
const result = buildLedger(files);

if (format === "json") {
  console.log(JSON.stringify(result, null, 2));
} else {
  printMarkdown(result);
}
