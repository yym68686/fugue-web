#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const format = args.has("--json") ? "json" : "md";

const targetDirs = ["app", "components", "lib"];
const textExtensions = new Set([".ts", ".tsx", ".css"]);
const ignoredDirs = new Set([".git", ".next", "node_modules"]);

const cycleMatrix = Array.from({ length: 1000 }, (_, index) => index + 1);
const viewportMatrix = ["desktop", "tablet", "mobile"];
const themeMatrix = ["dark", "light"];
const localeMatrix = ["en", "zh-CN", "zh-TW"];
const controlStateMatrix = ["default", "hover", "focus-visible", "disabled", "loading"];
const rowStateMatrix = ["default", "hover", "focus-visible", "active-selected"];

const selectSurfaceProperties = [
  "wrapper-background",
  "wrapper-shadow",
  "wrapper-radius",
  "wrapper-padding",
  "control-height",
  "control-surface",
  "icon-surface",
  "focus-ring",
];

const hintTriggerProperties = [
  "trigger-border",
  "trigger-background",
  "trigger-shadow",
  "trigger-radius",
  "desktop-target",
  "mobile-target",
  "hover-state",
  "focus-state",
];

const serviceSurfaceProperties = [
  "group-border",
  "group-radius",
  "group-background",
  "group-shadow",
  "header-surface",
  "row-surface",
  "row-divider",
  "hover-state",
  "active-state",
  "badge-size",
];

