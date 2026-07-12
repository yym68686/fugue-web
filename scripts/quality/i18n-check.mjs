import { readFileSync } from "node:fs";
import { extname, relative } from "node:path";

import ts from "typescript";

import { hasMessage, SUPPORTED_LOCALES } from "../../apps/web/lib/i18n/core.ts";
import { finishGate, listFiles, parseArgs, ROOT } from "./lib.mjs";

const args = parseArgs();
const roots = [
  `${ROOT}/apps/web/app`,
  `${ROOT}/apps/web/components`,
  `${ROOT}/apps/web/lib`,
];
const extensions = new Set([".ts", ".tsx"]);
const translatedLocales = SUPPORTED_LOCALES.filter((locale) => locale !== "en");
const keys = new Map();
const errors = [];

function recordKey(key, path, line) {
  const locations = keys.get(key) ?? [];
  locations.push(`${relative(ROOT, path)}:${line}`);
  keys.set(key, locations);
}

for (const path of roots.flatMap((root) =>
  listFiles(root, (file) => extensions.has(extname(file))),
)) {
  if (path.endsWith("openapi.generated.ts") || path.endsWith("i18n/core.ts")) {
    continue;
  }
  const sourceText = readFileSync(path, "utf8");
  const source = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "t" || node.expression.text === "translate")
    ) {
      const keyArgument =
        node.expression.text === "translate" ? node.arguments[1] : node.arguments[0];
      if (
        keyArgument &&
        (ts.isStringLiteral(keyArgument) ||
          ts.isNoSubstitutionTemplateLiteral(keyArgument))
      ) {
        const line =
          source.getLineAndCharacterOfPosition(keyArgument.getStart()).line + 1;
        recordKey(keyArgument.text, path, line);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

for (const [key, locations] of keys) {
  if (key.trim().length === 0) {
    errors.push(`An empty default-locale key is used at ${locations.join(", ")}`);
  }
  for (const locale of translatedLocales) {
    if (!hasMessage(locale, key)) {
      errors.push(
        `${locale} is missing ${JSON.stringify(key)} (used at ${locations.join(", ")})`,
      );
    }
  }
}

const report = {
  schemaVersion: 1,
  gate: "i18n-literal-catalog",
  passed: errors.length === 0,
  locales: SUPPORTED_LOCALES,
  defaultLocaleUsesSourceMessages: "en",
  literalKeys: keys.size,
  violations: errors,
};

console.log(
  `i18n catalog: ${keys.size} literal keys across ${SUPPORTED_LOCALES.length} locales`,
);
finishGate("i18n catalog gate", errors, report, args.value("report"));
