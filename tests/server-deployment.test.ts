import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  requestMigration,
  changeProjectRuntime,
} from "@/lib/servers/deployment";
import type { ServerActor } from "@/lib/servers/access";

const actor: ServerActor = {
  tenantId: "owner",
  email: "owner@example.test",
  key: "synthetic-key",
  scopes: ["app.migrate", "project.write", "runtime.reserve"],
  isAdmin: false,
};

let previousApiUrl: string | undefined;
beforeEach(() => {
  previousApiUrl = process.env.FUGUE_API_URL;
  process.env.FUGUE_API_URL = "https://api.example.test";
});
afterEach(() => {
  if (previousApiUrl === undefined) delete process.env.FUGUE_API_URL;
  else process.env.FUGUE_API_URL = previousApiUrl;
});

test("a failed migration preview never submits a real move", async (t) => {
  const requests: Record<string, unknown>[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string));
      return Response.json({
        impact: {
          app_id: "app",
          target_runtime_id: "target",
          pass: false,
          blockers: ["database localization required"],
        },
        app: { env: "secret-must-not-leak" },
      });
    },
  );
  const preview = await requestMigration(actor, "app", {
    targetRuntimeId: "target",
    dryRun: true,
  });
  assert.equal(JSON.stringify(preview).includes("secret-must-not-leak"), false);
  await assert.rejects(
    requestMigration(actor, "app", {
      targetRuntimeId: "target",
      dryRun: false,
    }),
    { status: 409 },
  );
  assert.equal(
    requests.every((r) => r.dry_run === true),
    true,
  );
});

test("every real move gets a fresh preview and returns no desired spec secrets", async (t) => {
  const requests: Record<string, unknown>[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      requests.push(body);
      return Response.json(
        body.dry_run
          ? {
              impact: {
                app_id: "app",
                target_runtime_id: "target",
                pass: true,
              },
            }
          : {
              operation: {
                id: "op-fixture",
                status: "pending",
                type: "migrate",
                desired_spec: { env: { SECRET: "secret-must-not-leak" } },
              },
            },
      );
    },
  );
  const result = await requestMigration(actor, "app", {
    targetRuntimeId: "target",
    dryRun: false,
    tenant_id: "attacker",
  });
  assert.deepEqual(requests, [
    { target_runtime_id: "target", dry_run: true },
    { target_runtime_id: "target", dry_run: false },
  ]);
  assert.equal(JSON.stringify(result).includes("secret-must-not-leak"), false);
  assert.equal("operation" in result && result.operation?.status, "pending");
});

test("migration refuses an unverified preview and missing app.migrate capability", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({
      impact: { app_id: "other-app", target_runtime_id: "target", pass: true },
    });
  });
  await assert.rejects(
    requestMigration({ ...actor, scopes: [] }, "app", {
      targetRuntimeId: "target",
      dryRun: false,
    }),
    { status: 403 },
  );
  assert.equal(calls, 0);
  await assert.rejects(
    requestMigration(actor, "app", {
      targetRuntimeId: "target",
      dryRun: false,
    }),
    { status: 502 },
  );
  assert.equal(calls, 1);
});

test("clearing project placement uses the explicit backend clear flag", async (t) => {
  const writes: Record<string, unknown>[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init: RequestInit) => {
      if (init.method !== "GET") writes.push(JSON.parse(init.body as string));
      return Response.json({ project: { id: "project" } });
    },
  );
  await changeProjectRuntime(actor, "project", {
    action: "default",
    runtimeId: "",
    name: "must-not-change",
  });
  assert.deepEqual(writes, [{ clear_default_runtime_id: true }]);
  await assert.rejects(
    changeProjectRuntime({ ...actor, scopes: ["project.write"] }, "project", {
      action: "reserve",
      runtimeId: "runtime",
    }),
    { status: 403 },
  );
  assert.equal(writes.length, 1);
});
