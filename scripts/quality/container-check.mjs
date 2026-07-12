#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

import { finishGate, ROOT } from "./lib.mjs";

export const REQUIRED_VARY_FIELDS = [
  "accept-language",
  "cookie",
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "accept-encoding",
];

export const FORBIDDEN_IMAGE_PATHS = [
  "/app/artifacts",
  "/app/playwright-report",
  "/app/scripts",
  "/app/test",
  "/app/tests",
  "/app/test-results",
  "/app/apps/web/playwright-report",
  "/app/apps/web/playwright.config.ts",
  "/app/apps/web/scripts",
  "/app/apps/web/test",
  "/app/apps/web/test-results",
];

const HEALTH_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
const SIGNAL_EXIT_CODES = new Map([
  ["SIGINT", 130],
  ["SIGTERM", 143],
]);

function usage() {
  return [
    "Usage: container-check.mjs [--image <reference>] [--report <path>]",
    "",
    "Without --image, the current Dockerfile is built as a temporary image.",
  ].join("\n");
}

export function parseContainerCheckArgs(argv = process.argv.slice(2)) {
  const options = {
    help: false,
    image: null,
    report: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    const separator = argument.indexOf("=");
    const name = separator === -1 ? argument : argument.slice(0, separator);
    const inlineValue = separator === -1 ? null : argument.slice(separator + 1);

    if (name !== "--image" && name !== "--report") {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = inlineValue ?? argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`${name} requires a value.`);
    }

    if (inlineValue === null) {
      index += 1;
    }

    if (name === "--image") {
      options.image = value;
    } else {
      options.report = value;
    }
  }

  return options;
}

export function parsePublishedPort(value) {
  for (const line of String(value).split(/\r?\n/u)) {
    const match = line.trim().match(/^(?:127\.0\.0\.1|\[::1\]):(\d+)$/u);

    if (!match) {
      continue;
    }

    const port = Number(match[1]);

    if (Number.isSafeInteger(port) && port >= 1 && port <= 65_535) {
      return port;
    }
  }

  throw new Error("Docker did not publish a usable localhost port.");
}

export function isNonRootContainerUser(value) {
  const user = String(value).trim().split(":", 1)[0]?.toLowerCase();
  return Boolean(user && user !== "0" && user !== "root");
}

export function evaluateHomepageHeaders(headers) {
  const errors = [];
  const cacheControl = headers.get("cache-control") ?? "";
  const cacheDirectives = cacheControl
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const directive of ["private", "no-store"]) {
    if (!cacheDirectives.includes(directive)) {
      errors.push(`Homepage Cache-Control is missing ${directive}.`);
    }
  }

  const varyFields = (headers.get("vary") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const varyCounts = Object.fromEntries(
    REQUIRED_VARY_FIELDS.map((field) => [
      field,
      varyFields.filter((value) => value === field).length,
    ]),
  );

  for (const [field, count] of Object.entries(varyCounts)) {
    if (count !== 1) {
      errors.push(`Homepage Vary must contain ${field} exactly once; found ${count}.`);
    }
  }

  if (varyFields.length !== REQUIRED_VARY_FIELDS.length) {
    errors.push(
      `Homepage Vary must contain exactly ${REQUIRED_VARY_FIELDS.length} fields; found ${varyFields.length}.`,
    );
  }

  return {
    cacheDirectives,
    errors,
    varyCounts,
    varyFields,
  };
}

function createSafeTestEnvironment() {
  const nonce = randomUUID().replaceAll("-", "");
  const secret = (label) => `container-check-${label}-${nonce}`;

  return {
    APP_BASE_URL: "http://127.0.0.1:3000",
    APP_PUBLIC_URL: "http://127.0.0.1:3000",
    AUTH_RATE_LIMIT_SECRET: secret("rate-limit"),
    AUTH_SESSION_SECRET: secret("session"),
    DATABASE_URL: `postgresql://container-check:${secret("database")}@127.0.0.1:9/fugue`,
    FUGUE_API_URL: "http://127.0.0.1:9",
    FUGUE_BOOTSTRAP_KEY: secret("bootstrap"),
    GOOGLE_CLIENT_ID: "container-check-google-client",
    GOOGLE_CLIENT_SECRET: secret("google"),
    GOOGLE_REDIRECT_URI: "http://127.0.0.1:3000/api/auth/google/callback",
    RESEND_API_KEY: secret("resend"),
    RESEND_FROM_EMAIL: "noreply@example.test",
    WORKSPACE_STORE_KEY_ID: "container-check-v1",
    WORKSPACE_STORE_SECRET: secret("workspace"),
  };
}

