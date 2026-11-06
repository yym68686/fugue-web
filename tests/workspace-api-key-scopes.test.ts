import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { Pool } from "pg";
import { prepareWorkspaceForKeyScopes, grantableWorkspaceScopes } from "@/lib/workspace/api-key-scopes";
import type { WorkspaceAccess } from "@/lib/workspace/store";
import { sealText } from "@/lib/security/seal";
import { WORKSPACE_ADMIN_SCOPES } from "@/lib/fugue/scopes";
import { getCachedWorkspaceAccessByEmail, invalidateCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";
import { fugueApiEnv } from "./fixtures/fugue-api-env";

fugueApiEnv();
const email = "owner@example.test";
const baseScopes = ["app.write", "apikey.write", "app.deploy", "custom.read"];
const workspace: WorkspaceAccess = {
  email, tenantId: "tenant-owner", tenantName: "Owner workspace",
  adminKeyId: "key-owner", adminKeyLabel: "workspace-admin", adminKeyPrefix: "synthetic",
  adminKeySecret: "synthetic-owner-key", adminKeyScopes: baseScopes,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  defaultProjectId: "project-preserved", defaultProjectName: "Project", firstAppId: "app-preserved",
};

async function requestReadScope(ownerEmail = email) {
  const prepared = await prepareWorkspaceForKeyScopes({ ...workspace, email: ownerEmail }, ["app.read", "app.write"]);
  return { scopes: prepared.adminKeyScopes };
}

function fixture(t: TestContext) {
  const oldPool = globalThis.__fuguePgPool;
  const oldSchema = globalThis.__fugueDbSchemaPromise;
  const oldVersion = globalThis.__fugueDbSchemaVersion;
  const oldSeal = process.env.WORKSPACE_STORE_SECRET;
  const oldBootstrap = process.env.FUGUE_BOOTSTRAP_KEY;
  process.env.WORKSPACE_STORE_SECRET = "synthetic-workspace-mail-permissions-test";
  process.env.FUGUE_BOOTSTRAP_KEY = "synthetic-bootstrap";
  globalThis.__fugueDbSchemaPromise = Promise.resolve();
  globalThis.__fugueDbSchemaVersion = "2026-09-12-project-templates";
  const row = {
    user_email: email, tenant_id: "tenant-owner", tenant_name: "Owner workspace",
    admin_key_id: "key-owner", admin_key_label: "workspace-admin", admin_key_prefix: "synthetic",
    admin_key_scopes: baseScopes, admin_key_secret_sealed: sealText("synthetic-owner-key"),
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    default_project_id: "project-preserved", default_project_name: "Project", first_app_id: "app-preserved",
  };
  const state = {
    scopes: [...baseScopes], actorType: "api-key", actorId: row.admin_key_id, tenantId: row.tenant_id,
    platformAdmin: false, status: "active", missing: false, foreignMirror: false,
    patchStatus: 200, patchMismatch: false, failVerify: false, failMirror: false,
  };
  const queries: { sql: string; values: unknown[] }[] = [];
  const calls: { path: string; method: string; body?: { scopes: string[] } }[] = [];
  globalThis.__fuguePgPool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[] = []) => {
        queries.push({ sql, values });
        if (sql.startsWith("SELECT * FROM app_workspaces") || sql.includes("FROM app_workspaces\n")) return { rows: state.missing ? [] : [row] };
        if (sql.startsWith("SELECT user_email")) return { rows: [{ user_email: state.foreignMirror ? "other@example.test" : email, tenant_id: row.tenant_id }] };
        if (sql.startsWith("UPDATE app_workspaces")) row.admin_key_scopes = JSON.parse(values[1] as string);
        if (sql.includes("INSERT INTO app_api_keys") && state.failMirror) throw new Error("Synthetic database failure");
        return { rows: [], rowCount: 1 };
      },
      release() {},
    }),
  } as unknown as Pool;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ path, method, body });
    if (path === "/v1/auth/context") {
      assert.equal((init.headers as Record<string, string>).Authorization, "Bearer synthetic-owner-key");
      if (state.status !== "active") return Response.json({ error: "Key inactive" }, { status: 401 });
      if (state.failVerify && calls.some((call) => call.method === "PATCH")) return Response.json({ error: "Unavailable" }, { status: 503 });
      return Response.json({ principal: { scopes: state.scopes, platform_admin: state.platformAdmin, tenant_id: state.tenantId, actor_id: state.actorId, actor_type: state.actorType } });
    }
    assert.equal(path, "/v1/api-keys/key-owner");
    assert.equal(method, "PATCH");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer synthetic-bootstrap");
    assert.deepEqual(Object.keys(body), ["scopes"]);
    if (state.patchStatus !== 200) return Response.json({ error: "Synthetic update failure" }, { status: state.patchStatus });
    state.scopes = body.scopes;
    return Response.json({ api_key: { id: state.patchMismatch ? "key-other" : row.admin_key_id, tenant_id: row.tenant_id, status: "active", label: "workspace-admin", scopes: state.scopes } });
  });
  invalidateCachedWorkspaceAccessByEmail(email);
  t.after(() => {
    globalThis.__fuguePgPool = oldPool;
    globalThis.__fugueDbSchemaPromise = oldSchema;
    globalThis.__fugueDbSchemaVersion = oldVersion;
    for (const [name, previous] of [["WORKSPACE_STORE_SECRET", oldSeal], ["FUGUE_BOOTSTRAP_KEY", oldBootstrap]]) {
      if (previous === undefined) delete process.env[name!]; else process.env[name!] = previous;
    }
    invalidateCachedWorkspaceAccessByEmail(email);
  });
  return { state, calls, queries, row };
}

