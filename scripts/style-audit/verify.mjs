#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const json = args.has("--json");
const writeReport = args.has("--write-report");

const files = {
  consoleCss: path.join(root, "app/console.css"),
  designTokensCss: path.join(root, "design-system/tokens.css"),
  globalsCss: path.join(root, "app/globals.css"),
  runtimeCss: path.join(root, "app/cloudflare-runtime.css"),
  routes: path.join(root, "test/style-audit/routes.json"),
  states: path.join(root, "test/style-audit/states.json"),
  contracts: path.join(root, "test/style-audit/contracts/fugue-console.json"),
};

function read(file) {
  return readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function collectCssRules(source, file) {
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const match of source.matchAll(pattern)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim();
    rules.push({
      body,
      file,
      index: match.index,
      line: lineOf(source, match.index),
      selector,
    });
  }

  return rules;
}

function hasAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

function addIssue(issues, issue) {
  issues.push({
    category: "style-contract",
    severity: "blocker",
    ...issue,
  });
}

function ruleContains(rules, selectorFragment, bodyPattern) {
  return rules.some(
    (rule) =>
      rule.selector.includes(selectorFragment) &&
      (typeof bodyPattern === "string"
        ? rule.body.includes(bodyPattern)
        : bodyPattern.test(rule.body)),
  );
}