function runDockerProcess(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd: ROOT,
      env: process.env,
      stdio: options.stream ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    if (!options.stream) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.on("error", () => {
      reject(new Error(`Docker ${args[0] ?? "command"} could not start.`));
    });
    child.on("close", (code) => {
      resolve({
        code: typeof code === "number" ? code : 1,
        stderr,
        stdout,
      });
    });
  });
}

async function requireDocker(dependencies, args, options) {
  const result = await dependencies.docker(args, options);

  if (result.code !== 0) {
    throw new Error(`Docker ${args[0] ?? "command"} failed.`);
  }

  return result.stdout.trim();
}

async function request(url, dependencies) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await dependencies.fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function readHealthState(value) {
  const [status = "unknown", health = "missing"] = String(value).trim().split(/\s+/u);
  return { health, status };
}

async function waitForHealthyContainer(containerName, dependencies) {
  const deadline = dependencies.now() + HEALTH_TIMEOUT_MS;

  while (dependencies.now() < deadline) {
    const state = readHealthState(
      await requireDocker(dependencies, [
        "inspect",
        "--format",
        "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}",
        containerName,
      ]),
    );

    if (state.status !== "running") {
      throw new Error("Production container stopped before becoming healthy.");
    }

    if (state.health === "healthy") {
      return state;
    }

    if (state.health === "unhealthy" || state.health === "missing") {
      throw new Error(`Production container health is ${state.health}.`);
    }

    await dependencies.sleep(500);
  }

  throw new Error("Production container did not become healthy before the timeout.");
}

function forbiddenPathCommand() {
  const checks = FORBIDDEN_IMAGE_PATHS.map(
    (path) => `test ! -e '${path.replaceAll("'", "'\\''")}'`,
  );
  return checks.join(" && ");
}

