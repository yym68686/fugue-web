import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(appRoot, "registry/default");
const packageRoot = path.resolve(appRoot, "../../packages/ui");
const checkOnly = process.argv.includes("--check");

const trees = [
  { source: "base-ui", target: "base-ui" },
  { source: "hooks", target: "hooks" },
  { source: "lib", target: "lib" },
  { source: "ui", target: "components" },
] as const;

const generatedMarker =
  "// @generated from apps/ui/registry/default by apps/ui/scripts/sync-ui.ts — DO NOT EDIT.";

function rewriteImports(source: string): string {
  return source
    .replace(/(["'])@\/lib\//g, "$1@fugue/ui/lib/")
    .replace(/(["'])@\/hooks\//g, "$1@fugue/ui/hooks/")
    .replace(/(["'])@\/registry\/default\/ui\//g, "$1@fugue/ui/components/")
    .replace(/(["'])@\/registry\/default\/hooks\//g, "$1@fugue/ui/hooks/")
    .replace(/(["'])@\/registry\/default\/lib\//g, "$1@fugue/ui/lib/")
    .replace(/(["'])@\/registry\/default\/base-ui\//g, "$1@fugue/ui/base-ui/");
}

function markGenerated(source: string): string {
  const directive = /^(["']use client["'];\s*\n)/;
  const match = source.match(directive);
  const directiveLine = match?.[1];
  if (directiveLine) {
    return `${directiveLine}\n${generatedMarker}\n${source.slice(directiveLine.length)}`;
  }
  return `${generatedMarker}\n${source}`;
}

async function copyTree(sourceDir: string, targetDir: string): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(sourcePath, targetPath);
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported registry entry: ${sourcePath}`);
    }
    const source = await fs.readFile(sourcePath, "utf8");
    const generated = /\.[cm]?[jt]sx?$/.test(entry.name)
      ? markGenerated(rewriteImports(source))
      : source;
    await fs.writeFile(targetPath, generated, "utf8");
  }
}

async function listFiles(root: string, prefix = ""): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(root, prefix), {
      withFileTypes: true,
    });
    const files: string[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.join(prefix, entry.name);
      if (entry.isDirectory()) files.push(...(await listFiles(root, relative)));
      else if (entry.isFile()) files.push(relative);
    }
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function compareTrees(expected: string, actual: string): Promise<string[]> {
  const expectedFiles = await listFiles(expected);
  const actualFiles = await listFiles(actual);
  const differences = new Set<string>();
  for (const file of expectedFiles) {
    if (!actualFiles.includes(file)) {
      differences.add(`missing ${file}`);
      continue;
    }
    const [left, right] = await Promise.all([
      fs.readFile(path.join(expected, file)),
      fs.readFile(path.join(actual, file)),
    ]);
    if (!left.equals(right)) differences.add(`changed ${file}`);
  }
  for (const file of actualFiles) {
    if (!expectedFiles.includes(file)) differences.add(`orphan ${file}`);
  }
  return [...differences].sort();
}

const temporaryRoot = path.join(packageRoot, `.ui-sync-${process.pid}-${Date.now()}`);

try {
  await fs.mkdir(temporaryRoot, { recursive: true });
  for (const tree of trees) {
    const source = path.join(sourceRoot, tree.source);
    const generated = path.join(temporaryRoot, tree.target);
    const target = path.join(packageRoot, "src", tree.target);
    await copyTree(source, generated);
    const differences = await compareTrees(generated, target);

    if (checkOnly) {
      if (differences.length > 0) {
        throw new Error(
          `Registry/package drift in ${tree.target}:\n${differences
            .map((difference) => `  - ${difference}`)
            .join("\n")}`,
        );
      }
      continue;
    }

    const previous = `${target}.previous-${process.pid}`;
    await fs.rm(previous, { recursive: true, force: true });
    try {
      await fs.rename(target, previous);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      await fs.rename(generated, target);
      await fs.rm(previous, { recursive: true, force: true });
    } catch (error) {
      try {
        await fs.rename(previous, target);
      } catch {
        // Keep the original error; the target remains isolated to generated paths.
      }
      throw error;
    }
  }

  console.log(
    checkOnly
      ? "Registry source and @fugue/ui generated output are identical."
      : "Synced registry source to @fugue/ui generated output.",
  );
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
