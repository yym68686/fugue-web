import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { ensureDbSchema } from "@/lib/db/schema";
import { setAppUserStatus } from "@/lib/app-users/store";
import { deliverWorkspaceHold } from "@/lib/workspace/access-holds";

const databaseUrl = process.env.FUGUE_GITHUB_TEST_DATABASE_URL;

test("ban and unban survive a failed control-plane delivery", { skip: !databaseUrl }, async (t) => {
  const schema = "access_hold_" + randomUUID().replaceAll("-", "");
  const admin = new Pool({ connectionString: databaseUrl, max: 1 });
  await admin.query("CREATE SCHEMA " + schema);
  const pool = new Pool({ connectionString: databaseUrl, options: "-c search_path=" + schema });
  globalThis.__fuguePgPool = pool;
  t.after(async () => {
    globalThis.__fuguePgPool = undefined;
    globalThis.__fugueDbSchemaPromise = undefined;
    globalThis.__fugueDbSchemaVersion = undefined;
    await pool.end();
    await admin.query("DROP SCHEMA " + schema + " CASCADE");
    await admin.end();
  });
  const oldUrl = process.env.FUGUE_INTERNAL_API_URL;
  const oldKey = process.env.FUGUE_BOOTSTRAP_KEY;
  process.env.FUGUE_INTERNAL_API_URL = "http://fixture.invalid";
  process.env.FUGUE_BOOTSTRAP_KEY = "fixture";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.FUGUE_INTERNAL_API_URL;
    else process.env.FUGUE_INTERNAL_API_URL = oldUrl;
    if (oldKey === undefined) delete process.env.FUGUE_BOOTSTRAP_KEY;
    else process.env.FUGUE_BOOTSTRAP_KEY = oldKey;
  });
  await ensureDbSchema();
  const email = "fixture@example.invalid";
  const tenant = "fixture-tenant";
  await pool.query("INSERT INTO app_users(email,provider) VALUES ($1,'fixture')", [email]);
  await pool.query(`INSERT INTO app_workspaces(user_email,tenant_id,tenant_name,admin_key_id,admin_key_label,admin_key_secret_sealed)
    VALUES ($1,$2,'workspace','key','label','fixture')`, [email,tenant]);
  await setAppUserStatus(email, "blocked", {actorEmail: "admin@example.invalid"});
  t.mock.method(globalThis, "fetch", async () => new Response("", {status:503}));
  assert.equal(await deliverWorkspaceHold(email), false);
  assert.deepEqual((await pool.query("SELECT held,applied FROM app_workspace_access_holds")).rows, [{held:true,applied:false}]);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init: RequestInit = {}) => {
    const {held} = JSON.parse(String(init.body));
    return Response.json({tenant_id:tenant, held});
  });
  assert.equal(await deliverWorkspaceHold(email),true);
  await setAppUserStatus(email, "active", {actorEmail:"admin@example.invalid"});
  assert.equal(await deliverWorkspaceHold(email),true);
  assert.deepEqual((await pool.query("SELECT held,applied FROM app_workspace_access_holds")).rows, [{held:false,applied:true}]);
});
