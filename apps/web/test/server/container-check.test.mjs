import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  evaluateHomepageHeaders,
  FORBIDDEN_IMAGE_PATHS,
  isNonRootContainerUser,
  parseContainerCheckArgs,
  parsePublishedPort,
  REQUIRED_VARY_FIELDS,
  runContainerCheck,
} from "../../../../scripts/quality/container-check.mjs";

const workspaceRoot = path.resolve(import.meta.dir, "../../../..");
const EXPECTED_VARY_FIELDS = [
  "accept-language",
  "cookie",
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "accept-encoding",
];
const EXPECTED_FORBIDDEN_IMAGE_PATHS = [
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

function readWorkspaceFile(relativePath) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

function createDockerDouble(options = {}) {
  const calls = [];

  async function docker(args) {
    calls.push(args);

    if (args[0] === "version") {
      return { code: 0, stderr: "", stdout: "27.0.0\n" };
    }

    if (args[0] === "build") {
      return { code: options.buildCode ?? 0, stderr: "", stdout: "" };
    }

    if (args[0] === "run" && args.includes("--detach")) {
      return { code: 0, stderr: "", stdout: "container-id\n" };
    }

    if (args[0] === "port") {
      return { code: 0, stderr: "", stdout: "127.0.0.1:49172\n" };
    }

    if (args[0] === "inspect") {
      return { code: 0, stderr: "", stdout: "running healthy\n" };
    }

    if (args[0] === "image" && args[1] === "inspect" && args.includes("--format")) {
      return { code: 0, stderr: "", stdout: "node\n" };
    }

    if (args[0] === "image" && args[1] === "inspect") {
      return { code: 0, stderr: "", stdout: "{}\n" };
    }

    if (args[0] === "exec") {
      return { code: 0, stderr: "", stdout: "1000\n" };
    }

    if (args[0] === "run" && args.includes("--rm")) {
      return { code: options.pathCheckCode ?? 0, stderr: "", stdout: "" };
    }

    if (args[0] === "rm") {
      return { code: 0, stderr: "", stdout: "" };
    }

    if (args[0] === "image" && args[1] === "rm") {
      return { code: 0, stderr: "", stdout: "" };
    }

    throw new Error(`Unexpected Docker call: ${args[0]}`);
  }

  return { calls, docker };
}

function createFetchDouble(options = {}) {
  return async (url) => {
    if (String(url).endsWith("/healthz")) {
      if (options.healthFailure) {
        throw new Error("sensitive transport detail");
      }

      return new Response('{"status":"ok"}', {
        headers: { "Cache-Control": "no-store" },
        status: 200,
      });
    }

    return new Response("homepage", {
      headers: {
        "Cache-Control": "private, no-store, no-cache, max-age=0",
        Vary: REQUIRED_VARY_FIELDS.join(", "),
      },
      status: 200,
    });
  };
}

describe("production container check contracts", () => {
  test("exposes the root script and keeps all required runtime contracts in source", () => {
    const rootPackage = JSON.parse(readWorkspaceFile("package.json"));
    const source = readWorkspaceFile("scripts/quality/container-check.mjs");
    const qualityWorkflow = readWorkspaceFile(".github/workflows/quality.yml");

    expect(rootPackage.scripts["container:check"]).toBe(
      "node scripts/quality/container-check.mjs",
    );
    expect(qualityWorkflow).toContain("node scripts/quality/container-check.mjs");
    expect(qualityWorkflow).toContain("--report artifacts/container.json");
    expect(source).toContain('"127.0.0.1::3000"');
    expect(source).toContain("process.once(signal, handler)");
    expect(source).toContain("finally {");
    expect(REQUIRED_VARY_FIELDS).toEqual(EXPECTED_VARY_FIELDS);
    expect(FORBIDDEN_IMAGE_PATHS).toEqual(EXPECTED_FORBIDDEN_IMAGE_PATHS);

    for (const field of EXPECTED_VARY_FIELDS) {
      expect(source).toContain(`"${field}"`);
    }

    for (const imagePath of EXPECTED_FORBIDDEN_IMAGE_PATHS) {
      expect(source).toContain(`"${imagePath}"`);
    }
  });

  test("parses supported arguments, random Docker ports, and non-root users", () => {
    expect(
      parseContainerCheckArgs([
        "--image=example.test/fugue:web",
        "--report",
        "artifacts/container.json",
      ]),
    ).toEqual({
      help: false,
      image: "example.test/fugue:web",
      report: "artifacts/container.json",
    });
    expect(() => parseContainerCheckArgs(["--unknown"])).toThrow("Unknown argument");
    expect(parsePublishedPort("127.0.0.1:49172\n")).toBe(49172);
    expect(isNonRootContainerUser("node")).toBe(true);
    expect(isNonRootContainerUser("1000:1000")).toBe(true);
    expect(isNonRootContainerUser("")).toBe(false);
    expect(isNonRootContainerUser("root")).toBe(false);
    expect(isNonRootContainerUser("0:0")).toBe(false);
  });

  test("requires the exact cache policy and seven unique Vary fields", () => {
    const valid = evaluateHomepageHeaders(
      new Headers({
        "Cache-Control": "private, no-store, no-cache",
        Vary: REQUIRED_VARY_FIELDS.join(", "),
      }),
    );
    expect(valid.errors).toEqual([]);

    const invalid = evaluateHomepageHeaders(
      new Headers({
        "Cache-Control": "public, max-age=300",
        Vary: `${REQUIRED_VARY_FIELDS.join(", ")}, cookie`,
      }),
    );
    expect(invalid.errors).toContain("Homepage Cache-Control is missing private.");
    expect(invalid.errors).toContain("Homepage Cache-Control is missing no-store.");
    expect(invalid.errors).toContain(
      "Homepage Vary must contain cookie exactly once; found 2.",
    );
    expect(invalid.errors).toContain(
      "Homepage Vary must contain exactly 7 fields; found 8.",
    );
  });

  test("builds, checks, reports, and cleans temporary Docker resources", async () => {
    const dockerDouble = createDockerDouble();
    const messages = [];
    let registeredCleanup;
    const report = await runContainerCheck(
      {},
      {
        docker: dockerDouble.docker,
        fetch: createFetchDouble(),
        info: (message) => messages.push(message),
        registerCleanup: (cleanup) => {
          registeredCleanup = cleanup;
        },
      },
    );

    expect(report.passed).toBe(true);
    expect(report.runtime).toEqual({
      health: "healthy",
      host: "127.0.0.1",
      portBinding: "ephemeral",
    });
    expect(report.checks).toEqual({
      forbiddenPathsAbsent: true,
      health: true,
      homepage: true,
      nonRoot: true,
    });
    expect(report.cleanup).toEqual({
      containerRemoved: true,
      temporaryImageRemoved: true,
    });
    expect(dockerDouble.calls.some((args) => args[0] === "build")).toBe(true);
    expect(
      dockerDouble.calls.some(
        (args) => args[0] === "run" && args.includes("127.0.0.1::3000"),
      ),
    ).toBe(true);
    expect(dockerDouble.calls.some((args) => args[0] === "rm")).toBe(true);
    expect(
      dockerDouble.calls.some((args) => args[0] === "image" && args[1] === "rm"),
    ).toBe(true);
    const runtimeCall = dockerDouble.calls.find(
      (args) => args[0] === "run" && args.includes("--detach"),
    );
    const environmentValues = runtimeCall.flatMap((argument, index) =>
      runtimeCall[index - 1] === "--env" ? [argument.split("=", 2)[1]] : [],
    );
    const publicOutput = JSON.stringify({ messages, report });

    expect(publicOutput).not.toContain("AUTH_SESSION_SECRET");
    for (const value of environmentValues) {
      expect(publicOutput).not.toContain(value);
    }
    expect(registeredCleanup).toBeTypeOf("function");
    await registeredCleanup();
  });

  test("reuses provided images and still cleans containers on request failure", async () => {
    const dockerDouble = createDockerDouble();
    const report = await runContainerCheck(
      { image: "fugue-web:test" },
      {
        docker: dockerDouble.docker,
        fetch: createFetchDouble({ healthFailure: true }),
        info: () => undefined,
      },
    );

    expect(report.passed).toBe(false);
    expect(report.violations).toContain("Health endpoint request failed.");
    expect(report.cleanup.containerRemoved).toBe(true);
    expect(report.cleanup.temporaryImageRemoved).toBeNull();
    expect(dockerDouble.calls.some((args) => args[0] === "build")).toBe(false);
    expect(
      dockerDouble.calls.some((args) => args[0] === "image" && args[1] === "rm"),
    ).toBe(false);
  });
});