export async function runContainerCheck(options = {}, overrides = {}) {
  const dependencies = {
    docker: runDockerProcess,
    fetch: globalThis.fetch,
    info: (message) => console.log(message),
    now: () => Date.now(),
    registerCleanup: () => undefined,
    sleep: (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    ...overrides,
  };
  const temporaryImage = !options.image;
  const image =
    options.image ??
    `fugue-web-container-check:${process.pid}-${randomUUID().slice(0, 12)}`;
  const containerName = `fugue-web-container-check-${process.pid}-${randomUUID().slice(0, 12)}`;
  const errors = [];
  let containerStarted = false;
  let cleanupComplete = false;
  let containerRemoved = false;
  let imageRemoved = false;
  let port = null;
  const report = {
    schemaVersion: 1,
    gate: "production-container-contract",
    passed: false,
    imageMode: temporaryImage ? "built" : "provided",
    checks: {
      forbiddenPathsAbsent: false,
      health: false,
      homepage: false,
      nonRoot: false,
    },
    cleanup: {
      containerRemoved: false,
      temporaryImageRemoved: temporaryImage ? false : null,
    },
    runtime: {
      health: "unknown",
      host: "127.0.0.1",
      port: null,
    },
    response: {
      cacheDirectives: [],
      varyCounts: {},
      varyFields: [],
    },
    violations: errors,
  };

  const cleanup = async () => {
    if (cleanupComplete) {
      return;
    }
    cleanupComplete = true;

    if (containerStarted) {
      const removed = await dependencies.docker(["rm", "--force", containerName]);
      containerRemoved = removed.code === 0;
    } else {
      containerRemoved = true;
    }

    if (temporaryImage) {
      const removed = await dependencies.docker(["image", "rm", "--force", image]);
      imageRemoved = removed.code === 0;
    } else {
      imageRemoved = true;
    }
  };

  dependencies.registerCleanup(cleanup);

  try {
    await requireDocker(dependencies, ["version", "--format", "{{.Server.Version}}"]);

    if (temporaryImage) {
      dependencies.info("Building the temporary production image.");
      await requireDocker(
        dependencies,
        ["build", "--pull=false", "--tag", image, ROOT],
        { stream: true },
      );
    } else {
      dependencies.info("Using the provided production image.");
      await requireDocker(dependencies, ["image", "inspect", image]);
    }

    const environment = createSafeTestEnvironment();
    const environmentArgs = Object.entries(environment).flatMap(([name, value]) => [
      "--env",
      `${name}=${value}`,
    ]);

    await requireDocker(dependencies, [
      "run",
      "--detach",
      "--name",
      containerName,
      "--publish",
      "127.0.0.1::3000",
      "--health-interval",
      "1s",
      "--health-start-period",
      "1s",
      "--health-timeout",
      "2s",
      "--health-retries",
      "15",
      ...environmentArgs,
      image,
    ]);
    containerStarted = true;

    port = parsePublishedPort(
      await requireDocker(dependencies, ["port", containerName, "3000/tcp"]),
    );
    report.runtime.port = port;

    const healthState = await waitForHealthyContainer(containerName, dependencies);
    report.runtime.health = healthState.health;

    const imageUser = await requireDocker(dependencies, [
      "image",
      "inspect",
      "--format",
      "{{.Config.User}}",
      image,
    ]);
    const runtimeUid = await requireDocker(dependencies, [
      "exec",
      containerName,
      "id",
      "-u",
    ]);
    report.checks.nonRoot =
      isNonRootContainerUser(imageUser) && isNonRootContainerUser(runtimeUid);

    if (!report.checks.nonRoot) {
      errors.push("Production image or running container uses the root user.");
    }

    let healthResponse;

    try {
      healthResponse = await request(`http://127.0.0.1:${port}/healthz`, dependencies);
    } catch {
      errors.push("Health endpoint request failed.");
    }

    if (healthResponse) {
      report.checks.health = healthResponse.ok;

      if (!healthResponse.ok) {
        errors.push(`Health endpoint returned HTTP ${healthResponse.status}.`);
      }

      await healthResponse.body?.cancel().catch(() => undefined);
    }

    let homepageResponse;

    try {
      homepageResponse = await request(`http://127.0.0.1:${port}/`, dependencies);
    } catch {
      errors.push("Homepage request failed.");
    }

    if (homepageResponse) {
      if (!homepageResponse.ok) {
        errors.push(`Homepage returned HTTP ${homepageResponse.status}.`);
      }

      const headerCheck = evaluateHomepageHeaders(homepageResponse.headers);
      report.response.cacheDirectives = headerCheck.cacheDirectives;
      report.response.varyCounts = headerCheck.varyCounts;
      report.response.varyFields = headerCheck.varyFields;
      errors.push(...headerCheck.errors);
      report.checks.homepage = homepageResponse.ok && headerCheck.errors.length === 0;
      await homepageResponse.body?.cancel().catch(() => undefined);
    }

    const pathCheck = await dependencies.docker([
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      image,
      "-c",
      forbiddenPathCommand(),
    ]);
    report.checks.forbiddenPathsAbsent = pathCheck.code === 0;

    if (!report.checks.forbiddenPathsAbsent) {
      errors.push("Production image contains test, script, or Playwright artifacts.");
    }
  } catch (error) {
    errors.push(
      error instanceof Error && error.message
        ? error.message
        : "Production container verification failed.",
    );
  } finally {
    await cleanup();
    report.cleanup.containerRemoved = containerRemoved;
    report.cleanup.temporaryImageRemoved = temporaryImage ? imageRemoved : null;

    if (!containerRemoved) {
      errors.push("Temporary production container cleanup failed.");
    }

    if (!imageRemoved) {
      errors.push("Temporary production image cleanup failed.");
    }
  }

  report.passed = errors.length === 0;
  return report;
}

async function main() {
  let options;

  try {
    options = parseContainerCheckArgs();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  let cleanup = async () => undefined;
  let handlingSignal = false;
  const signalHandler = async (signal) => {
    if (handlingSignal) {
      return;
    }
    handlingSignal = true;
    await cleanup().catch(() => undefined);
    process.exit(SIGNAL_EXIT_CODES.get(signal) ?? 1);
  };
  const signalHandlers = new Map(
    [...SIGNAL_EXIT_CODES.keys()].map((signal) => [
      signal,
      () => {
        void signalHandler(signal);
      },
    ]),
  );

  for (const [signal, handler] of signalHandlers) {
    process.once(signal, handler);
  }

  try {
    const report = await runContainerCheck(options, {
      registerCleanup(value) {
        cleanup = value;
      },
    });
    finishGate(
      "Production container contract",
      report.violations,
      report,
      options.report,
    );
  } finally {
    await cleanup().catch(() => undefined);

    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
