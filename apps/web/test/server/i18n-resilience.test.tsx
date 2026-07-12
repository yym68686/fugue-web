import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@fugue/ui/components/empty";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

import { PublicShell } from "../../components/fugue-coss/shells";
import { PageHeader } from "../../components/shared/page-header";
import { createShellMessages } from "../../lib/i18n/ui-messages";

const WEB_ROOT = join(import.meta.dir, "../..");

function collectSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === ".next" || entry.name === "node_modules") return [];
      return collectSourceFiles(path);
    }

    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function expandByThirtyPercent(value: string) {
  const suffixLength = Math.max(1, Math.ceil(value.length * 0.3));
  return `${value} ${"延".repeat(suffixLength)}`;
}

describe("internationalized layout resilience", () => {
  test("shared chrome preserves expanded CJK, emoji, long names, and long errors", () => {
    const expandedGetStarted = expandByThirtyPercent("Get started");
    const longProjectName = `项目-🚀-${"跨区域运行时".repeat(18)}`;
    const longError = `连接失败：${"请检查网络后重试。".repeat(36)} 🧭`;
    const messages = {
      ...createShellMessages((key) => key),
      console: expandByThirtyPercent("Console"),
      docs: expandByThirtyPercent("Docs"),
      getStarted: expandedGetStarted,
      signIn: expandByThirtyPercent("Sign in"),
    };

    const markup = renderToStaticMarkup(
      <PublicShell messages={messages}>
        <PageHeader
          title={longProjectName}
          description={`${"中日韩文字与 emoji 🎛️ ".repeat(12)}end`}
        />
        <Alert variant="error">
          <AlertTitle>部署失败</AlertTitle>
          <AlertDescription>{longError}</AlertDescription>
        </Alert>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>暂无项目 🛰️</EmptyTitle>
            <EmptyDescription>创建首个项目后即可继续。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PublicShell>,
    );

    expect(expandedGetStarted.length).toBeGreaterThanOrEqual(
      Math.ceil("Get started".length * 1.3),
    );
    expect(markup).toContain(expandedGetStarted);
    expect(markup).toContain(longProjectName);
    expect(markup).toContain(longError);
    expect(markup).toContain("暂无项目 🛰️");
  });

  test("application source rejects physical inline-direction declarations", () => {
    const files = collectSourceFiles(join(WEB_ROOT, "app")).concat(
      collectSourceFiles(join(WEB_ROOT, "components")),
    );
    const physicalCssProperty =
      /(?:^|[;{]\s*|\n\s*)(?:margin-(?:left|right)|padding-(?:left|right)|border-(?:left|right)(?:-[\w-]+)?|left|right)\s*:/gm;
    const physicalUtility =
      /\b(?:ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r|inset-l|inset-r|left|right)-(?:\[|\d)/g;
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const cssMatches = file.endsWith(".css")
        ? [...source.matchAll(physicalCssProperty)]
        : [];
      const utilityMatches = file.endsWith(".tsx")
        ? [...source.matchAll(physicalUtility)]
        : [];

      for (const match of [...cssMatches, ...utilityMatches]) {
        const line = source.slice(0, match.index).split("\n").length;
        violations.push(`${file}:${line}:${match[0].trim()}`);
      }
    }

    expect(violations).toEqual([]);
  });

  test("mobile public header wraps actions instead of hiding the primary CTA", () => {
    const css = readFileSync(join(WEB_ROOT, "app/globals.css"), "utf8");

    expect(css).toMatch(/\.coss-site-header__inner\s*{[^}]*flex-wrap:\s*wrap/s);
    expect(css).toMatch(/\.coss-actions\s*{[^}]*flex-wrap:\s*wrap/s);
    expect(css).toMatch(/\.coss-nav,\s*\.coss-actions\s*{[^}]*overflow-x:\s*visible/s);
    expect(css).toMatch(
      /\.coss-site-header \.coss-actions \[data-slot="button"\]\s*{[^}]*white-space:\s*normal/s,
    );
    expect(css).toMatch(/\.coss-page-title\s*{[^}]*overflow-wrap:\s*anywhere/s);
    expect(css).toMatch(/\.coss-page-description\s*{[^}]*overflow-wrap:\s*anywhere/s);
  });

  test("error, empty, and validation surfaces do not embed English literals", () => {
    const protectedStateElements = new Set([
      "AlertTitle",
      "EmptyDescription",
      "EmptyTitle",
      "FieldError",
    ]);
    const files = collectSourceFiles(join(WEB_ROOT, "app"))
      .concat(collectSourceFiles(join(WEB_ROOT, "components")))
      .filter((file) => file.endsWith(".tsx"));
    const violations: string[] = [];

    for (const file of files) {
      const sourceText = readFileSync(file, "utf8");
      const source = ts.createSourceFile(
        file,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );

      function inspectLiteral(
        node: ts.Node,
        elementName: string,
        boundary: ts.JsxElement,
      ) {
        let renderedStringLiteral = false;

        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          let parent = node.parent;
          renderedStringLiteral = true;

          while (parent !== boundary) {
            if (
              ts.isBinaryExpression(parent) ||
              ts.isCallExpression(parent) ||
              ts.isJsxAttribute(parent)
            ) {
              renderedStringLiteral = false;
              break;
            }
            parent = parent.parent;
          }
        }

        const value = ts.isJsxText(node)
          ? node.text.trim()
          : renderedStringLiteral &&
              (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
            ? node.text.trim()
            : "";

        if (value && /[A-Za-z]/.test(value)) {
          const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          violations.push(`${file}:${line}:${elementName}:${value}`);
        }

        ts.forEachChild(node, (child) => inspectLiteral(child, elementName, boundary));
      }

      function visit(node: ts.Node) {
        if (ts.isJsxElement(node)) {
          const elementName = node.openingElement.tagName.getText(source);
          if (protectedStateElements.has(elementName)) {
            for (const child of node.children) {
              inspectLiteral(child, elementName, node);
            }
            return;
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(source);
    }

    expect(violations).toEqual([]);
  });

  test("server pages serialize locale and typed messages from one request snapshot", () => {
    const contracts = [
      ["app/app/page.tsx", "createProjectGalleryStateMessages(t)"],
      ["app/app/apps/page.tsx", "createAdminAppsStateMessages(t)"],
      ["app/app/users/page.tsx", "createAdminUsersStateMessages(t)"],
      ["app/app/cluster/page.tsx", "createAdminClusterStateMessages(t)"],
      ["app/app/cluster-nodes/page.tsx", "createServersStateMessages(t)"],
      ["app/app/dns/page.tsx", "createDnsStateMessages(t)"],
      ["app/app/api-keys/page.tsx", "createAccessKeysStateMessages(t)"],
      ["app/app/billing/page.tsx", "createBillingStateMessages(t)"],
      [
        "app/app/projects/[projectId]/page.tsx",
        "createProjectWorkbenchStateMessages(t)",
      ],
      ["app/app/settings/profile/page.tsx", "createProfileFormMessages(t)"],
      ["app/new/repository/page.tsx", "createNewProjectFormMessages(t)"],
    ] as const;

    for (const [relativePath, messageFactory] of contracts) {
      const source = readFileSync(join(WEB_ROOT, relativePath), "utf8");
      expect(source).toContain("getRequestI18n()");
      expect(source).toContain(messageFactory);
    }
  });
});