test("new workspaces can grant the exact Mailflare read/write scopes", () => {
  assert.ok(WORKSPACE_ADMIN_SCOPES.includes("app.read"));
  assert.ok(WORKSPACE_ADMIN_SCOPES.includes("app.write"));
  assert.equal(new Set(WORKSPACE_ADMIN_SCOPES).size, WORKSPACE_ADMIN_SCOPES.length);
});

test("an old workspace adds only app.read, verifies it and updates both mirrors without rotating keys", async (t) => {
  const { queries, calls, row } = fixture(t);
  const cached = await getCachedWorkspaceAccessByEmail(email);
  assert.equal(cached?.adminKeyScopes.includes("app.read"), false);
  const result = await requestReadScope("Owner@Example.test");
  assert.deepEqual(result.scopes, [...baseScopes, "app.read"].sort());
  assert.deepEqual(calls.map((call) => call.method), ["GET", "PATCH", "GET"]);
  assert.deepEqual(calls[1].body, { scopes: result.scopes });
  assert.deepEqual(queries.find((q) => q.sql.includes("FOR UPDATE") && q.sql.includes("app_workspaces"))?.values, [email]);
  const mirror = queries.find((q) => q.sql.includes("INSERT INTO app_api_keys"));
  assert.equal(mirror?.values[0], "key-owner");
  assert.deepEqual(JSON.parse(mirror!.values[5] as string), result.scopes);
  assert.equal(row.default_project_id, "project-preserved");
  assert.equal(row.first_app_id, "app-preserved");
  assert.equal(queries.at(-1)?.sql, "COMMIT");
  assert.ok((await getCachedWorkspaceAccessByEmail(email))?.adminKeyScopes.includes("app.read"));
});

test("repeating a completed repair writes no further backend permissions", async (t) => {
  const { state, calls } = fixture(t);
  state.scopes.push("app.read");
  await requestReadScope();
  assert.deepEqual(calls.map((call) => call.method), ["GET", "GET"]);
});

for (const [name, alter] of [
  ["wrong tenant", (s) => { s.tenantId = "tenant-other"; }],
  ["wrong primary key", (s) => { s.actorId = "key-other"; }],
  ["workload identity", (s) => { s.actorType = "workload"; }],
  ["platform credential", (s) => { s.platformAdmin = true; }],
  ["wildcard credential", (s) => { s.scopes.push("*"); }],
  ["missing app.write", (s) => { s.scopes = ["apikey.write"]; }],
  ["missing apikey.write", (s) => { s.scopes = ["app.write"]; }],
  ["disabled key", (s) => { s.status = "disabled"; }],
  ["foreign mirror", (s) => { s.foreignMirror = true; }],
  ["missing workspace", (s) => { s.missing = true; }],
] satisfies [string, (state: ReturnType<typeof fixture>["state"]) => void][]) {
  test(`${name} cannot trigger a privileged scope update`, async (t) => {
    const { state, calls, queries } = fixture(t);
    alter(state);
    await assert.rejects(requestReadScope());
    assert.equal(calls.some((call) => call.method === "PATCH"), false);
    assert.equal(queries.some((q) => q.sql.startsWith("UPDATE") || q.sql.includes("INSERT INTO")), false);
    assert.equal(queries.at(-1)?.sql, "ROLLBACK");
  });
}

test("an ambiguous response can be retried without a second permission update", async (t) => {
  const { state, calls, queries } = fixture(t);
  state.failVerify = true;
  await assert.rejects(requestReadScope());
  assert.equal(queries.at(-1)?.sql, "ROLLBACK");
  assert.equal(queries.some((q) => q.sql.startsWith("UPDATE")), false);
  state.failVerify = false;
  await requestReadScope();
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 1);
});

test("backend rejection, mismatched evidence and database failure never claim success", async (t) => {
  const { state, queries } = fixture(t);
  state.patchStatus = 503;
  await assert.rejects(requestReadScope());
  assert.equal(queries.at(-1)?.sql, "ROLLBACK");
  state.patchStatus = 200;
  state.patchMismatch = true;
  await assert.rejects(requestReadScope(), { status: 409 });
  state.patchMismatch = false;
  state.failMirror = true;
  await assert.rejects(requestReadScope());
  assert.equal(queries.at(-1)?.sql, "ROLLBACK");
  state.failMirror = false;
  await requestReadScope();
  assert.equal(queries.at(-1)?.sql, "COMMIT");
});

test("ordinary key creation and label-only edits do not upgrade workspace scopes", async (t) => {
  const { calls, queries } = fixture(t);
  assert.equal(await prepareWorkspaceForKeyScopes(workspace, ["app.write"]), workspace);
  assert.equal(await prepareWorkspaceForKeyScopes(workspace, []), workspace);
  assert.equal(calls.length, 0);
  assert.equal(queries.length, 0);
});

test("a verified legacy owner can select app.read immediately without granting other missing scopes", () => {
  const context = { scopes: baseScopes, platformAdmin: false, tenantId: workspace.tenantId, actorType: "api-key", actorId: workspace.adminKeyId };
  const offered = grantableWorkspaceScopes(context, workspace);
  assert.ok(offered.includes("app.read"));
  assert.ok(offered.includes("app.write"));
  assert.equal(offered.includes("storage.admin"), false);
  assert.equal(grantableWorkspaceScopes({ ...context, actorId: "key-other" }, workspace).includes("app.read"), false);
  assert.equal(grantableWorkspaceScopes({ ...context, scopes: ["app.write"] }, workspace).includes("app.read"), false);
});

test("a workspace tenant change aborts before updating either the primary or child key", async (t) => {
  const { calls } = fixture(t);
  await assert.rejects(prepareWorkspaceForKeyScopes({ ...workspace, tenantId: "tenant-changed" }, ["app.read"]), { status: 409 });
  assert.equal(calls.length, 0);
});
