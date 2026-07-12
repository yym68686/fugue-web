import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import {
  finishGate,
  listFiles,
  parseArgs,
  ROOT,
  readJson,
  workspaceManifests,
  writeReport,
} from "./lib.mjs";

const COSS_COMMIT = "1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4";
const COSS_REPOSITORY = "https://github.com/cosscom/coss";
const IMPORTED_REGISTRY_DIRECTORIES = [
  "apps/ui/registry/default/base-ui",
  "apps/ui/registry/default/hooks",
  "apps/ui/registry/default/lib",
  "apps/ui/registry/default/ui",
];
const args = parseArgs();
const errors = [];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeLicense(manifest, packageDirectory) {
  if (typeof manifest.license === "string" && manifest.license.trim()) {
    return manifest.license.trim();
  }
  if (Array.isArray(manifest.licenses) && manifest.licenses.length > 0) {
    const values = manifest.licenses
      .map((license) => (typeof license === "string" ? license : license?.type))
      .filter(Boolean);
    if (values.length > 0) {
      return values.join(" OR ");
    }
  }
  const licenseFile = readdirSync(packageDirectory).find((name) =>
    /^(?:licen[cs]e|copying|notice)(?:\.|$)/i.test(name),
  );
  return licenseFile ? `SEE LICENSE IN ${licenseFile}` : null;
}

function validateProvenance() {
  const manifestPath = join(ROOT, "docs", "upstream", "coss-files.json");
  const noticePath = join(ROOT, "THIRD_PARTY_NOTICES.md");
  const provenancePath = join(ROOT, "docs", "coss-upstream-provenance.md");
  if (!existsSync(manifestPath)) {
    errors.push("docs/upstream/coss-files.json is missing");
    return { importedFiles: 0, verifiedUnmodifiedFiles: 0 };
  }
  if (!existsSync(noticePath)) {
    errors.push("THIRD_PARTY_NOTICES.md is missing");
  }
  if (!existsSync(provenancePath)) {
    errors.push("docs/coss-upstream-provenance.md is missing");
  }

  const provenance = readJson(manifestPath);
  if (provenance.schemaVersion !== 1) {
    errors.push("COSS provenance schemaVersion must be 1");
  }
  if (provenance.upstream?.repository !== COSS_REPOSITORY) {
    errors.push(`COSS provenance repository must be ${COSS_REPOSITORY}`);
  }
  if (provenance.upstream?.commit !== COSS_COMMIT) {
    errors.push(`COSS provenance commit must remain pinned to ${COSS_COMMIT}`);
  }
  if (provenance.policy?.allowedSourcePrefix !== "apps/ui/") {
    errors.push("COSS source allow-list must be restricted to apps/ui/");
  }

  const importedLocalPaths = new Set();
  let verifiedUnmodifiedFiles = 0;
  for (const entry of provenance.files ?? []) {
    const label = entry.localPath ?? entry.sourcePath ?? "unknown provenance row";
    if (!entry.sourcePath?.startsWith("apps/ui/")) {
      errors.push(`${label} uses a COSS source outside the MIT apps/ui allow-list`);
    }
    if (entry.sourceCommit !== COSS_COMMIT) {
      errors.push(`${label} is not pinned to ${COSS_COMMIT}`);
    }
    if (!String(entry.license ?? "").includes("MIT")) {
      errors.push(`${label} does not record the upstream MIT license`);
    }
    if (!/^[a-f0-9]{64}$/.test(entry.sourceSha256 ?? "")) {
      errors.push(`${label} has no valid upstream SHA-256`);
    }
    if (!entry.localPath || entry.localPath.includes("..")) {
      errors.push(`${label} has an unsafe or missing localPath`);
      continue;
    }
    if (importedLocalPaths.has(entry.localPath)) {
      errors.push(`${entry.localPath} appears more than once in COSS provenance`);
    }
    importedLocalPaths.add(entry.localPath);

    const localPath = resolve(ROOT, entry.localPath);
    if (!existsSync(localPath)) {
      errors.push(`${entry.localPath} is recorded but does not exist`);
      continue;
    }
    if (!String(entry.localModifications ?? "").trim()) {
      errors.push(`${entry.localPath} must describe its local modifications`);
    }
    if (String(entry.localModifications).startsWith("None in editable")) {
      const currentHash = sha256(localPath);
      if (currentHash !== entry.sourceSha256) {
        errors.push(
          `${entry.localPath} changed without updating its provenance modification record`,
        );
      } else {
        verifiedUnmodifiedFiles += 1;
      }
    }
  }

  for (const directory of IMPORTED_REGISTRY_DIRECTORIES) {
    for (const path of listFiles(join(ROOT, directory))) {
      const localPath = relative(ROOT, path);
      if (!importedLocalPaths.has(localPath)) {
        errors.push(
          `${localPath} is in an upstream-derived registry directory but has no provenance row`,
        );
      }
    }
  }

  for (const path of [noticePath, provenancePath]) {
    if (!existsSync(path)) {
      continue;
    }
    const content = readFileSync(path, "utf8");
    if (!content.includes(COSS_COMMIT)) {
      errors.push(`${relative(ROOT, path)} must name the pinned COSS commit`);
    }
    if (!content.includes("MIT")) {
      errors.push(`${relative(ROOT, path)} must preserve the COSS MIT notice`);
    }
  }

  return {
    importedFiles: importedLocalPaths.size,
    verifiedUnmodifiedFiles,
  };
}

