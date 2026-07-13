#!/usr/bin/env node

import { spawn } from "node:child_process";
import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneAppRoot = path.join(appRoot, ".next", "standalone", "apps", "web");
const serverPath = path.join(standaloneAppRoot, "server.js");

function readFlag(name) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex !== -1) {
    return process.argv[exactIndex + 1];
  }

  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function copyRuntimeDirectory(source, target, { required }) {
  try {
    await stat(source);
  } catch (error) {
    if (!required && error && typeof error === "object" && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  await rm(target, { force: true, recursive: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
}

async function main() {
  try {
    await stat(serverPath);
  } catch {
    throw new Error(
      "Standalone server is missing. Run `bun run build` before `bun run start`.",
    );
  }

  await copyRuntimeDirectory(
    path.join(appRoot, ".next", "static"),
    path.join(standaloneAppRoot, ".next", "static"),
    { required: true },
  );
  await copyRuntimeDirectory(
    path.join(appRoot, "public"),
    path.join(standaloneAppRoot, "public"),
    { required: false },
  );

  const environment = { ...process.env };
  const hostname = readFlag("--hostname");
  const port = readFlag("--port");
  if (hostname) environment.HOSTNAME = hostname;
  if (port) environment.PORT = port;

  const child = spawn(process.execPath, [serverPath], {
    cwd: standaloneAppRoot,
    env: environment,
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => child.kill(signal));
  }

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Standalone start failed.");
  process.exitCode = 1;
});
