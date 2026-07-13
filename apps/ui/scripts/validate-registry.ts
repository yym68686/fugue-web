import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registry } from "@/registry/index";
import { isValidRegistryCategory } from "@/registry/registry-categories";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const itemNames = new Set(registry.items.map((item) => item.name));
const failures: string[] = [];
const seenNames = new Set<string>();

const forbiddenParticlePatterns = [
  /@\/lib\/(?:auth|billing|db|fugue|security|workspace)/,
  /FUGUE_(?:API_KEY|BOOTSTRAP_KEY)/,
  /(?:password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/i,
];

function referencedRegistryItems(source: string): Set<string> {
  const referenced = new Set<string>();
  const expression =
    /from\s+["']@\/registry\/default\/(ui|hooks|lib|base-ui)\/([^"']+)["']/g;
  for (const match of source.matchAll(expression)) {
    const item = match[2]?.replace(/\.(?:ts|tsx)$/, "");
    if (item && item !== "utils") referenced.add(`@fugue/${item}`);
  }
  return referenced;
}

for (const item of registry.items) {
  if (seenNames.has(item.name)) failures.push(`duplicate item name: ${item.name}`);
  seenNames.add(item.name);

  for (const dependency of item.registryDependencies ?? []) {
    if (dependency === "utils") continue;
    if (!dependency.startsWith("@fugue/")) {
      failures.push(
        `${item.name}: registry dependency must use @fugue namespace: ${dependency}`,
      );
      continue;
    }
    const dependencyName = dependency.slice("@fugue/".length);
    if (!itemNames.has(dependencyName)) {
      failures.push(`${item.name}: unknown registry dependency ${dependency}`);
    }
  }

  for (const category of item.categories ?? []) {
    if (!isValidRegistryCategory(category)) {
      failures.push(`${item.name}: unknown category ${category}`);
    }
  }

  for (const file of item.files ?? []) {
    const relative = typeof file === "string" ? file : file.path;
    if (relative.includes("..") || path.isAbsolute(relative)) {
      failures.push(`${item.name}: unsafe registry path ${relative}`);
      continue;
    }
    const sourcePath = path.join(appRoot, "registry/default", relative);
    let source: string;
    try {
      source = await fs.readFile(sourcePath, "utf8");
    } catch {
      failures.push(`${item.name}: missing source ${relative}`);
      continue;
    }

    const declared = new Set(item.registryDependencies ?? []);
    for (const dependency of referencedRegistryItems(source)) {
      if (!declared.has(dependency)) {
        failures.push(`${item.name}: import requires undeclared ${dependency}`);
      }
    }

    if (relative.startsWith("particles/")) {
      for (const pattern of forbiddenParticlePatterns) {
        if (pattern.test(source)) {
          failures.push(
            `${item.name}: particle contains forbidden product/secret pattern ${pattern}`,
          );
        }
      }
    }
  }
}

if (failures.length > 0) {
  throw new Error(
    `Registry validation failed:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`,
  );
}

console.log(
  `Validated ${registry.items.length} registry items and ${itemNames.size} unique names.`,
);
