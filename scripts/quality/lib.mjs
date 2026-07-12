import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse ${relative(ROOT, path)}: ${error.message}`);
  }
}

export function listFiles(directory, predicate = () => true) {
  if (!existsSync(directory)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...listFiles(path, predicate));
    } else if (predicate(path)) {
      files.push(path);
    }
  }
  return files;
}

export function workspaceManifests() {
  const manifestPaths = [join(ROOT, "package.json")];
  const workspaceParents = [
    join(ROOT, "apps"),
    join(ROOT, "apps", "examples"),
    join(ROOT, "packages"),
  ];

  for (const parent of workspaceParents) {
    if (!existsSync(parent)) {
      continue;
    }
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        continue;
      }
      const path = join(parent, entry.name, "package.json");
      if (existsSync(path)) {
        manifestPaths.push(path);
      }
    }
  }

  return [...new Set(manifestPaths)].sort().map((path) => ({
    manifest: readJson(path),
    path,
    relativePath: relative(ROOT, path),
  }));
}

export function parseArgs(argv = process.argv.slice(2)) {
  const values = new Map();
  const flags = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const separator = argument.indexOf("=");
    if (separator !== -1) {
      values.set(argument.slice(2, separator), argument.slice(separator + 1));
      continue;
    }
    const key = argument.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }

  return {
    flag(name) {
      return flags.has(name);
    },
    value(name, fallback) {
      return values.get(name) ?? fallback;
    },
  };
}

export function writeReport(reportPath, report) {
  if (!reportPath) {
    return;
  }
  const absolutePath = resolve(ROOT, reportPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${relative(ROOT, absolutePath)}`);
}

export function finishGate(name, errors, report, reportPath) {
  writeReport(reportPath, report);
  if (errors.length > 0) {
    console.error(`\n${name} failed with ${errors.length} violation(s):`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`${name} passed.`);
}