function packageComponents() {
  const nodeModules = join(ROOT, "node_modules");
  if (!existsSync(nodeModules)) {
    errors.push("node_modules is missing; run bun install --frozen-lockfile first");
    return [];
  }

  const packages = new Map();
  for (const manifestPath of listFiles(
    nodeModules,
    (path) => basename(path) === "package.json",
  )) {
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    if (!manifest.name || !manifest.version) {
      continue;
    }
    const packageDirectory = dirname(manifestPath);
    const license = normalizeLicense(manifest, packageDirectory);
    const key = `${manifest.name}@${manifest.version}`;
    if (!license) {
      errors.push(`${key} has no license metadata or license file`);
    }
    if (/\bAGPL(?:-|\b)/i.test(license ?? "")) {
      errors.push(`${key} uses AGPL and is not on an approved dependency allow-list`);
    }

    const existing = packages.get(key);
    if (existing && existing.license !== license) {
      errors.push(
        `${key} has conflicting license metadata: ${existing.license} / ${license}`,
      );
      continue;
    }
    if (!existing) {
      const scopeIndex = manifest.name.startsWith("@")
        ? manifest.name.indexOf("/")
        : -1;
      packages.set(key, {
        type: "library",
        group: scopeIndex === -1 ? undefined : manifest.name.slice(0, scopeIndex),
        name: scopeIndex === -1 ? manifest.name : manifest.name.slice(scopeIndex + 1),
        version: manifest.version,
        purl: `pkg:npm/${
          scopeIndex === -1
            ? encodeURIComponent(manifest.name)
            : `${encodeURIComponent(manifest.name.slice(0, scopeIndex))}/${encodeURIComponent(manifest.name.slice(scopeIndex + 1))}`
        }@${encodeURIComponent(manifest.version)}`,
        licenses: license ? [{ expression: license }] : [],
        license,
        packageName: manifest.name,
      });
    }
  }

  return [...packages.values()].sort((left, right) =>
    `${left.packageName}@${left.version}`.localeCompare(
      `${right.packageName}@${right.version}`,
    ),
  );
}

const provenance = validateProvenance();
const components = packageComponents();
const workspaceComponents = workspaceManifests().map(({ manifest, relativePath }) => ({
  type: manifest.name === "@fugue/web" ? "application" : "library",
  name: manifest.name,
  version: manifest.version ?? "0.0.0",
  properties: [{ name: "fugue:manifest", value: relativePath }],
}));
const sbom = {
  $schema: "http://cyclonedx.org/schema/bom-1.5.schema.json",
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: "fugue-web-workspace",
      version: "0.0.0",
    },
    properties: [
      { name: "fugue:coss.repository", value: COSS_REPOSITORY },
      { name: "fugue:coss.commit", value: COSS_COMMIT },
      {
        name: "fugue:coss.importedFiles",
        value: String(provenance.importedFiles),
      },
    ],
  },
  components: [
    ...workspaceComponents,
    ...components.map(
      ({ license: _license, packageName: _name, ...component }) => component,
    ),
  ],
};

const outputPath = args.value("output");
if (outputPath) {
  writeReport(outputPath, sbom);
}
const report = {
  schemaVersion: 1,
  gate: "licenses-provenance-sbom",
  passed: errors.length === 0,
  coss: {
    repository: COSS_REPOSITORY,
    commit: COSS_COMMIT,
    ...provenance,
  },
  dependencyComponents: components.length,
  workspaceComponents: workspaceComponents.length,
  sbomOutput: outputPath ?? null,
  violations: errors,
};

console.log(
  `COSS provenance: ${provenance.importedFiles} imported files (${provenance.verifiedUnmodifiedFiles} byte-identical to recorded upstream)`,
);
console.log(`SBOM: ${components.length} unique installed dependency components`);
finishGate("License, provenance and SBOM gate", errors, report, args.value("report"));
