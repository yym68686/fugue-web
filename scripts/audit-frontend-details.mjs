#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const format = args.has("--json") ? "json" : "md";

const targetDirs = ["app", "components", "design-system"];
const ignoredDirs = new Set([".git", ".next", "node_modules"]);
const textExtensions = new Set([".css", ".html", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (ignoredDirs.has(name)) continue;
    const absolute = path.join(dir, name);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      entries.push(...walk(absolute));
    } else if (textExtensions.has(path.extname(name))) {
      entries.push(absolute);
    }
  }
  return entries;
}

function relative(file) {
  return path.relative(root, file);
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function selectorBefore(source, index) {
  const start = source.lastIndexOf("}", index) + 1;
  const brace = source.lastIndexOf("{", index);
  if (brace < start) return "";
  return source.slice(start, brace).trim().replace(/\s+/g, " ");
}

function ruleBodyAt(source, index) {
  const start = source.lastIndexOf("{", index);
  const end = source.indexOf("}", index);
  if (start === -1 || end === -1) return "";
  return source.slice(start + 1, end);
}

function findOpeningTagEnd(source, start) {
  let quote = "";
  let braceDepth = 0;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{") {
      braceDepth += 1;
      continue;
    }

    if (char === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === ">" && braceDepth === 0) {
      return index;
    }
  }

  return -1;
}

function add(issues, file, source, index, severity, category, rule, message) {
  issues.push({
    category,
    file: relative(file),
    line: lineNumber(source, index),
    message,
    rule,
    severity,
  });
}

function scanCss(file, source, issues) {
  for (const match of source.matchAll(/transition\s*:\s*all\b/gi)) {
    add(
      issues,
      file,
      source,
      match.index,
      "high",
      "motion",
      "no-transition-all",
      "Use explicit transition properties instead of transition: all.",
    );
  }

  for (const match of source.matchAll(/outline\s*:\s*(none|0)\b/gi)) {
    const selector = selectorBefore(source, match.index);
    const body = ruleBodyAt(source, match.index);
    const selectorHasCompanionFocus =
      selector.includes(".fp-search-input") && /\.fp-toolbar__search:focus-within/.test(source);
    const hasReplacement =
      /focus-visible|focus-within/.test(selector) ||
      selectorHasCompanionFocus ||
      /box-shadow\s*:|outline\s*:\s*(?!none|0)/i.test(body.replace(match[0], ""));
    if (!hasReplacement) {
      add(
        issues,
        file,
        source,
        match.index,
        "high",
        "accessibility",
        "focus-visible-required",
        "outline is removed without an obvious focus-visible replacement in the same rule.",
      );
    }
  }

  const productCss = /(^|\/)(cloudflare-runtime|platform)\.css$/.test(relative(file));
  if (productCss) {
    for (const match of source.matchAll(/background(?:-image)?\s*:[^;\n]*(linear-gradient|radial-gradient)/gi)) {
      const selector = selectorBefore(source, match.index);
      const allowed =
        /skeleton|shimmer|glare|noise|scan|hero|landing|docs|meter|progress/i.test(selector) ||
        /--/.test(match[0]);
      if (!allowed) {
        add(
          issues,
          file,
          source,
          match.index,
          "medium",
          "visual-system",
          "product-gradient-candidate",
          "Product UI gradient candidate; confirm this is not an old decorative surface.",
        );
      }
    }
  }
}

function scanMarkup(file, source, issues) {
  for (const match of source.matchAll(/<(div|span)\b/gi)) {
    const tagEnd = findOpeningTagEnd(source, match.index);
    if (tagEnd === -1) continue;
    const tag = source.slice(match.index, tagEnd + 1);
    if (!/\bonClick\s*=/.test(tag)) {
      continue;
    }
    if (/\bbackdrop\b/.test(tag)) {
      continue;
    }
    if (/onClick\s*=\s*{\s*\(?\s*\w+\s*\)?\s*=>[\s\S]*?\.stopPropagation\(\)/.test(tag)) {
      continue;
    }
    add(
      issues,
      file,
      source,
      match.index,
      "critical",
      "accessibility",
      "semantic-interaction",
      "Clickable div/span should be a button or link with keyboard semantics.",
    );
  }

  for (const match of source.matchAll(/onPaste\s*=\s*{[^}]*preventDefault|preventDefault\(\)[^<\n]*onPaste/gi)) {
    add(
      issues,
      file,
      source,
      match.index,
      "high",
      "forms",
      "paste-not-blocked",
      "Do not block paste in form fields.",
    );
  }

  for (const match of source.matchAll(/<[^>]*\bautoFocus(?:\s*=\s*{?true}?|\b)[^>]*>/g)) {
    add(
      issues,
      file,
      source,
      match.index,
      "medium",
      "interaction",
      "autofocus-guard",
      "Auto-focus needs a desktop-only or single-primary-input justification.",
    );
  }

  for (const match of source.matchAll(/<summary\b[\s\S]*?<\/summary>/g)) {
    if (/<(button|a|input|select|textarea)\b/.test(match[0])) {
      add(
        issues,
        file,
        source,
        match.index,
        "high",
        "accessibility",
        "summary-no-nested-interactive",
        "summary contains a nested interactive element.",
      );
    }
  }

  for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\balt\s*=/.test(tag)) {
      add(issues, file, source, match.index, "high", "accessibility", "img-alt", "img is missing alt text.");
    }
    if (!/\bwidth\s*=/.test(tag) || !/\bheight\s*=/.test(tag)) {
      add(
        issues,
        file,
        source,
        match.index,
        "medium",
        "layout-stability",
        "img-dimensions",
        "img is missing explicit width and height.",
      );
    }
    if (!/\bloading\s*=/.test(tag) && !/\bfetchpriority\s*=|\bfetchPriority\s*=/.test(tag)) {
      add(
        issues,
        file,
        source,
        match.index,
        "low",
        "performance",
        "img-loading-policy",
        "img should declare lazy/eager loading policy.",
      );
    }
  }
}

function scanSource(file, issues) {
  const source = readFileSync(file, "utf8");
  if (file.endsWith(".css")) {
    scanCss(file, source, issues);
  }
  if (/\.(tsx|jsx|html)$/.test(file)) {
    scanMarkup(file, source, issues);
  }
}

const issues = [];
for (const dir of targetDirs) {
  const absolute = path.join(root, dir);
  for (const file of walk(absolute)) {
    scanSource(file, issues);
  }
}

issues.sort((a, b) => {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return (
    severityOrder[a.severity] - severityOrder[b.severity] ||
    a.file.localeCompare(b.file) ||
    a.line - b.line ||
    a.rule.localeCompare(b.rule)
  );
});

const counts = issues.reduce((next, issue) => {
  next[issue.severity] = (next[issue.severity] ?? 0) + 1;
  return next;
}, {});

if (format === "json") {
  console.log(JSON.stringify({ counts, issues }, null, 2));
} else {
  console.log("# Frontend Detail Audit\n");
  console.log(
    `Issues: ${issues.length} (critical ${counts.critical ?? 0}, high ${counts.high ?? 0}, medium ${counts.medium ?? 0}, low ${counts.low ?? 0})\n`,
  );
  if (issues.length === 0) {
    console.log("No static detail issues detected by the current rules.");
  } else {
    let currentFile = "";
    for (const issue of issues) {
      if (issue.file !== currentFile) {
        currentFile = issue.file;
        console.log(`\n## ${currentFile}\n`);
      }
      console.log(
        `- [${issue.severity}] ${issue.file}:${issue.line} ${issue.rule}: ${issue.message}`,
      );
    }
  }
}
