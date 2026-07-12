import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(target)));
    else if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(target);
  }
  return files;
}

test("only the locale preference uses an accessible native select", async () => {
  const files = await sourceFiles(path.join(webRoot, "components"));
  const failures: string[] = [];
  const nativeSelectFiles: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const select of source.matchAll(/<select\b[\s\S]*?>/g)) {
      nativeSelectFiles.push(path.relative(webRoot, file));
      if (!/\b(?:aria-label|aria-labelledby|id)=/.test(select[0])) {
        failures.push(`${path.relative(webRoot, file)} has an unnamed native select`);
      }
    }
    for (const label of source.matchAll(/<FieldLabel\b[\s\S]*?>/g)) {
      if (!/\bhtmlFor=/.test(label[0])) {
        failures.push(`${path.relative(webRoot, file)} has an unbound FieldLabel`);
      }
    }
  }

  expect(failures).toEqual([]);
  expect(nativeSelectFiles).toEqual(["components/i18n/locale-select.tsx"]);
});

test("every copy surface consumes the registry clipboard hook", async () => {
  for (const relativePath of [
    "components/shared/copy-button.tsx",
    "components/fugue-coss/access-keys-console.tsx",
    "components/fugue-coss/admin-cluster-console.tsx",
    "components/fugue-coss/project-workbench-deferred-tabs.tsx",
  ]) {
    const source = await readFile(path.join(webRoot, relativePath), "utf8");
    expect(source).toContain("@fugue/ui/hooks/use-copy-to-clipboard");
    expect(source).not.toContain("@/lib/ui/clipboard");
  }
});

test("legacy raw control primitives stay removed", async () => {
  const globals = await readFile(path.join(webRoot, "app/globals.css"), "utf8");
  expect(globals).not.toMatch(/\.coss-(?:input|select|textarea)(?=[\s,{.:>])/);
  expect(globals).toMatch(
    /@media \(max-width: 640px\)[\s\S]*?\.coss-locale-select select\s*{\s*font-size:\s*16px;/,
  );
});

test("shared controls keep mobile-safe typography", async () => {
  const registryRoot = path.resolve(webRoot, "../../apps/ui/registry/default/ui");
  for (const component of ["input.tsx", "select.tsx", "textarea.tsx"]) {
    const source = await readFile(path.join(registryRoot, component), "utf8");
    expect(source).toContain("text-base");
    expect(source).toContain("sm:text-sm");
  }
});
