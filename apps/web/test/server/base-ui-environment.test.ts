import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDocumentLocaleAttributes, getLocaleDirection } from "@/lib/i18n/core";

const webRoot = path.join(import.meta.dir, "../..");

describe("Base UI request environment integration", () => {
  test("document and Base UI direction share the locale-derived value", () => {
    for (const locale of ["en", "zh-CN", "zh-TW"] as const) {
      expect(getDocumentLocaleAttributes(locale, locale).dir).toBe(
        getLocaleDirection(locale),
      );
    }
  });

  test("the console boundary is optional and Auth does not import it", async () => {
    const [boundary, appLayout, authLayout] = await Promise.all([
      readFile(
        path.join(webRoot, "components/console/base-ui-environment.tsx"),
        "utf8",
      ),
      readFile(path.join(webRoot, "app/app/layout.tsx"), "utf8"),
      readFile(path.join(webRoot, "app/auth/layout.tsx"), "utf8"),
    ]);

    expect(boundary).toContain('if (direction === "ltr" && !nonce)');
    expect(boundary).toContain("<DirectionProvider direction={direction}>");
    expect(boundary).toContain("<CSPProvider nonce={nonce}>");
    expect(appLayout).toContain("<ConsoleBaseUIEnvironment direction={dir}>");
    expect(authLayout).not.toContain("CSPProvider");
    expect(authLayout).not.toContain("DirectionProvider");
    expect(authLayout).not.toContain("ConsoleBaseUIEnvironment");
  });

  test("the integration consumes but never manufactures a nonce or CSP header", async () => {
    const sources = await Promise.all([
      readFile(
        path.join(webRoot, "components/console/base-ui-environment.tsx"),
        "utf8",
      ),
      readFile(path.join(webRoot, "app/app/layout.tsx"), "utf8"),
    ]);
    const source = sources.join("\n");

    expect(source).not.toContain("Content-Security-Policy");
    expect(source).not.toContain("crypto.randomUUID");
    expect(source).not.toContain("headers()");
  });
});