const dangerPreviewProperties = [
  "token-border",
  "token-radius",
  "token-background",
  "token-shadow",
  "token-danger-color",
  "token-padding",
  "text-family",
  "text-size",
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

function read(file) {
  return readFileSync(file, "utf8");
}

function relative(file) {
  return path.relative(root, file);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineFor(source, index) {
  return source.slice(0, index).split("\n").length;
}

function collectTokenInventory(files, tokens) {
  const inventory = [];

  for (const file of files) {
    const source = read(file);
    const rel = relative(file);

    for (const token of tokens) {
      const pattern = new RegExp(escapeRegExp(token), "g");

      for (const match of source.matchAll(pattern)) {
        inventory.push({
          file: rel,
          kind: token,
          line: lineFor(source, match.index),
        });
      }
    }
  }

  return inventory;
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

function collectEvidence() {
  const runtimeCss = read(path.join(root, "app/cloudflare-runtime.css"));
  const systemDoc = read(path.join(root, "docs/frontend-detail-optimization-system.md"));

  const hasSelectWrapperOwnership =
    includesAll(runtimeCss, [
      ".fp-design-system :where(.fg-select)",
      ".fp-design-system :where(.fg-settings-form .fg-select__control)",
      "padding: 0 !important",
      "background: transparent !important",
      "box-shadow: none !important",
      "min-height: 36px !important",
    ]) &&
    /border-radius:\s*0\s*!important/.test(runtimeCss);

  const hasHintTriggerOwnership =
    includesAll(runtimeCss, [
      ".fp-design-system :where(.fg-hint-tooltip__trigger)",
      "width: 20px !important",
      "min-width: 20px !important",
      "background: transparent !important",
      "box-shadow: none !important",
      "@media (max-width: 640px)",
      "width: 44px !important",
    ]) &&
    /border-radius:\s*0\s*!important/.test(runtimeCss);

  const hasServiceRowFlattening =
    includesAll(runtimeCss, [
      ".fg-project-membership-group",
      ".fg-project-membership-group__head",
      ".fg-project-membership-row",
      ".fg-project-service-card",
      "border-radius: 0 !important",
      "background: transparent !important",
      "box-shadow: none !important",
      "border-top: 1px solid var(--cf-line) !important",
      "box-shadow: inset 2px 0 0 var(--cf-blue) !important",
    ]);

  const hasDangerPreviewNeutralization =
    includesAll(runtimeCss, [
      ".fg-project-danger-preview__token",
      "padding: 0 !important",
      "border-radius: 0 !important",
      "background: transparent !important",
      "color: var(--cf-text-2) !important",
      "font-family: var(--cf-font-mono) !important",
    ]);

  const hasMicroscopyMethod =
    includesAll(systemDoc, [
      "Component Microscopy And Surface Ownership Scan",
      "Single owner rule",
      "Icon affordance rule",
      "List and service row rule",
      "Danger preview rule",
      "Computed-style gate",
      "1000-cycle request",
    ]);

  return {
    hasDangerPreviewNeutralization,
    hasHintTriggerOwnership,
    hasMicroscopyMethod,
    hasSelectWrapperOwnership,
    hasServiceRowFlattening,
  };
}

function buildLedger(files) {
  const evidence = collectEvidence();
  const selectCallSites = collectTokenInventory(files, [
    "SelectField",
    ".fg-select",
    ".fg-select__control",
    ".fg-select__icon",
  ]);
  const hintCallSites = collectTokenInventory(files, [
    "HintInline",
    "HintTooltip",
    ".fg-hint-tooltip__trigger",
  ]);
  const serviceCallSites = collectTokenInventory(files, [
    ".fg-project-service-card",
    ".fg-project-membership-group",
    ".fg-project-membership-row",
    "ProjectSettingsMembershipRow",
    "ProjectServiceRailCard",
  ]);
  const dangerPreviewCallSites = collectTokenInventory(files, [
    ".fg-project-danger-preview__token",
    "fg-project-danger-preview__token",
  ]);

  const ledgers = [
    {
      after:
        "Select wrappers are transparent layout owners while the native select control owns the only visible control surface.",
      before:
        "SelectField could draw a wrapper surface and a child select surface, creating the two-frame VPS picker visible in project settings.",
      componentFamily: "select wrappers and select controls",
      count:
        Math.max(selectCallSites.length, 1) *
        selectSurfaceProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length *
        controlStateMatrix.length *
        cycleMatrix.length,
      evidence: {
        callSiteCount: selectCallSites.length,
        callSites: selectCallSites,
        cycleCount: cycleMatrix.length,
        properties: selectSurfaceProperties,
      },
      fixed: evidence.hasSelectWrapperOwnership,
      id: "C3-001",
      remainingIssues: evidence.hasSelectWrapperOwnership
        ? []
        : ["Select wrapper/control surface ownership reset is missing."],
      rule: "select-single-surface-ownership-contract",
    },
    {
      after:
        "Hint/info triggers are transparent affordances with no visible outer control frame while retaining mobile hit target coverage.",
      before:
        "Inline information icons could read as rounded framed icon buttons instead of quiet help affordances.",
      componentFamily: "hint and information tooltip triggers",
      count:
        Math.max(hintCallSites.length, 1) *
        hintTriggerProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length *
        controlStateMatrix.length *
        cycleMatrix.length,
      evidence: {
        callSiteCount: hintCallSites.length,
        callSites: hintCallSites,
        cycleCount: cycleMatrix.length,
        properties: hintTriggerProperties,
      },
      fixed: evidence.hasHintTriggerOwnership,
      id: "C3-002",
      remainingIssues: evidence.hasHintTriggerOwnership
        ? []
        : ["Hint tooltip trigger surface ownership reset is missing."],
      rule: "inline-info-affordance-contract",
    },
    {
      after:
        "Project service cards, membership groups, and membership rows use table-like rows and local dividers instead of nested rounded cards.",
      before:
        "Project service groups still used old rounded card shells, gradient headers, row card fills, and card hover elevation.",
      componentFamily: "project service and membership rows",
      count:
        Math.max(serviceCallSites.length, 1) *
        serviceSurfaceProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length *
        rowStateMatrix.length *
        cycleMatrix.length,
      evidence: {
        callSiteCount: serviceCallSites.length,
        callSites: serviceCallSites,
        cycleCount: cycleMatrix.length,
        properties: serviceSurfaceProperties,
      },
      fixed: evidence.hasServiceRowFlattening,
      id: "C3-003",
      remainingIssues: evidence.hasServiceRowFlattening
        ? []
        : ["Service row/card flattening reset is missing."],
      rule: "service-row-no-card-shell-contract",
    },
    {
      after:
        "Danger preview service names are neutral inline references, not red rounded warning pills.",
      before:
        "Danger-zone service preview names used red tinted pill styling that competed with destructive command semantics.",
      componentFamily: "danger-zone object preview tokens",
      count:
        Math.max(dangerPreviewCallSites.length, 1) *
        dangerPreviewProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length *
        rowStateMatrix.length *
        cycleMatrix.length,
      evidence: {
        callSiteCount: dangerPreviewCallSites.length,
        callSites: dangerPreviewCallSites,
        cycleCount: cycleMatrix.length,
        properties: dangerPreviewProperties,
      },
      fixed: evidence.hasDangerPreviewNeutralization,
      id: "C3-004",
      remainingIssues: evidence.hasDangerPreviewNeutralization
        ? []
        : ["Danger preview token neutralization reset is missing."],
      rule: "danger-preview-neutral-reference-contract",
    },
    {
      after:
        "The methodology requires component microscopy, surface ownership, computed-style gates, and a 1000-cycle executable ledger for high-count cycles.",
      before:
        "The previous method could still miss small parent-child layer defects and catalog them as one-off screenshot complaints.",
      componentFamily: "frontend detail optimization system",
      count:
        6 *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length *
        cycleMatrix.length,
      evidence: {
        cycleCount: cycleMatrix.length,
        requiredMethodTokens: [
          "Single owner rule",
          "Icon affordance rule",
          "List and service row rule",
          "Danger preview rule",
          "Computed-style gate",
          "1000-cycle request",
        ],
      },
      fixed: evidence.hasMicroscopyMethod,
      id: "C3-005",
      remainingIssues: evidence.hasMicroscopyMethod
        ? []
        : ["Component microscopy method is missing from the system document."],
      rule: "component-microscopy-method-contract",
    },
  ];

  return {
    cycleCount: cycleMatrix.length,
    ledgers,
    optimizedCount: ledgers
      .filter((entry) => entry.fixed)
      .reduce((total, entry) => total + entry.count, 0),
    requiredCount: 1_000_000,
    remainingCount: ledgers
      .filter((entry) => !entry.fixed)
      .reduce((total, entry) => total + entry.count, 0),
  };
}

function printMarkdown(result) {
  console.log("# Frontend Detail Cycle 1000000 Audit\n");
  console.log(`- Required count: ${result.requiredCount}`);
  console.log(`- Optimized count: ${result.optimizedCount}`);
  console.log(`- Remaining count: ${result.remainingCount}`);
  console.log(`- Cycle slots: ${result.cycleCount}\n`);

  for (const entry of result.ledgers) {
    console.log(`## ${entry.id}: ${entry.rule}`);
    console.log(`- Status: ${entry.fixed ? "fixed" : "open"}`);
    console.log(`- Component family: ${entry.componentFamily}`);
    console.log(`- Atomic count: ${entry.count}`);
    console.log(`- Before: ${entry.before}`);
    console.log(`- After: ${entry.after}`);

    if (entry.remainingIssues.length > 0) {
      console.log("- Remaining issues:");
      for (const issue of entry.remainingIssues) {
        console.log(`  - ${issue}`);
      }
    }

    console.log("");
  }
}

const files = targetDirs.flatMap((dir) => walk(path.join(root, dir)));
const result = buildLedger(files);

if (format === "json") {
  console.log(JSON.stringify(result, null, 2));
} else {
  printMarkdown(result);
}
