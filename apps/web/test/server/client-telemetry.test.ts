import { afterEach, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { POST } from "../../app/api/telemetry/client/route";
import { readClientTelemetryRouteGroup } from "../../lib/telemetry/client-events";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalConsoleInfo = console.info;

afterEach(() => {
  if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = originalAppBaseUrl;
  console.info = originalConsoleInfo;
});

function telemetryRequest(payload: unknown, headers?: Record<string, string>) {
  process.env.APP_BASE_URL = "http://localhost:3000";
  return new Request("http://localhost:3000/api/telemetry/client", {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    method: "POST",
  });
}

describe("bounded client telemetry", () => {
  test("logs only allow-listed Web Vital fields and discards injected details", async () => {
    const output: string[] = [];
    console.info = ((value: string) => output.push(value)) as typeof console.info;

    const response = await POST(
      telemetryRequest({
        kind: "web-vital",
        message: "password=must-never-be-logged",
        name: "INP",
        rating: "needs-improvement",
        route: "console-project",
        stack: "sensitive stack",
        value: 123.45678,
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(output).toHaveLength(1);
    expect(JSON.parse(output[0] as string)).toEqual({
      event: "fugue_web_client_telemetry",
      kind: "web-vital",
      name: "INP",
      rating: "needs-improvement",
      route: "console-project",
      value: 123.457,
    });
    expect(output[0]).not.toContain("password");
    expect(output[0]).not.toContain("stack");
  });

  test("accepts an error occurrence without accepting an error message or stack", async () => {
    const output: string[] = [];
    console.info = ((value: string) => output.push(value)) as typeof console.info;

    const response = await POST(
      telemetryRequest(
        {
          kind: "client-error",
          message: "secret-bearing exception",
          route: "auth-sign-up",
          source: "root-boundary",
        },
        { "content-type": "text/plain;charset=UTF-8" },
      ),
    );

    expect(response.status).toBe(204);
    expect(JSON.parse(output[0] as string)).toEqual({
      event: "fugue_web_client_telemetry",
      kind: "client-error",
      route: "auth-sign-up",
      source: "root-boundary",
    });
  });

  test("rejects cross-origin, malformed, unsupported, and oversized events", async () => {
    const crossOrigin = await POST(
      telemetryRequest(
        {
          kind: "client-error",
          route: "docs",
          source: "window-error",
        },
        { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
      ),
    );
    expect(crossOrigin.status).toBe(403);

    const unsupported = await POST(
      telemetryRequest({
        kind: "web-vital",
        name: "SECRET_METRIC",
        rating: "good",
        route: "/app/projects/private-project-id",
        value: 1,
      }),
    );
    expect(unsupported.status).toBe(400);

    const oversized = await POST(
      telemetryRequest({
        kind: "client-error",
        padding: "x".repeat(3_000),
        route: "docs",
        source: "window-error",
      }),
    );
    expect(oversized.status).toBe(413);
  });

  test("groups routes without transmitting dynamic project identifiers", () => {
    expect(readClientTelemetryRouteGroup("/app/projects/private-project-id")).toBe(
      "console-project",
    );
    expect(readClientTelemetryRouteGroup("/app/settings/profile")).toBe("console");
    expect(readClientTelemetryRouteGroup("/auth/sign-up")).toBe("auth-sign-up");
    expect(readClientTelemetryRouteGroup("/unexpected/private/value")).toBe("unknown");
  });

  test("mounts the reporter globally and reports both render boundaries", async () => {
    const [layout, rootError, consoleError, reporter] = await Promise.all([
      readFile("app/layout.tsx", "utf8"),
      readFile("app/error.tsx", "utf8"),
      readFile("app/app/error.tsx", "utf8"),
      readFile("components/shared/client-telemetry.tsx", "utf8"),
    ]);

    expect(layout).toContain("<ClientTelemetry />");
    expect(rootError).toContain('reportClientError("root-boundary")');
    expect(consoleError).toContain('reportClientError("console-boundary")');
    expect(reporter).toContain('window.addEventListener("error"');
    expect(reporter).toContain('window.addEventListener("unhandledrejection"');
    expect(reporter).not.toContain("error.message");
    expect(reporter).not.toContain("error.stack");
  });
});
