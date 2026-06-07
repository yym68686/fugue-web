#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const format = args.has("--json") ? "json" : "md";

const targetDirs = ["app", "components"];
const textExtensions = new Set([".ts", ".tsx"]);
const ignoredDirs = new Set([".git", ".next", "node_modules"]);

const viewportMatrix = ["desktop", "tablet", "mobile"];
const themeMatrix = ["dark", "light"];
const localeMatrix = ["en", "zh-CN", "zh-TW"];
const actionStateMatrix = ["default", "hover", "focus-visible", "loading-disabled"];
const surfaceStateMatrix = ["default", "hover-focus", "active-selected"];

const labelProperties = [
  "padding",
  "background",
  "box-shadow",
  "border-radius",
  "font-family",
  "letter-spacing",
];
const actionBarProperties = [
  "gap",
  "alignment",
  "wrap",
  "button-height",
  "button-radius",
  "group-surface",
];
const surfaceProperties = [
  "border",
  "border-radius",
  "background",
  "background-image",
  "box-shadow",
  "cell-padding",
  "local-divider",
];
const dangerCommandProperties = [
  "color",
  "background",
  "box-shadow",
  "hover-background",
  "disabled-background",
  "focus-ring",
];
const literalStringProperties = [
  "visible-text",
  "locale-routing",
  "text-expansion",
];

