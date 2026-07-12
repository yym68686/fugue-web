import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const COMPONENT_ROOT = join(import.meta.dir, "../../components");

function collectTsxFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) return collectTsxFiles(path);
    if (!entry.name.endsWith(".tsx") || entry.name.startsWith("project-workbench")) {
      return [];
    }

    return [path];
  });
}

describe("COSS form accessibility source contract", () => {
  const files = collectTsxFiles(COMPONENT_ROOT);
  const sources = files.map((file) => ({ file, source: readFileSync(file, "utf8") }));

  test("uses COSS text controls and an explicit native radio group", () => {
    const nativeForms = sources.flatMap(({ file, source }) =>
      source.includes("<form") ? [file] : [],
    );
    const rawControls = sources.flatMap(({ file, source }) => {
      if (file.endsWith("finalize-panel.tsx")) {
        return (
          source
            .replace(/<input\b(?=[^>]*\btype="hidden")[\s\S]*?\/>/, "")
            .match(/<(?:input|select|textarea)\b/g) ?? []
        );
      }
      if (file.endsWith("locale-select.tsx")) {
        return (
          source
            .replace(/<select[\s\S]*?<\/select>/, "")
            .match(/<(?:input|select|textarea)\b/g) ?? []
        );
      }
      if (file.endsWith("auth-panel.tsx")) {
        return (
          source
            .replace(/<input\b[\s\S]*?type="radio"[\s\S]*?\/>/g, "")
            .match(/<(?:input|select|textarea)\b/g) ?? []
        );
      }
      return source.match(/<(?:input|select|textarea)\b/g) ?? [];
    });

    expect(nativeForms).toEqual([]);
    expect(rawControls).toEqual([]);

    const auth = readFileSync(join(COMPONENT_ROOT, "auth/auth-panel.tsx"), "utf8");
    expect(auth).toContain('<fieldset className="coss-auth-methods" disabled={busy}>');
    expect(auth).toContain(
      '<legend className="coss-sr-only">{messages.authMethodLabel}</legend>',
    );
    expect(auth.match(/type="radio"/g)?.length).toBe(1);
    expect(auth).toContain('name="authMethod"');
    expect(auth).toContain("checked={method === value}");
    expect(auth).toContain("onChange={() => setMethod(value)}");
  });

  test("gives each Input, Textarea, and SelectTrigger a name and accessible-name hook", () => {
    const violations: string[] = [];

    for (const { file, source } of sources) {
      for (const match of source.matchAll(/<(Input|Textarea)\b[\s\S]*?\/>/g)) {
        const control = match[0];
        if (!/\bname=/.test(control)) violations.push(`${file}:missing-name`);
        if (!/\b(?:id|aria-label|aria-labelledby)=/.test(control)) {
          violations.push(`${file}:missing-accessible-name-hook`);
        }
      }

      for (const match of source.matchAll(/<SelectTrigger\b[\s\S]*?>/g)) {
        if (!/\b(?:id|aria-label|aria-labelledby)=/.test(match[0])) {
          violations.push(`${file}:unnamed-select-trigger`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("keeps Field error, control error, description, and disabled states paired", () => {
    const pairedFiles = [
      "auth/auth-panel.tsx",
      "fugue-coss/new-project-wizard.tsx",
      "fugue-coss/profile-security.tsx",
    ];

    for (const relativePath of pairedFiles) {
      const source = readFileSync(join(COMPONENT_ROOT, relativePath), "utf8");
      const fieldErrors = source.match(/<FieldError\b/g)?.length ?? 0;

      expect(fieldErrors).toBeGreaterThan(0);
      expect(source.match(/\bdata-invalid=/g)?.length ?? 0).toBe(fieldErrors);
      expect(source.match(/\baria-invalid=/g)?.length ?? 0).toBe(fieldErrors);
      expect(source.match(/\baria-describedby=/g)?.length ?? 0).toBe(fieldErrors);
    }

    const auth = readFileSync(join(COMPONENT_ROOT, "auth/auth-panel.tsx"), "utf8");
    const billing = readFileSync(
      join(COMPONENT_ROOT, "fugue-coss/billing-console.tsx"),
      "utf8",
    );
    const dns = readFileSync(
      join(COMPONENT_ROOT, "fugue-coss/dns-console.tsx"),
      "utf8",
    );
    const profile = readFileSync(
      join(COMPONENT_ROOT, "fugue-coss/profile-security.tsx"),
      "utf8",
    );

    expect(auth).toContain("data-disabled={busy || undefined}");
    expect(auth).toContain("disabled={busy}");
    expect(billing).toContain("data-disabled={saving || undefined}");
    expect(billing).toContain("disabled={saving}");
    expect(dns).toContain("data-disabled={editing || undefined}");
    expect(dns).toContain("disabled={editing}");
    expect(profile).toContain("<Field data-disabled>");
    expect(profile).toContain("disabled");
  });
});
