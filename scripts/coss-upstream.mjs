#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST_PATH = join(ROOT, "docs", "upstream", "coss-files.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const repository = manifest.upstream.repository;
const pinnedCommit = manifest.upstream.commit;
const pinnedTree = manifest.upstream.tree;
const command = process.argv[2] ?? "verify";
const args = process.argv.slice(3);

function option(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
}

function requireFullSha(value, label) {
  if (!/^[a-f0-9]{40}$/.test(value ?? "")) {
    throw new Error(`${label} must be a full 40-character Git SHA`);
  }
  return value;
}

function git(directory, ...gitArgs) {
  return execFileSync("git", gitArgs, {
    cwd: directory,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fetchCommits(commits) {
  const directory = mkdtempSync(join(tmpdir(), "fugue-coss-upstream-"));
  git(directory, "init", "--quiet");
  git(directory, "remote", "add", "origin", repository);
  for (const commit of [...new Set(commits)]) {
    git(directory, "fetch", "--quiet", "--depth=1", "origin", commit);
  }
  return directory;
}

function show(directory, commit, path) {
  return git(directory, "show", `${commit}:${path}`);
}

function verifyPinned(directory) {
  const errors = [];
  const actualTree = git(directory, "show", "-s", "--format=%T", pinnedCommit);
  if (actualTree !== pinnedTree) {
    errors.push(`tree mismatch: expected ${pinnedTree}, received ${actualTree}`);
  }

  const licensing = show(directory, pinnedCommit, "LICENSING.md");
  if (!/^## MIT\s*$[\s\S]*^apps\/ui\/$/im.test(licensing)) {
    errors.push("upstream LICENSING.md no longer declares apps/ui as MIT");
  }

  for (const entry of manifest.files) {
    if (!entry.sourcePath.startsWith(manifest.policy.allowedSourcePrefix)) {
      errors.push(`${entry.sourcePath}: outside the approved apps/ui source prefix`);
      continue;
    }
    let source;
    try {
      source = execFileSync("git", ["show", `${pinnedCommit}:${entry.sourcePath}`], {
        cwd: directory,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch {
      errors.push(`${entry.sourcePath}: missing at pinned commit`);
      continue;
    }
    const actualHash = createHash("sha256").update(source).digest("hex");
    if (actualHash !== entry.sourceSha256) {
      errors.push(`${entry.sourcePath}: SHA-256 mismatch`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `COSS pinned-source verification failed:\n- ${errors.join("\n- ")}`,
    );
  }

  return {
    repository,
    commit: pinnedCommit,
    tree: actualTree,
    importedFiles: manifest.files.length,
    licenseBoundary: "apps/ui/ only (MIT under upstream LICENSING.md)",
  };
}

function previewUpgrade(directory, targetCommit) {
  const licensingBefore = show(directory, pinnedCommit, "LICENSING.md");
  const licensingAfter = show(directory, targetCommit, "LICENSING.md");
  const changed = [];
  const missing = [];

  for (const entry of manifest.files) {
    let before;
    let after;
    try {
      before = show(directory, pinnedCommit, entry.sourcePath);
    } catch {
      before = null;
    }
    try {
      after = show(directory, targetCommit, entry.sourcePath);
    } catch {
      after = null;
    }
    if (after === null) {
      missing.push(entry.sourcePath);
    } else if (before !== after) {
      changed.push({
        sourcePath: entry.sourcePath,
        beforeSha256: before === null ? null : sha256(before),
        afterSha256: sha256(after),
      });
    }
  }

  const targetTree = git(directory, "show", "-s", "--format=%T", targetCommit);
  const report = {
    schemaVersion: 1,
    repository,
    from: { commit: pinnedCommit, tree: pinnedTree },
    to: { commit: targetCommit, tree: targetTree },
    licenseDeclarationChanged: licensingBefore !== licensingAfter,
    appsUiStillDeclaredMit: /^## MIT\s*$[\s\S]*^apps\/ui\/$/im.test(licensingAfter),
    allowListedFilesChanged: changed,
    allowListedFilesMissing: missing,
    note: "Read-only preview. Review license diff, source/API diff, shadcn --dry-run/--diff, tests and provenance before changing the pin.",
  };

  if (!report.appsUiStillDeclaredMit || missing.length > 0) {
    process.exitCode = 1;
  }
  return report;
}

let directory;
try {
  if (command === "verify") {
    directory = fetchCommits([pinnedCommit]);
    const report = verifyPinned(directory);
    console.log(JSON.stringify({ passed: true, ...report }, null, 2));
  } else if (command === "diff") {
    const targetCommit = requireFullSha(option("--to"), "--to");
    directory = fetchCommits([pinnedCommit, targetCommit]);
    verifyPinned(directory);
    const report = previewUpgrade(directory, targetCommit);
    const output = option("--output");
    if (output) {
      writeFileSync(resolve(ROOT, output), `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report, null, 2));
  } else {
    throw new Error(
      "Usage: coss-upstream.mjs verify | diff --to <full-sha> [--output <path>]",
    );
  }
} finally {
  if (directory) {
    rmSync(directory, { recursive: true, force: true });
  }
}
