#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { scanSecretOutput } from "./secret-output-scan.mjs";

const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

export function runSecretOutputGate(command, args = [], options = {}) {
  const child = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    maxBuffer: options.maxBuffer ?? MAX_OUTPUT_BYTES,
  });
  const stdout = child.stdout ?? "";
  const stderr = child.stderr ?? "";
  const scan = scanSecretOutput(`${stdout}\n${stderr}`);
  const childExitCode =
    typeof child.status === "number" && Number.isInteger(child.status)
      ? child.status
      : 1;

  return {
    childError: child.error ?? null,
    childExitCode,
    exitCode: childExitCode !== 0 ? childExitCode : scan.total > 0 ? 1 : 0,
    scan,
    stderr,
    stdout,
  };
}

function readCommand(argv) {
  const separator = argv.indexOf("--");
  const command = separator === -1 ? argv : argv.slice(separator + 1);

  if (!command[0]) {
    throw new Error("Usage: secret-output-gate.mjs -- <command> [arguments...]");
  }

  return command;
}

function main() {
  let command;

  try {
    command = readCommand(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "A command is required."}\n`,
    );
    process.exitCode = 2;
    return;
  }

  const [executable, ...args] = command;
  const result = runSecretOutputGate(executable, args, {
    cwd: process.cwd(),
    env: process.env,
  });

  if (result.scan.total > 0) {
    process.stderr.write(
      `Secret output gate blocked ${result.scan.total} finding(s): ${JSON.stringify(result.scan.findings)}\n`,
    );
  } else {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  }

  if (result.childError) {
    process.stderr.write("Secret output gate could not start the command.\n");
  }

  process.exitCode = result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
