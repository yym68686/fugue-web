// Teaches `node --test` the "@/..." path alias from tsconfig.json, plus
// extensionless .ts resolution, so tests can import app modules unchanged.
// Node strips the TypeScript types itself (>= 22.6); nothing is compiled.

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";
import { register } from "node:module";

const repoRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts"];

// "server-only" throws on import outside a React Server Component. Under the
// test runner there is no RSC boundary to protect, so it resolves to a no-op and
// server modules stay importable.
const SERVER_ONLY_STUB = pathToFileURL(
  resolvePath(repoRoot, "tests/stubs/server-only.mjs"),
).href;

function firstExisting(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${basePath}${suffix}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { format: "module", shortCircuit: true, url: SERVER_ONLY_STUB };
  }

  if (specifier.startsWith("@/")) {
    const target = firstExisting(resolvePath(repoRoot, specifier.slice(2)));
    if (target) {
      return { format: undefined, shortCircuit: true, url: pathToFileURL(target).href };
    }
  }

  // Relative imports without an extension (".../password-policy").
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const target = firstExisting(resolvePath(parentDir, specifier));
    if (target) {
      return { format: undefined, shortCircuit: true, url: pathToFileURL(target).href };
    }
  }

  return nextResolve(specifier, context);
}

register(import.meta.url, import.meta.url);
