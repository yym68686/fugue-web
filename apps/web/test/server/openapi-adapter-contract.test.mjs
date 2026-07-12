import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return entry.name === ".next" || entry.name === "node_modules"
          ? []
          : listSourceFiles(target);
      }
      return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
    }),
  );
  return nested.flat();
}

test("deprecated App.source is isolated to the generated-contract adapter", async () => {
  const adapterPath = path.join(webRoot, "lib/fugue/api.ts");
  const adapter = await readFile(adapterPath, "utf8");

  assert.match(adapter, /buildSource:\s*buildSource|\bbuildSource,\s*\n/);
  assert.match(adapter, /app\.buildSource\s*\?\?\s*app\.source/);
  assert.match(adapter, /generated-contract adapter boundary/);

  const sourceFiles = await listSourceFiles(webRoot);
  for (const file of sourceFiles) {
    if (
      file === adapterPath ||
      file.endsWith(`${path.sep}openapi.generated.ts`) ||
      file.includes(`${path.sep}test${path.sep}`)
    ) {
      continue;
    }

    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /\bapp\.source\b/,
      `${path.relative(webRoot, file)} must consume app.buildSource`,
    );
  }
});
