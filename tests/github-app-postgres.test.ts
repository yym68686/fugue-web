import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { ensureGitHubAppSchema, saveGitHubImageLink, enqueueGitHubImageEvent, claimGitHubJob, currentGitHubJobLink,
  finishGitHubJob, disableGitHubImageLink, consumeGitHubInstallState, revokeGitHubInstallation, retryGitHubImageJobs, renewGitHubJobLease, pruneGitHubAppHistory } from "@/lib/github/app-store";
import { bindGitHubImage } from "@/lib/github/app-service";
import { dispatchGitHubJob } from "@/lib/github/app-worker";
import { saveWorkspaceAccess } from "@/lib/workspace/store";
import { saveGitHubConnection } from "@/lib/github/connection-store";
import { POST as webhook } from "@/app/api/webhook/github/route";
import { externalServiceSettings, saveIntegrationCredential } from "@/lib/admin/external-services";
import { fugueApiEnv } from "./fixtures/fugue-api-env";

fugueApiEnv();
const databaseUrl = process.env.FUGUE_GITHUB_TEST_DATABASE_URL;

test("GitHub App durable queue and dispatcher (isolated real PostgreSQL)", { skip: !databaseUrl }, async (t) => {
  const schema = `github_app_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, max: 6 });
  const oldGlobals = { pool: globalThis.__fuguePgPool, schema: globalThis.__fugueDbSchemaPromise, version: globalThis.__fugueDbSchemaVersion, feature: globalThis.__fugueGitHubAppSchema };
  const variables = { WORKSPACE_STORE_SECRET: "synthetic-github-app-integration-seal-key", GITHUB_APP_ID: "123", GITHUB_APP_SLUG: "synthetic-app",
    GITHUB_APP_PRIVATE_KEY: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString(), GITHUB_APP_WEBHOOK_SECRET: "synthetic-webhook-secret" };
  const previous = new Map(Object.keys(variables).map((name) => [name, process.env[name]]));
  Object.assign(process.env, variables);
  globalThis.__fuguePgPool = pool;
  globalThis.__fugueDbSchemaPromise = undefined;
  globalThis.__fugueDbSchemaVersion = undefined;
  globalThis.__fugueGitHubAppSchema = undefined;
  t.after(async () => {
    if (globalThis.__fugueGitHubWorker) { clearInterval(globalThis.__fugueGitHubWorker.timer); await globalThis.__fugueGitHubWorker.running; globalThis.__fugueGitHubWorker = undefined; }
    globalThis.__fuguePgPool = oldGlobals.pool;
    globalThis.__fugueDbSchemaPromise = oldGlobals.schema;
    globalThis.__fugueDbSchemaVersion = oldGlobals.version;
    globalThis.__fugueGitHubAppSchema = oldGlobals.feature;
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  await ensureGitHubAppSchema();
  const email = "owner@example.test";
  await saveWorkspaceAccess({ email, tenantId: "tenant-owner", tenantName: "Owner", adminKeyId: "key-owner", adminKeyLabel: "workspace-admin",
    adminKeyPrefix: "test", adminKeySecret: "synthetic-tenant-key", adminKeyScopes: ["app.read", "app.deploy"], defaultProjectId: "project", defaultProjectName: "Project", firstAppId: "app", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await saveGitHubConnection({ email, accessToken: "synthetic-oauth-token", githubUserId: "1", login: "owner", scopes: ["repo"] });
  const linkInput = { email, appId: "app", projectId: "project", repo: "owner/repo", installationId: "42", workflow: ".github/workflows/release.yml", branch: "main", packageName: "", imageRef: "owner/image:latest", accountLogin: "owner", repositorySelection: "selected" };
  const event = { deliveryId: "delivery-1", eventName: "workflow_run", installationId: "42", repo: "owner/repo", workflow: "Release", workflowPath: ".github/workflows/release.yml", branch: "main", packageName: "" };
  let counter = 0;
  async function enqueue() { const e = { ...event, deliveryId: `dispatch-${++counter}` }; await enqueueGitHubImageEvent(e, `hash-${counter}`); return (await claimGitHubJob())!; }
  const calls: { host: string; path: string; method: string; body?: unknown }[] = [];
  const state = { busy: false, paused: false, tenant: "tenant-owner", installation: "42", suspended: false, push: true, permissions: true, imageEnabled: true, responseStatus: 200 };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push({ host: url.host, path: url.pathname, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const authorization = (init.headers as Record<string, string>).Authorization;
    if (url.host === "api.github.com") {
      if (url.pathname.endsWith("/installation")) {
        assert.equal(authorization.startsWith("Bearer eyJ"), true);
        return Response.json({ id: state.installation, app_id: 123, suspended_at: state.suspended ? "2026-01-01" : null, permissions: state.permissions ? { actions: "read" } : {}, events: ["workflow_run", "registry_package"], account: { login: "owner" }, repository_selection: "selected" });
      }
      assert.equal(authorization, "Bearer synthetic-oauth-token");
      return Response.json({ full_name: "owner/repo", permissions: { push: state.push } });
    }
    assert.equal(url.host, "api.example.test");
    assert.equal(authorization, "Bearer synthetic-tenant-key");
    assert.ok(init.signal, "bounded API calls carry an abort signal");
    if (url.pathname.endsWith("/image-tracking")) return Response.json({ tracking: { enabled: state.imageEnabled, image_ref: "owner/image:latest" } });
    if (url.pathname.endsWith("/image-sync")) {
      if (state.responseStatus !== 200) return Response.json({ error: "private-backend-detail" }, { status: state.responseStatus });
      return Response.json({ app_id: "app", changed: !state.busy, already_current: false, operation: { id: state.busy ? "op-busy" : "op-sync" } }, { status: state.busy ? 202 : 200 });
    }
    return Response.json({ app: { id: "app", tenant_id: state.tenant, project_id: "project", spec: { replicas: state.paused ? 0 : 1 } } });
  });

  await t.test("legacy rows stay inert; a verified explicit save enables only matching events", async () => {
    const link = await saveGitHubImageLink(linkInput);
    await pool.query("UPDATE app_github_app_image_links SET github_binding_revision = '' WHERE id=$1", [link!.id]);
    assert.equal((await enqueueGitHubImageEvent(event, "hash-1")).queued, 0);
    await saveGitHubImageLink(linkInput);
    for (const patch of [{ branch: "other" }, { workflow: "Test", workflowPath: "test.yml" }, { repo: "other/repo" }, { installationId: "43" }]) {
      assert.equal((await enqueueGitHubImageEvent({ ...event, ...patch, deliveryId: `filter-${++counter}` }, "hash")).queued, 0);
    }
    assert.deepEqual(await enqueueGitHubImageEvent({ ...event, deliveryId: "matching" }, "hash"), { duplicate: false, queued: 1 });
    await pool.query("DELETE FROM app_github_webhook_jobs");
  });

  await t.test("concurrent redelivery is deduplicated and payload-ID conflicts are rejected", async () => {
    const e = { ...event, deliveryId: "concurrent" };
    const results = await Promise.all(Array.from({ length: 6 }, () => enqueueGitHubImageEvent(e, "same-hash")));
    assert.equal(results.reduce((n, result) => n + result.queued, 0), 1);
    assert.equal(results.filter((result) => result.duplicate).length, 5);
    await assert.rejects(enqueueGitHubImageEvent(e, "different-hash"), /409/);
    const claims = await Promise.all(Array.from({ length: 6 }, claimGitHubJob));
    assert.equal(claims.filter(Boolean).length, 1);
    await finishGitHubJob(claims.find(Boolean)!, { status: "completed" });
  });

  await t.test("expired leases are recoverable; old owners cannot renew or finish reclaimed work", async () => {
    const first = await enqueue();
    await pool.query("UPDATE app_github_webhook_jobs SET lease_until = NOW() - INTERVAL '1 second' WHERE id=$1", [first.id]);
    const recovered = (await claimGitHubJob())!;
    assert.equal(recovered.id, first.id); assert.equal(recovered.attempts, first.attempts + 1);
    assert.equal(await renewGitHubJobLease(first), false);
    await finishGitHubJob(first, { status: "failed", error: "stale owner" });
    assert.equal((await pool.query("SELECT status FROM app_github_webhook_jobs WHERE id=$1", [first.id])).rows[0].status, "processing");
    assert.equal(await renewGitHubJobLease(recovered), true);
    await finishGitHubJob(recovered, { status: "completed" });
  });

  await t.test("tenant-scoped sync carries the exact image and delivery and busy 202 retries", async () => {
    const job = await enqueue(); state.busy = true;
    await dispatchGitHubJob(job);
    let row = (await pool.query("SELECT * FROM app_github_webhook_jobs WHERE id=$1", [job.id])).rows[0];
    assert.equal(row.status, "pending"); assert.equal(row.operation_id, "op-busy");
    const sync = calls.filter((call) => call.path.endsWith("/image-sync")).at(-1)!;
    assert.deepEqual(sync.body, { image_ref: "owner/image:latest", event: "github:workflow_run", delivery_id: job.delivery_id });
    state.busy = false;
    await pool.query("UPDATE app_github_webhook_jobs SET next_attempt_at = NOW() WHERE id=$1", [job.id]);
    await dispatchGitHubJob((await claimGitHubJob())!);
    row = (await pool.query("SELECT * FROM app_github_webhook_jobs WHERE id=$1", [job.id])).rows[0];
    assert.equal(row.status, "completed"); assert.equal(row.operation_id, "op-sync");
  });

  await t.test("disabled, rebound, revoked, or inactive bindings cancel without a deploy", async () => {
    for (const action of ["disabled", "rebound", "revoked", "inactive"]) {
      await pool.query("UPDATE app_users SET status='active' WHERE email=$1", [email]);
      await saveGitHubImageLink(linkInput);
      const job = await enqueue();
      if (action === "disabled") await disableGitHubImageLink(email, "app");
      if (action === "rebound") await saveGitHubImageLink(linkInput);
      if (action === "revoked") await revokeGitHubInstallation("42");
      if (action === "inactive") await pool.query("UPDATE app_users SET status='disabled' WHERE email=$1", [email]);
      const before = calls.length;
      await dispatchGitHubJob(job);
      assert.equal(calls.length, before);
      assert.equal((await pool.query("SELECT status FROM app_github_webhook_jobs WHERE id=$1", [job.id])).rows[0].status, "cancelled");
    }
    await pool.query("UPDATE app_users SET status='active' WHERE email=$1", [email]);
    await saveGitHubImageLink(linkInput);
  });

  await t.test("paused, foreign-tenant, suspended, and mismatched installations never deploy", async () => {
    for (const key of ["paused", "tenant", "suspended", "installation", "push"] as const) {
      const original = state[key];
      if (key === "paused" || key === "suspended") state[key] = true;
      else if (key === "push") state[key] = false;
      else state[key] = key === "tenant" ? "tenant-other" : "99";
      const job = await enqueue();
      const before = calls.filter((call) => call.path.endsWith("/image-sync")).length;
      await dispatchGitHubJob(job);
      assert.equal(calls.filter((call) => call.path.endsWith("/image-sync")).length, before);
      const row = (await pool.query("SELECT status,last_error FROM app_github_webhook_jobs WHERE id=$1", [job.id])).rows[0];
      assert.equal(row.status, "pending"); assert.ok(row.last_error);
      await pool.query("UPDATE app_github_webhook_jobs SET status='cancelled' WHERE id=$1", [job.id]);
      Object.assign(state, { [key]: original });
    }
  });

  await t.test("backend errors are redacted and exhaust retries; explicit retry is tenant/user scoped", async () => {
    const job = await enqueue(); state.responseStatus = 503;
    await pool.query("UPDATE app_github_webhook_jobs SET attempts=12 WHERE id=$1", [job.id]);
    await dispatchGitHubJob({ ...job, attempts: 12 }); state.responseStatus = 200;
    const row = (await pool.query("SELECT status,last_error FROM app_github_webhook_jobs WHERE id=$1", [job.id])).rows[0];
    assert.equal(row.status, "failed"); assert.equal(row.last_error.includes("private-backend-detail"), false);
    await retryGitHubImageJobs("other@example.test", "app"); assert.equal(await claimGitHubJob(), null);
    await retryGitHubImageJobs(email, "app"); await dispatchGitHubJob((await claimGitHubJob())!);
  });

  await t.test("install states are one-use even with concurrent callbacks", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => consumeGitHubInstallState("state-1")));
    assert.equal(results.filter(Boolean).length, 1);
  });

  await t.test("binding verifies GitHub write access and image tracking before persisting intent", async () => {
    // Bind reads are bounded too, but not required by existing console callers.
    state.push = false;
    await assert.rejects(bindGitHubImage(email, "synthetic-tenant-key", "app", { githubRepo: "owner/repo" }), /403/);
    state.push = true; state.imageEnabled = false;
    await assert.rejects(bindGitHubImage(email, "synthetic-tenant-key", "app", { githubRepo: "owner/repo" }), /409/);
    state.imageEnabled = true;
  });

  await t.test("signed ping and invalid requests do not deploy or enqueue work", async () => {
    const body = Buffer.from('{"zen":"synthetic"}');
    const headers = { "x-github-event": "ping", "x-github-delivery": "ping-1", "x-hub-signature-256": `sha256=${createHmac("sha256", variables.GITHUB_APP_WEBHOOK_SECRET).update(body).digest("hex")}` };
    const before = calls.length;
    assert.equal((await webhook(new Request("https://console.example.test/api/webhook/github", { method: "POST", body, headers }))).status, 200);
    assert.equal((await webhook(new Request("https://console.example.test/api/webhook/github", { method: "POST", body: Buffer.concat([body, Buffer.from(" ")]), headers }))).status, 401);
    assert.equal(calls.length, before);
  });

  await t.test("admin integration rotation is encrypted, audited and used by the webhook", async (t) => {
    const key = "GITHUB_APP_WEBHOOK_SECRET";
    const baseline = variables.GITHUB_APP_WEBHOOK_SECRET;
    const replacement = "synthetic-rotated-webhook-secret";
    const ping = (secret: string) => {
      const body = Buffer.from("{}");
      const headers = { "x-github-event": "ping", "x-github-delivery": "ping-rotation",
        "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` };
      return webhook(new Request("https://console.example.test/api/webhook/github", { method: "POST", body, headers }));
    };
    await saveIntegrationCredential(key, replacement, email);
    const settings = JSON.stringify(await externalServiceSettings());
    assert.ok(settings.includes('"overridden":true'));
    assert.ok(!settings.includes(replacement));
    assert.ok(!settings.includes(baseline));
    const row = (await pool.query("SELECT sealed_value FROM app_integration_credentials WHERE integration = $1", [key])).rows[0];
    assert.ok(row.sealed_value.startsWith("v2."));
    assert.ok(!row.sealed_value.includes(replacement));
    const audit = (await pool.query("SELECT actor_email, metadata FROM app_security_audit_events WHERE action = 'admin.integration-credential.updated'")).rows;
    assert.deepEqual(audit, [{ actor_email: email, metadata: { integration: key, override: true } }]);
    assert.equal((await ping(baseline)).status, 401);
    assert.equal((await ping(replacement)).status, 200);
    const previous = process.env.FUGUE_WEB_INTEGRATIONS_ENV_ONLY;
    t.after(() => {
      if (previous === undefined) delete process.env.FUGUE_WEB_INTEGRATIONS_ENV_ONLY;
      else process.env.FUGUE_WEB_INTEGRATIONS_ENV_ONLY = previous;
    });
    process.env.FUGUE_WEB_INTEGRATIONS_ENV_ONLY = "1";
    assert.equal((await ping(baseline)).status, 200);
    await assert.rejects(saveIntegrationCredential(key, null, email), /409/);
    delete process.env.FUGUE_WEB_INTEGRATIONS_ENV_ONLY;
    await saveIntegrationCredential(key, null, email);
    assert.equal((await ping(replacement)).status, 401);
    assert.equal((await ping(baseline)).status, 200);
  });

  await t.test("retention removes old finished jobs but preserves pending jobs and deduplication", async () => {
    const job = await enqueue(); await finishGitHubJob(job, { status: "pending" });
    await pool.query("UPDATE app_github_webhook_jobs SET updated_at=NOW()-INTERVAL '31 days'");
    await pruneGitHubAppHistory();
    const rows = (await pool.query("SELECT status FROM app_github_webhook_jobs")).rows;
    assert.deepEqual(rows.map((row) => row.status), ["pending"]);
    assert.equal((await enqueueGitHubImageEvent({ ...event, deliveryId: job.delivery_id }, `hash-${counter}`)).duplicate, true);
  });
});
