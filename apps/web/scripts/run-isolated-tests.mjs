#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:[cm]?js|[cm]?ts|tsx)$/u;

function collectTestFiles(entry, files = []) {
  const absolute = path.resolve(process.cwd(), entry);

  if (statSync(absolute).isFile()) {
    if (TEST_FILE_PATTERN.test(absolute)) files.push(absolute);
    return files;
  }

  for (const child of readdirSync(absolute).sort()) {
    collectTestFiles(path.join(absolute, child), files);
  }

  return files;
}

const entries = process.argv.slice(2);

if (entries.length === 0) {
  process.stderr.write("Usage: run-isolated-tests.mjs <file-or-directory> [...]\n");
  process.exit(2);
}

const files = [...new Set(entries.flatMap((entry) => collectTestFiles(entry)))].sort();

if (files.length === 0) {
  process.stderr.write("No test files matched the requested entries.\n");
  process.exit(1);
}

const failures = [];

for (const file of files) {
  const relative = path.relative(process.cwd(), file);
  const result = spawnSync(process.execPath, ["test", relative], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    failures.push(relative);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Isolated test failures (${failures.length}):\n`);
  for (const file of failures) process.stderr.write(`- ${file}\n`);
  process.exit(1);
}

process.stdout.write(`Isolated test files passed: ${files.length}\n`);
