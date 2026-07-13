import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentsRoot = path.join(packageRoot, "src/components");
const baseUiRoot = path.join(packageRoot, "src/base-ui");

async function component(name: string): Promise<string> {
  return readFile(path.join(componentsRoot, `${name}.tsx`), "utf8");
}

describe("generated registry package contract", () => {
  test("critical primitives are generated with stable data-slot contracts", async () => {
    const expected = [
      "button",
      "dialog",
      "tabs",
      "form",
      "field",
      "input-group",
      "table",
      "sidebar",
      "toast",
    ];

    for (const name of expected) {
      const source = await component(name);
      expect(source).toContain("@generated from apps/ui/registry/default");
      expect(source).toContain("data-slot");
    }
  });

  test("client directives remain first and package aliases never point back to registry", async () => {
    const files = (await readdir(componentsRoot)).filter((file) =>
      file.endsWith(".tsx"),
    );
    for (const file of files) {
      const source = await readFile(path.join(componentsRoot, file), "utf8");
      if (source.includes('"use client"'))
        expect(source.startsWith('"use client";')).toBe(true);
      expect(source).not.toContain("@/registry/default");
      expect(source).not.toContain("@coss/");
    }
  });

  test("button, form and overlay invariants remain explicit", async () => {
    const button = await component("button");
    const card = await component("card");
    const field = await component("field");
    const dialog = await component("dialog");
    const inputGroup = await component("input-group");

    expect(button).toContain("typeValue");
    expect(button).toContain('data-slot": "button"');
    expect(button).toContain("Spinner");
    expect(card).toContain("relative isolate flex");
    expect(card).toContain("before:z-0");
    expect(card).toContain("[&>*]:z-[1]");
    expect(field).toContain('data-slot="field-group"');
    expect(dialog).toContain('data-slot="dialog-title"');
    expect(dialog).toContain("DialogPrimitive.Portal");
    expect(inputGroup).toContain('role="group"');
  });

  test("runtime package is free of Fugue product and server imports", async () => {
    const forbidden = [
      "@/lib/auth",
      "@/lib/billing",
      "@/lib/db",
      "@/lib/fugue",
      "@/lib/workspace",
      "FUGUE_API_KEY",
      "FUGUE_BOOTSTRAP_KEY",
    ];
    const directories = ["base-ui", "components", "hooks", "lib"];

    for (const directory of directories) {
      const root = path.join(packageRoot, "src", directory);
      for (const file of await readdir(root)) {
        const source = await readFile(path.join(root, file), "utf8");
        for (const pattern of forbidden) expect(source).not.toContain(pattern);
      }
    }
  });

  test("clipboard hook exposes a recoverable browser-safe result", async () => {
    const source = await readFile(
      path.join(packageRoot, "src/hooks/use-copy-to-clipboard.ts"),
      "utf8",
    );

    expect(source).toContain("Promise<boolean>");
    expect(source).toContain("navigator.clipboard?.writeText");
    expect(source).toContain("return false");
    expect(source).toContain("return true");
  });

  test("the generated package preserves Base UI CSP and direction entrypoints", async () => {
    const [cspProvider, directionProvider] = await Promise.all([
      readFile(path.join(baseUiRoot, "csp-provider.ts"), "utf8"),
      readFile(path.join(baseUiRoot, "direction-provider.ts"), "utf8"),
    ]);

    expect(cspProvider).toContain("@generated from apps/ui/registry/default");
    expect(cspProvider).toContain('from "@base-ui/react/csp-provider"');
    expect(directionProvider).toContain('from "@base-ui/react/direction-provider"');
  });
});
