#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const json = args.has("--json");
const writeReport = args.has("--write-report");

const files = {
  appLayout: "app/app/layout.tsx",
  consoleComponents: "app/console-components.css",
  docsCss: "app/docs/docs.css",
  morlaneCss: "design-system/morlane.css",
  newLayout: "app/new/layout.tsx",
  routes: "test/style-audit/routes.json",
  states: "test/style-audit/states.json",
  contracts: "test/style-audit/contracts/fugue-console.json",
};

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function lineOf(source, token) {
  const index = source.indexOf(token);
  return index < 0 ? 1 : source.slice(0, index).split("\n").length;
}

function addIssue(issues, {
  contract,
  file,
  message,
  rule,
  selector = null,
  token = "",
}) {
  const source = read(file);
  issues.push({
    category: "style-contract",
    severity: "blocker",
    contract,
    file,
    line: lineOf(source, token),
    message,
    rule,
    selector,
  });
}

function requireTokens(issues, {
  contract,
  file,
  message,
  rule,
  selector = null,
  tokens,
}) {
  const source = read(file);
  const missing = tokens.filter((token) => !source.includes(token));
  if (!missing.length) return;

  addIssue(issues, {
    contract,
    file,
    message: `${message} Missing: ${missing.join(", ")}`,
    rule,
    selector,
    token: missing[0],
  });
}

function forbidTokens(issues, {
  contract,
  file,
  message,
  rule,
  tokens,
}) {
  const source = read(file);
  for (const token of tokens) {
    if (!source.includes(token)) continue;
    addIssue(issues, {
      contract,
      file,
      message: `${message} Found: ${token}`,
      rule,
      token,
    });
  }
}

function verifyInventory({ contracts, issues, routes, states }) {
  const requiredRoutes = [
    "marketing.home",
    "docs.home",
    "auth.sign-in",
    "auth.sign-up",
    "auth.finalize",
    "console.home",
    "console.project.detail",
    "console.cluster-nodes",
    "console.api-keys",
    "console.billing",
    "console.profile",
    "console.cluster",
    "console.apps",
    "console.users",
    "deploy.repository",
    "deploy.template",
  ];
  const requiredStates = [
    "default",
    "hover",
    "focus-visible",
    "disabled",
    "loading",
    "empty",
    "error",
    "long-text",
    "project-settings",
    "danger-preview",
  ];
  const requiredContracts = [
    "design.morlane-token-bridge",
    "layout.console-shell",
    "layout.project-workbench",
    "layout.resource-density",
    "control.input-single-surface",
    "control.locale-theme-morlane",
    "surface.profile-auth",
    "surface.docs-density",
    "state.complete-coverage",
    "legacy.visual-runtime-detached",
  ];

  for (const id of requiredRoutes) {
    if (routes.routes.some((route) => route.id === id)) continue;
    addIssue(issues, {
      contract: "inventory.route-coverage",
      file: files.routes,
      message: `Missing route inventory entry ${id}.`,
      rule: "missing-route-inventory",
    });
  }

  for (const id of requiredStates) {
    if (states.states.some((state) => state.id === id)) continue;
    addIssue(issues, {
      contract: "state.complete-coverage",
      file: files.states,
      message: `Missing state inventory entry ${id}.`,
      rule: "missing-state-inventory",
    });
  }

  for (const id of requiredContracts) {
    if (contracts.contracts.some((contract) => contract.id === id)) continue;
    addIssue(issues, {
      contract: "inventory.contract-coverage",
      file: files.contracts,
      message: `Missing Morlane style contract ${id}.`,
      rule: "missing-style-contract",
    });
  }
}

