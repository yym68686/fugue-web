import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { finishGate, parseArgs, ROOT, workspaceManifests } from "./lib.mjs";

const SINGLETONS = [
  "next",
  "react",
  "react-dom",
  "@base-ui/react",
  "tailwindcss",
  "typescript",
];
const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const args = parseArgs();
const errors = [];
const declarations = Object.fromEntries(SINGLETONS.map((name) => [name, []]));

for (const workspace of workspaceManifests()) {
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, specifier] of Object.entries(workspace.manifest[section] ?? {})) {
      if (!SINGLETONS.includes(name) || specifier.startsWith("workspace:")) {
        continue;
      }
      declarations[name].push({
        path: workspace.relativePath,
        section,
        specifier,
      });
    }
  }
}

for (const name of SINGLETONS) {
  const entries = declarations[name];
  if (entries.length === 0) {
    errors.push(`${name} is not declared by any workspace package`);
    continue;
  }
  const versions = new Set(entries.map((entry) => entry.specifier));
  if (versions.size !== 1) {
    errors.push(
      `${name} has multiple workspace versions: ${[...versions].sort().join(", ")}`,
    );
  }
  for (const entry of entries) {
    if (!EXACT_VERSION.test(entry.specifier)) {
      errors.push(
        `${entry.path} ${entry.section}.${name} must be an exact version, got ${entry.specifier}`,
      );
    }
  }
}

const declaredReact = declarations.react[0]?.specifier;
const declaredReactDom = declarations["react-dom"][0]?.specifier;
if (declaredReact && declaredReactDom && declaredReact !== declaredReactDom) {
  errors.push(
    `react (${declaredReact}) and react-dom (${declaredReactDom}) must be identical`,
  );
}

const homeBun = process.env.HOME ? join(process.env.HOME, ".bun", "bin", "bun") : null;
const bunExecutable = process.versions.bun
  ? process.execPath
  : homeBun && existsSync(homeBun)
    ? homeBun
    : "bun";
const installed = Object.fromEntries(SINGLETONS.map((name) => [name, new Set()]));
const tree = spawnSync(bunExecutable, ["pm", "ls", "--all"], {
  cwd: ROOT,
  encoding: "utf8",
});

if (tree.error || tree.status !== 0) {
  errors.push(
    `Could not inspect installed Bun dependency tree: ${tree.error?.message ?? tree.stderr.trim()}`,
  );
} else {
  for (const line of tree.stdout.split("\n")) {
    const match = line.match(/[├└]── (.+)@([^@\s]+)$/);
    if (!match || !SINGLETONS.includes(match[1])) {
      continue;
    }
    installed[match[1]].add(match[2]);
  }

  for (const name of SINGLETONS) {
    const versions = [...installed[name]].sort();
    if (versions.length !== 1) {
      errors.push(
        `${name} must resolve to one installed version, found ${versions.join(", ") || "none"}`,
      );
      continue;
    }
    const declared = declarations[name][0]?.specifier;
    if (declared && versions[0] !== declared) {
      errors.push(
        `${name} resolves to ${versions[0]} but workspace manifests require ${declared}`,
      );
    }
  }
}

const report = {
  schemaVersion: 1,
  gate: "workspace-singleton-versions",
  passed: errors.length === 0,
  packages: Object.fromEntries(
    SINGLETONS.map((name) => [
      name,
      {
        declarations: declarations[name],
        installedVersions: [...installed[name]].sort(),
      },
    ]),
  ),
  violations: errors,
};

for (const name of SINGLETONS) {
  const version =
    [...installed[name]][0] ?? declarations[name][0]?.specifier ?? "missing";
  console.log(`${name}: ${version}`);
}
finishGate("Workspace version gate", errors, report, args.value("report"));