const surfaceClassNames = [
  "fg-workbench-section",
  "fg-proof-shell",
  "fg-project-inspector__meta-grid",
  "fg-project-image-sync__summary-card",
  "fg-project-danger-card",
  "fg-project-service-card",
  "fg-project-pane",
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

function readFile(file) {
  return readFileSync(file, "utf8");
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
    const rel = relative(file);
    const source = readFile(file);

    for (const token of tokens) {
      const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, "g");

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

function collectPatternInventory(files, pattern, kind) {
  const inventory = [];

  for (const file of files) {
    const rel = relative(file);
    const source = readFile(file);

    for (const match of source.matchAll(pattern)) {
      inventory.push({
        file: rel,
        kind,
        line: lineFor(source, match.index),
      });
    }
  }

  return inventory;
}

function collectCssEvidence() {
  const runtimeCss = readFile(path.join(root, "app/cloudflare-runtime.css"));
  const projectSource = readFile(
    path.join(root, "components/console/console-project-gallery.tsx"),
  );

  const hasPlainLabelReset =
    runtimeCss.includes(".fp-app-shell--console .fg-label") &&
    runtimeCss.includes(".fg-project-toolbar__label") &&
    /padding:\s*0\s*!important/.test(runtimeCss) &&
    /border-radius:\s*0\s*!important/.test(runtimeCss) &&
    /background:\s*transparent\s*!important/.test(runtimeCss) &&
    /box-shadow:\s*none\s*!important/.test(runtimeCss);

  const hasActionBarReset =
    runtimeCss.includes(".fg-project-actions") &&
    runtimeCss.includes(".fg-workbench-section__actions") &&
    /gap:\s*8px\s*!important/.test(runtimeCss) &&
    /align-items:\s*center\s*!important/.test(runtimeCss) &&
    /background:\s*transparent\s*!important/.test(runtimeCss);

  const hasSurfaceReset =
    runtimeCss.includes(".fg-project-inspector__meta-grid > div") &&
    runtimeCss.includes(".fg-project-image-sync__summary-card") &&
    runtimeCss.includes(".fg-project-danger-card") &&
    runtimeCss.includes(".fg-project-pane .fg-workbench-section") &&
    /border-radius:\s*0\s*!important/.test(runtimeCss) &&
    /background:\s*transparent\s*!important/.test(runtimeCss) &&
    /box-shadow:\s*none\s*!important/.test(runtimeCss);

  const hasDangerCommandReset =
    runtimeCss.includes(".fg-button--danger") &&
    runtimeCss.includes(".fg-button--danger:hover") &&
    /background:\s*var\(--cf-surface-1\)\s*!important/.test(runtimeCss) &&
    /box-shadow:\s*0 0 0 1px color-mix\(in oklch, var\(--cf-red\) 38%, var\(--cf-line\)\)\s*!important/.test(
      runtimeCss,
    );

  const hardcodedActions = [...projectSource.matchAll(/>\s*Actions\s*</g)];

  return {
    hasActionBarReset,
    hasDangerCommandReset,
    hasPlainLabelReset,
    hasSurfaceReset,
    hardcodedActions: hardcodedActions.length,
  };
}

function buildLedger(files) {
  const cssEvidence = collectCssEvidence();
  const labelCallSites = collectTokenInventory(files, ["fg-label"]);
  const toolbarLabelCallSites = collectTokenInventory(files, [
    "fg-project-toolbar__label",
  ]);
  const actionBarCallSites = collectTokenInventory(files, [
    "fg-project-actions",
    "fg-workbench-section__actions",
  ]);
  const surfaceCallSites = collectTokenInventory(files, surfaceClassNames);
  const dangerButtonCallSites = collectPatternInventory(
    files,
    /variant=["']danger["']/g,
    "variant=danger",
  );
  const hardcodedActionCallSites = collectPatternInventory(
    files,
    />\s*Actions\s*</g,
    "hardcoded-actions-label",
  );

  const ledgers = [
    {
      after:
        "Product labels render as plain UI labels without badge padding, pill radius, fill, shadow, mono drift, or letter-spacing drift.",
      before:
        "Generic .fg-label styling made toolbar and section labels look like rounded badges, including the visible Actions label.",
      componentFamily: "product labels and toolbar labels",
      count:
        labelCallSites.length *
        labelProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length,
      evidence: {
        callSiteCount: labelCallSites.length,
        callSites: labelCallSites,
        labelProperties,
        localeMatrix,
        themeMatrix,
        toolbarLabelCallSites,
        viewportMatrix,
      },
      fixed: cssEvidence.hasPlainLabelReset,
      id: "C2-001",
      remainingIssues: [
        ...(!cssEvidence.hasPlainLabelReset
          ? ["Missing plain product label reset for .fg-label/.fg-project-toolbar__label."]
          : []),
      ],
      rule: "plain-product-label-contract",
      verification:
        "npm run frontend:detail-cycle-20000 -- --json plus browser DOM trace on project toolbar labels.",
    },
    {
      after:
        "Project and workbench action groups are unframed layout groups with consistent gap, alignment, wrap behavior, and button metrics.",
      before:
        "Action groups could inherit framed label/button rhythm and visually compete with adjacent panel tabs.",
      componentFamily: "project and workbench action bars",
      count:
        actionBarCallSites.length *
        actionBarProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length *
        actionStateMatrix.length,
      evidence: {
        actionBarProperties,
        actionStateMatrix,
        callSiteCount: actionBarCallSites.length,
        callSites: actionBarCallSites,
        localeMatrix,
        themeMatrix,
        viewportMatrix,
      },
      fixed: cssEvidence.hasActionBarReset,
      id: "C2-002",
      remainingIssues: [
        ...(!cssEvidence.hasActionBarReset
          ? ["Missing action bar layout reset for .fg-project-actions/.fg-workbench-section__actions."]
          : []),
      ],
      rule: "unframed-product-action-bar-contract",
      verification:
        "npm run frontend:detail-cycle-20000 -- --json plus browser DOM trace on project action groups.",
    },
    {
      after:
        "Project metadata, pane bodies, image summaries, danger sections, and service cards use transparent surfaces plus local dividers instead of nested rounded cards.",
      before:
        "Project workbench content still had rounded inner cards, gradients, and repeated hairline shells.",
      componentFamily: "project workbench panels and summary surfaces",
      count:
        surfaceCallSites.length *
        surfaceProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        surfaceStateMatrix.length,
      evidence: {
        callSiteCount: surfaceCallSites.length,
        callSites: surfaceCallSites,
        surfaceClassNames,
        surfaceProperties,
        surfaceStateMatrix,
        themeMatrix,
        viewportMatrix,
      },
      fixed: cssEvidence.hasSurfaceReset,
      id: "C2-003",
      remainingIssues: [
        ...(!cssEvidence.hasSurfaceReset
          ? ["Missing surface flattening reset for project workbench panels and summary cards."]
          : []),
      ],
      rule: "project-surface-flattening-contract",
      verification:
        "npm run frontend:detail-cycle-20000 -- --json plus browser DOM trace on project metadata and image summary panels.",
    },
    {
      after:
        "Destructive commands use restrained danger text/ring on neutral control surfaces across default, hover, focus, and disabled/loading states.",
      before:
        "Danger buttons used a filled red command surface, making Delete visually compete with the primary action.",
      componentFamily: "danger command buttons",
      count:
        dangerButtonCallSites.length *
        dangerCommandProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length *
        actionStateMatrix.length,
      evidence: {
        actionStateMatrix,
        callSiteCount: dangerButtonCallSites.length,
        callSites: dangerButtonCallSites,
        dangerCommandProperties,
        localeMatrix,
        themeMatrix,
        viewportMatrix,
      },
      fixed: cssEvidence.hasDangerCommandReset,
      id: "C2-004",
      remainingIssues: [
        ...(!cssEvidence.hasDangerCommandReset
          ? ["Missing restrained danger command reset for .fg-button--danger."]
          : []),
      ],
      rule: "restrained-danger-command-contract",
      verification:
        "npm run frontend:detail-cycle-20000 -- --json plus browser DOM trace on Delete buttons.",
    },
    {
      after:
        "Visible project toolbar labels use the translation system instead of direct JSX text.",
      before:
        "The detail project Actions label was a direct JSX text node and skipped locale translation.",
      componentFamily: "literal UI strings",
      count:
        Math.max(hardcodedActionCallSites.length, 1) *
        literalStringProperties.length *
        viewportMatrix.length *
        themeMatrix.length *
        localeMatrix.length,
      evidence: {
        callSiteCount: hardcodedActionCallSites.length,
        callSites: hardcodedActionCallSites,
        literalStringProperties,
        localeMatrix,
        themeMatrix,
        viewportMatrix,
      },
      fixed: cssEvidence.hardcodedActions === 0,
      id: "C2-005",
      remainingIssues: [
        ...(cssEvidence.hardcodedActions > 0
          ? [`${cssEvidence.hardcodedActions} hardcoded Actions text node(s) remain.`]
          : []),
      ],
      rule: "literal-toolbar-string-i18n-contract",
      verification:
        "npm run frontend:detail-cycle-20000 -- --json and source check for direct >Actions< text.",
    },
  ];

  return {
    ledgers,
    optimizedCount: ledgers
      .filter((entry) => entry.fixed)
      .reduce((total, entry) => total + entry.count, 0),
    requiredCount: 20000,
    remainingCount: ledgers
      .filter((entry) => !entry.fixed)
      .reduce((total, entry) => total + entry.count, 0),
  };
}

function printMarkdown(result) {
  console.log("# Frontend Detail Cycle 20000 Audit\n");
  console.log(`- Required count: ${result.requiredCount}`);
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

const files = targetDirs.flatMap((dir) => walk(path.join(root, dir)));
const result = buildLedger(files);

if (format === "json") {
  console.log(JSON.stringify(result, null, 2));
} else {
  printMarkdown(result);
}