function verifyMorlaneContracts(issues) {
  requireTokens(issues, {
    contract: "design.morlane-token-bridge",
    file: files.morlaneCss,
    message: "The canonical Morlane primitives and compatibility bridge must remain defined.",
    rule: "morlane-token-bridge-required",
    selector: ":root",
    tokens: [
      "--bg: #f6f7f8",
      "--surface: #ffffff",
      "--text: #17191c",
      "--border: #d8dde3",
      "--info: #1769aa",
      "--ml-bg: var(--bg)",
      "--ml-surface: var(--surface)",
      "--ml-text: var(--text)",
      "--ml-border: var(--border)",
      "--ml-accent: var(--accent)",
    ],
  });

  for (const file of [files.appLayout, files.newLayout]) {
    requireTokens(issues, {
      contract: "layout.console-shell",
      file,
      message: "Product routes must load the Morlane component contract layer.",
      rule: "console-component-layer-import-required",
      tokens: ['import "../console-components.css";'],
    });
  }

  requireTokens(issues, {
    contract: "layout.project-workbench",
    file: files.consoleComponents,
    message: "Project detail must retain the compact Morlane rail and inspector layout.",
    rule: "project-workbench-grid-required",
    selector: ".fg-project-workbench__inner",
    tokens: [
      ".fg-project-workbench__inner",
      "grid-template-columns: minmax(220px, 260px) minmax(0, 1fr)",
      ".fg-project-workbench__rail",
      ".fg-project-workbench__main",
      ".fg-project-service-card.is-active",
    ],
  });

  requireTokens(issues, {
    contract: "layout.resource-density",
    file: files.consoleComponents,
    message: "Console resource pages must retain compact Morlane rows and grids.",
    rule: "resource-density-contract-required",
    tokens: [
      ".fp-project-resource-list .fp-row",
      "min-height: 76px",
      ".fg-cluster-node-card",
      ".fg-api-key-item",
      ".fg-billing-workbench",
      ".fg-console-table-wrap",
    ],
  });

  requireTokens(issues, {
    contract: "control.input-single-surface",
    file: files.consoleComponents,
    message: "Project search and select controls must have one Morlane surface owner.",
    rule: "project-filter-single-surface-required",
    selector: ".fp-project-search input, .fp-project-select select",
    tokens: [
      ".fp-project-search input,",
      ".fp-project-select select",
      "border: 0",
      "background: transparent",
    ],
  });

  requireTokens(issues, {
    contract: "control.input-single-surface",
    file: files.morlaneCss,
    message: "Composite input groups must keep the wrapper as the only framed surface across default, focus, and invalid states.",
    rule: "composite-input-single-surface-design-system-required",
    selector: ".fg-control-group, .fg-billing-top-up-form__entry, .input-with-button",
    tokens: [
      ".fg-control-group",
      ".fg-field-control:has(",
      ".fg-billing-top-up-form__entry .fg-input",
      ":is(:focus, :focus-visible, [aria-invalid=\"true\"])",
      "outline: 0",
      "box-shadow: none",
    ],
  });

  requireTokens(issues, {
    contract: "control.input-single-surface",
    file: files.consoleComponents,
    message: "The final console CSS layer must preserve single-surface composite inputs after page-level overrides.",
    rule: "composite-input-single-surface-console-guard-required",
    selector: ".fg-console-page .fg-control-group",
    tokens: [
      "Final Morlane single-surface guard",
      ".fg-console-page :is(.fp-project-search, .fp-project-select, .fg-control-group",
      ".fg-billing-top-up-form__entry",
      ".fg-field-control:has(",
      ":is(:focus, :focus-visible, [aria-invalid=\"true\"])",
      "border: 0",
      "outline: 0",
      "box-shadow: none",
    ],
  });

  requireTokens(issues, {
    contract: "control.locale-theme-morlane",
    file: files.morlaneCss,
    message: "Locale and theme controls must use the shared Morlane utility controls.",
    rule: "locale-theme-control-contract-required",
    tokens: [
      ".language-select",
      ".language-select select",
      ".icon-button",
      "border-radius: var(--radius)",
    ],
  });

  requireTokens(issues, {
    contract: "surface.profile-auth",
    file: files.consoleComponents,
    message: "Profile auth providers must use a responsive Morlane workbench without compressed details.",
    rule: "profile-auth-workbench-required",
    selector: ".fg-profile-auth-workbench",
    tokens: [
      ".fg-profile-auth-workbench",
      "grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.28fr)",
      ".fg-profile-auth-provider__footer",
      "grid-template-columns: minmax(0, 1fr)",
    ],
  });

  requireTokens(issues, {
    contract: "surface.docs-density",
    file: files.docsCss,
    message: "Documentation must use the dense Morlane docs shell and restrained heading scale.",
    rule: "docs-density-contract-required",
    selector: ".ml-docs-page",
    tokens: [
      "grid-template-columns: 250px minmax(0, 1fr)",
      ".ml-docs-hero h1",
      "font-size: 38px",
      ".ml-docs-section__head h2",
      "font-size: 26px",
    ],
  });

  requireTokens(issues, {
    contract: "state.complete-coverage",
    file: files.consoleComponents,
    message: "The Morlane component layer must preserve focus and responsive states.",
    rule: "interactive-responsive-state-required",
    tokens: [
      ":focus-visible",
      "@media (max-width: 1180px)",
      "@media (max-width: 920px)",
      "@media (max-width: 680px)",
      "@media (prefers-reduced-motion: reduce)",
    ],
  });

  for (const file of [files.appLayout, files.newLayout]) {
    forbidTokens(issues, {
      contract: "legacy.visual-runtime-detached",
      file,
      message: "Legacy visual runtime styles must not be imported by product routes.",
      rule: "legacy-runtime-import-forbidden",
      tokens: ["cloudflare-runtime.css", "cinematic", "legacy-console"],
    });
  }
}

function buildReport(result) {
  const lines = [
    "# Frontend Style Audit Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Coverage",
    "",
    `- Routes inventoried: ${result.coverage.routes}`,
    `- States inventoried: ${result.coverage.states}`,
    `- Contracts inventoried: ${result.coverage.contracts}`,
    `- Issues: ${result.issues.length}`,
    "",
  ];

  if (!result.issues.length) {
    lines.push("## Findings", "", "No blocker findings remain.", "");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Findings", "");
  for (const issue of result.issues) {
    lines.push(
      `- [ ] ${issue.contract} / ${issue.rule}`,
      `  - Severity: ${issue.severity}`,
      `  - Location: ${issue.file}:${issue.line}`,
      `  - Selector: ${issue.selector ?? "n/a"}`,
      `  - Detail: ${issue.message}`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

const routes = readJson(files.routes);
const states = readJson(files.states);
const contracts = readJson(files.contracts);
const issues = [];

verifyInventory({ contracts, issues, routes, states });
verifyMorlaneContracts(issues);

const result = {
  coverage: {
    contracts: contracts.contracts.length,
    routes: routes.routes.length,
    states: states.states.length,
  },
  issues,
  ok: issues.length === 0,
};

if (writeReport) {
  const reportPath = path.join(root, "docs/frontend-style-audit-report.md");
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, buildReport(result));
}

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(buildReport(result));
}

process.exitCode = result.ok ? 0 : 1;