function rulesFor(rules, selectorFragment, options = {}) {
  const excludes = options.excludeSelectorFragments ?? [];
  return rules.filter(
    (rule) =>
      rule.selector.includes(selectorFragment) &&
      !excludes.some((fragment) => rule.selector.includes(fragment)),
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declarationValues(body, property) {
  const pattern = new RegExp(`${escapeRegExp(property)}\\s*:\\s*([^;]+)`, "gi");
  return Array.from(body.matchAll(pattern), (match) =>
    match[1].trim().replace(/\s+/g, " "),
  );
}

function hasDeclarationValue(body, property, predicate) {
  return declarationValues(body, property).some((value) => predicate(value));
}

function isNotNone(value) {
  return !/^none(?:\s*!important)?$/i.test(value);
}

function isNotTransparent(value) {
  return !/^transparent(?:\s*!important)?$/i.test(value);
}

function isNotZero(value) {
  return !/^0(?:\s*!important)?$/i.test(value);
}

function sourceLine(source, index) {
  return source.split("\n")[lineOf(source, index) - 1] ?? "";
}

function parseHexColor(value) {
  let hex = value.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .slice(0, 3)
      .split("")
      .map((part) => part + part)
      .join("");
  }
  if (hex.length < 6) return null;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function parseRgbColor(value) {
  const channels =
    value
      .match(/-?\d+(?:\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number) ?? [];
  return channels.length === 3 ? channels : null;
}

function isGreenishLiteral(value) {
  const rgb = value.startsWith("#")
    ? parseHexColor(value)
    : value.startsWith("rgb")
      ? parseRgbColor(value)
      : null;
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return g > r + 18 && g > b + 5 && g > 70;
}

function isAllowedGreenLiteralContext(line) {
  return /--fg-log-|--fugue-code-textarea-token-/i.test(line);
}

function flagUnclassifiedGreenLiterals({ issues, sources }) {
  const colorPattern = /#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g;

  for (const { file, source } of sources) {
    for (const match of source.matchAll(colorPattern)) {
      const value = match[0];
      if (!isGreenishLiteral(value)) continue;

      const line = sourceLine(source, match.index);
      if (isAllowedGreenLiteralContext(line)) continue;

      addIssue(issues, {
        contract: "color.status-positive.cf-token",
        file,
        line: lineOf(source, match.index),
        message:
          "Green-like product UI literals must be tokenized through --cf-status-positive-* or classified as syntax/log color.",
        rule: "unclassified-green-literal",
        selector: null,
      });
    }
  }
}

function flagForbiddenInRules({
  excludeSelectorFragments,
  issues,
  rules,
  selector,
  contract,
  forbidden,
  message,
}) {
  for (const rule of rulesFor(rules, selector, { excludeSelectorFragments })) {
    for (const item of forbidden) {
      const matched =
        typeof item.matches === "function"
          ? item.matches(rule.body)
          : typeof item.pattern === "string"
          ? rule.body.includes(item.pattern)
          : item.pattern.test(rule.body);
      if (!matched) continue;
      addIssue(issues, {
        contract,
        file: rule.file,
        line: rule.line,
        message: `${message} Found ${item.label}.`,
        rule: item.rule,
        selector: rule.selector,
      });
    }
  }
}

function verifyInventory({ contracts, issues, routes, states }) {
  const requiredRoutes = [
    "console.home",
    "console.project.detail",
    "console.billing",
    "console.cluster-nodes",
  ];
  const requiredStates = [
    "default",
    "hover",
    "focus-visible",
    "loading",
    "empty",
    "error",
    "project-settings",
    "danger-preview",
  ];
  const requiredContracts = [
    "control.select.single-surface",
    "control.tooltip.inline-help",
    "surface.project-membership.row-like",
    "surface.project-service.selection-gutter",
    "color.status-positive.cf-token",
    "danger.project-preview.neutral-token",
    "feedback.console-skeleton.cf-bars",
    "control.segmented.single-track",
  ];

  for (const id of requiredRoutes) {
    if (!routes.routes.some((route) => route.id === id)) {
      addIssue(issues, {
        contract: "inventory.route-coverage",
        file: "test/style-audit/routes.json",
        line: 1,
        message: `Missing route inventory entry ${id}.`,
        rule: "missing-route-inventory",
        selector: null,
      });
    }
  }

  for (const id of requiredStates) {
    if (!states.states.some((state) => state.id === id)) {
      addIssue(issues, {
        contract: "inventory.state-coverage",
        file: "test/style-audit/states.json",
        line: 1,
        message: `Missing state inventory entry ${id}.`,
        rule: "missing-state-inventory",
        selector: null,
      });
    }
  }

  for (const id of requiredContracts) {
    if (!contracts.contracts.some((contract) => contract.id === id)) {
      addIssue(issues, {
        contract: "inventory.contract-coverage",
        file: "test/style-audit/contracts/fugue-console.json",
        line: 1,
        message: `Missing style contract ${id}.`,
        rule: "missing-style-contract",
        selector: null,
      });
    }
  }
}

function verifyRuntimeContracts({
  consoleCss,
  designTokensCss,
  globalsCss,
  issues,
  runtimeCss,
  runtimeRules,
}) {
  if (
    !hasAll(runtimeCss, [
      ".fp-design-system :where(.fg-select)",
      "padding: 0 !important",
      "background: transparent !important",
      "box-shadow: none !important",
      ".fp-design-system :where(.fg-settings-form .fg-select__control)",
      "min-height: 36px !important",
    ])
  ) {
    addIssue(issues, {
      contract: "control.select.single-surface",
      file: "app/cloudflare-runtime.css",
      line: 1,
      message:
        "Select wrapper/control contract is missing its rendered cascade reset.",
      rule: "select-rendered-reset-required",
      selector: ".fg-select",
    });
  }

  if (
    !hasAll(runtimeCss, [
      ".fp-design-system :where(.fg-hint-tooltip__trigger)",
      "width: 20px !important",
      "background: transparent !important",
      "border-radius: 0 !important",
      "box-shadow: none !important",
      "@media (max-width: 640px)",
      "width: 44px !important",
    ])
  ) {
    addIssue(issues, {
      contract: "control.tooltip.inline-help",
      file: "app/cloudflare-runtime.css",
      line: 1,
      message:
        "Tooltip trigger contract is missing transparent desktop/mobile rendered reset.",
      rule: "tooltip-rendered-reset-required",
      selector: ".fg-hint-tooltip__trigger",
    });
  }

  for (const rule of runtimeRules) {
    const hasProvider = rule.selector.includes(".fg-provider-button__mark");
    const hasTooltip = rule.selector.includes(".fg-hint-tooltip__trigger");
    if (hasProvider && hasTooltip) {
      addIssue(issues, {
        contract: "control.tooltip.inline-help",
        file: rule.file,
        line: rule.line,
        message:
          "Tooltip trigger is grouped with framed provider/auth icon mark styling.",
        rule: "tooltip-provider-mark-isolation",
        selector: rule.selector,
      });
    }
  }

  if (
    !ruleContains(
      runtimeRules,
      ".fg-control-strip-shell > .fg-control-strip__viewport",
      /background:\s*transparent\s*!important[\s\S]*box-shadow:\s*none\s*!important/,
    )
  ) {
    addIssue(issues, {
      contract: "control.segmented.single-track",
      file: "app/cloudflare-runtime.css",
      line: 1,
      message:
        "Control-strip viewport must be transparent so only the shell owns the track surface.",
      rule: "control-strip-viewport-transparent",
      selector: ".fg-control-strip__viewport",
    });
  }

  if (
    !hasAll(runtimeCss, [
      "--cf-service-row-selection-gutter: 20px",
      "--cf-service-row-inline-end: 16px",
    ]) ||
    !ruleContains(
      runtimeRules,
      ".fg-project-service-card",
      /padding:\s*12px\s+var\(--cf-service-row-inline-end\)\s+12px\s+var\(--cf-service-row-selection-gutter\)\s*!important/,
    ) ||
    !ruleContains(
      runtimeRules,
      ".fg-project-service-card.is-active",
      /box-shadow:\s*inset\s+3px\s+0\s+0\s+var\(--cf-blue\)\s*!important/,
    )
  ) {
    addIssue(issues, {
      contract: "surface.project-service.selection-gutter",
      file: "app/cloudflare-runtime.css",
      line: 1,
      message:
        "Project service row selection must reserve a left gutter and right padding so the active bar is not hidden by the logo and status text is not edge-tight.",
      rule: "service-row-gutter-runtime-required",
      selector: ".fg-project-service-card",
    });
  }

  const legacyPositiveGreenTokens = [
    "#e4f4e9",
    "#9be0b9",
    "#284f39",
    "#508765",
    "rgba(36, 68, 56",
    "rgba(38, 55, 45",
    "rgba(91, 138, 108",
    "rgba(92, 184, 122",
    "rgba(95, 154, 116",
    "rgba(129, 188, 158",
    "rgba(137, 205, 168",
    "rgba(111, 160, 128",
    "rgba(86, 132, 103",
    "rgba(80, 135, 101",
    "rgba(155, 224, 185",
  ];
  const hasLegacyPositiveGreen = legacyPositiveGreenTokens.some((token) =>
    [consoleCss, designTokensCss, globalsCss, runtimeCss].some((source) =>
      source.includes(token),
    ),
  );

  flagUnclassifiedGreenLiterals({
    issues,
    sources: [
      { file: "app/console.css", source: consoleCss },
      { file: "design-system/tokens.css", source: designTokensCss },
      { file: "app/globals.css", source: globalsCss },
      { file: "app/cloudflare-runtime.css", source: runtimeCss },
    ],
  });

  if (
    !hasAll(runtimeCss, [
      "--cf-green: oklch(0.696 0.17 162.48)",
      "--cf-status-positive-rgb: 0 188 125",
      "--cf-status-positive-text: var(--cf-green)",
      "--fugue-status-badge-text-positive: var(--cf-status-positive-text)",
      ".fg-status-badge--positive",
      ".fg-status-badge--success",
      ".fg-route-field__status.is-success",
      ".fp-design-system .fg-route-field__status::before",
      "color: var(--cf-status-positive-text) !important",
    ]) ||
    !hasAll(designTokensCss, [
      "--fugue-status-badge-bg-positive: var(--cf-status-positive-bg, transparent)",
      "--fugue-status-badge-border-positive: var(--cf-status-positive-border, transparent)",
      "--fugue-status-badge-text-positive: var(",
      "--cf-status-positive-text,",
      "oklch(0.696 0.17 162.48)",
    ]) ||
    !hasAll(globalsCss, [
      ".fg-toast--success",
      "--fg-toast-accent: var(--cf-status-positive-rgb, 0 188 125)",
    ]) ||
    hasLegacyPositiveGreen
  ) {
    addIssue(issues, {
      contract: "color.status-positive.cf-token",
      file: "app/cloudflare-runtime.css",
      line: 1,
      message:
        "Positive/success green must use the shared Cloudflare status token across badges, route/domain field states, alerts, cards, resource fills, and toasts.",
      rule: "positive-green-token-required",
      selector: ".fg-status-badge--positive, .fg-route-field__status.is-success",
    });
  }
}

function verifyProjectSourceContracts({ consoleRules, issues }) {
  flagForbiddenInRules({
    contract: "surface.project-membership.row-like",
    forbidden: [
      { label: "full border", pattern: /border:\s*1px/, rule: "membership-no-card-border" },
      { label: "rounded card radius", pattern: /border-radius:\s*(1\.18rem|var\(--fugue-radius)/, rule: "membership-no-card-radius" },
      { label: "gradient background", pattern: /linear-gradient\(/, rule: "membership-no-gradient-surface" },
      { label: "hidden shell overflow", pattern: /overflow:\s*hidden/, rule: "membership-no-shell-clip" },
      {
        label: "legacy shadow",
        matches: (body) => hasDeclarationValue(body, "box-shadow", isNotNone),
        rule: "membership-no-shadow",
      },
    ],
    issues,
    message: "Project membership group must be a row/divider surface, not a rounded card shell.",
    rules: consoleRules,
    selector: ".fg-project-membership-group",
  });

  flagForbiddenInRules({
    contract: "surface.project-membership.row-like",
    forbidden: [
      { label: "gradient header background", pattern: /linear-gradient\(/, rule: "membership-head-no-gradient" },
      {
        label: "filled header surface",
        matches: (body) =>
          hasDeclarationValue(body, "background", isNotTransparent),
        rule: "membership-head-no-fill",
      },
    ],
    issues,
    message: "Project membership group header must not own a separate card-like surface.",
    rules: consoleRules,
    selector: ".fg-project-membership-group__head",
  });

  flagForbiddenInRules({
    contract: "surface.project-membership.row-like",
    forbidden: [
      { label: "gradient hover fill", pattern: /linear-gradient\(/, rule: "membership-row-hover-no-gradient" },
      { label: "layout transform", pattern: /transform:/, rule: "membership-row-no-transform" },
    ],
    issues,
    message: "Project membership rows must behave like table rows, not elevated cards.",
    rules: consoleRules,
    selector: ".fg-project-membership-row",
    excludeSelectorFragments: ["__"],
  });

  flagForbiddenInRules({
    contract: "danger.project-preview.neutral-token",
    forbidden: [
      {
        label: "pill padding",
        matches: (body) => hasDeclarationValue(body, "padding", isNotZero),
        rule: "danger-token-no-pill-padding",
      },
      { label: "visible border", pattern: /border:\s*1px/, rule: "danger-token-no-border" },
      {
        label: "rounded pill radius",
        matches: (body) =>
          hasDeclarationValue(body, "border-radius", isNotZero),
        rule: "danger-token-no-radius",
      },
      {
        label: "filled background",
        matches: (body) =>
          hasDeclarationValue(body, "background", isNotTransparent),
        rule: "danger-token-no-fill",
      },
      { label: "danger text color", pattern: /color:\s*var\(--fugue-danger|color:\s*var\(--cf-red/, rule: "danger-token-neutral-color" },
    ],
    issues,
    message: "Danger preview token must be neutral inline object text, not a red warning pill.",
    rules: consoleRules,
    selector: ".fg-project-danger-preview__token",
  });

  flagForbiddenInRules({
    contract: "danger.project-preview.neutral-token",
    forbidden: [
      { label: "rounded card radius", pattern: /border-radius:\s*(1\.18rem|var\(--fugue-radius)/, rule: "danger-card-no-rounded-shell" },
      { label: "gradient danger surface", pattern: /linear-gradient\(/, rule: "danger-card-no-gradient" },
      {
        label: "legacy inset shadow",
        matches: (body) => hasDeclarationValue(body, "box-shadow", isNotNone),
        rule: "danger-card-no-shadow",
      },
    ],
    issues,
    message: "Project danger region should be a section divider, not a tinted card shell.",
    rules: consoleRules,
    selector: ".fg-project-danger-card",
  });

  flagForbiddenInRules({
    contract: "surface.project-service.selection-gutter",
    forbidden: [
      { label: "full border", pattern: /border:\s*1px/, rule: "service-row-no-card-border" },
      { label: "rounded card radius", pattern: /border-radius:\s*(1\.12rem|var\(--f[pu]-radius)/, rule: "service-row-no-card-radius" },
      { label: "gradient background", pattern: /linear-gradient\(/, rule: "service-row-no-gradient-surface" },
      {
        label: "outer shadow",
        matches: (body) =>
          hasDeclarationValue(
            body,
            "box-shadow",
            (value) => isNotNone(value) && !/^inset\s+3px\s+0\s+0\s+var\(--(?:fugue-focus-ring|fp-focus-ring|cf-blue)\)/i.test(value),
          ),
        rule: "service-row-no-outer-shadow",
      },
      { label: "layout transform", pattern: /transform:/, rule: "service-row-no-transform" },
    ],
    issues,
    message:
      "Project service rows must be single-surface rows with an unobstructed left selection gutter, not rounded cards.",
    rules: consoleRules,
    selector: ".fg-project-service-card",
    excludeSelectorFragments: ["__"],
  });
}

function verifySkeletonContracts({ consoleRules, issues }) {
  flagForbiddenInRules({
    contract: "feedback.console-skeleton.cf-bars",
    forbidden: [
      { label: "999px skeleton capsule", pattern: /border-radius:\s*999px/, rule: "skeleton-no-legacy-pill-radius" },
      { label: "gradient block fill", pattern: /background:\s*linear-gradient|background:[\s\S]*linear-gradient\(/, rule: "skeleton-no-gradient-block" },
      {
        label: "legacy inset highlight",
        matches: (body) => hasDeclarationValue(body, "box-shadow", isNotNone),
        rule: "skeleton-no-inset-highlight",
      },
    ],
    issues,
    message: "Console skeleton blocks must use the Cloudflare bar surface instead of legacy glossy pills.",
    rules: consoleRules,
    selector: ".fg-console-skeleton__block",
    excludeSelectorFragments: ["::after"],
  });

  flagForbiddenInRules({
    contract: "feedback.console-skeleton.cf-bars",
    forbidden: [
      { label: "card border", pattern: /border:\s*1px/, rule: "skeleton-container-no-card-border" },
      { label: "card radius", pattern: /border-radius:\s*1rem/, rule: "skeleton-container-no-card-radius" },
      { label: "card background", pattern: /background:\s*var\(--fugue-console-skeleton-surface-bg\)/, rule: "skeleton-container-no-card-bg" },
    ],
    issues,
    message: "Skeleton list/workbench containers must not preserve old card shells.",
    rules: consoleRules,
    selector: ".fg-console-skeleton__list-item",
  });

  flagForbiddenInRules({
    contract: "feedback.console-skeleton.cf-bars",
    forbidden: [
      { label: "card border", pattern: /border:\s*1px/, rule: "skeleton-workbench-no-card-border" },
      { label: "card radius", pattern: /border-radius:\s*1rem/, rule: "skeleton-workbench-no-card-radius" },
      { label: "card background", pattern: /background:\s*var\(--fugue-console-skeleton-surface-bg\)/, rule: "skeleton-workbench-no-card-bg" },
    ],
    issues,
    message: "Skeleton workbench main must not preserve old card shell.",
    rules: consoleRules,
    selector: ".fg-console-skeleton__workbench-main",
  });
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

  if (result.issues.length === 0) {
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

const consoleCss = read(files.consoleCss);
const designTokensCss = read(files.designTokensCss);
const globalsCss = read(files.globalsCss);
const runtimeCss = read(files.runtimeCss);
const routes = readJson(files.routes);
const states = readJson(files.states);
const contracts = readJson(files.contracts);
const consoleRules = collectCssRules(consoleCss, "app/console.css");
const runtimeRules = collectCssRules(runtimeCss, "app/cloudflare-runtime.css");

const issues = [];

verifyInventory({ contracts, issues, routes, states });
verifyRuntimeContracts({
  consoleCss,
  designTokensCss,
  globalsCss,
  issues,
  runtimeCss,
  runtimeRules,
});
verifyProjectSourceContracts({ consoleRules, issues });
verifySkeletonContracts({ consoleRules, issues });

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
