import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { GET as verifyEmail } from "@/app/api/auth/email/verify/route";
import { POST as signUp } from "@/app/api/auth/password/sign-up/route";
import { listAppUsers, listAppUsersPage } from "@/lib/app-users/store";
import { getPasswordHashByEmail } from "@/lib/auth/methods";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/token";
import { ensureDbSchema } from "@/lib/db/schema";

const databaseUrl = process.env.FUGUE_GITHUB_TEST_DATABASE_URL;
const origin = "https://app.example.invalid";
const verifiedEmail = "new@example.invalid";
const firstPassword = "First-Password-42";
const secondPassword = "Second-Password-73";

test("password signup requires the exact pending request and preserves existing accounts", { skip: !databaseUrl }, async (t) => {
  const schema = "password_registration_" + randomUUID().replaceAll("-", "");
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
  for (const [key, value] of Object.entries({
    APP_BASE_URL: origin,
    AUTH_SESSION_SECRET: "fixture-signing-key-for-password-registration",
    AUTH_RATE_LIMIT_SECRET: "fixture-rate-limit-key-for-password-registration",
    FUGUE_INTERNAL_API_URL: "https://control.example.invalid",
    FUGUE_BOOTSTRAP_KEY: "fixture-control-key",
    GOOGLE_CLIENT_ID: "fixture-client",
    GOOGLE_CLIENT_SECRET: "fixture-secret",
    GOOGLE_REDIRECT_URI: origin + "/api/auth/google/callback",
    RESEND_API_KEY: "fixture-resend-key",
    RESEND_FROM_EMAIL: "no-reply@example.invalid",
    WORKSPACE_STORE_SECRET: "fixture-sealing-key-for-password-registration",
  })) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    });
  }
  let nextLink = "";
  let tenantCreations = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(String(init.body)) : null;
    if (url === "https://api.resend.com/emails") {
      if (body.to[0] === "no-delivery@example.invalid") return Response.json({}, { status: 422 });
      nextLink = body.text.split("\n").find((line: string) => line.startsWith(origin)) ?? "";
      return Response.json({ id: "fixture" });
    }
    if (url === "https://control.example.invalid/v1/tenants" && init.method === "GET") {
      return Response.json({ tenants: [] });
    }
    if (url === "https://control.example.invalid/v1/tenants" && init.method === "POST") {
      return Response.json({ tenant: { id: "tenant-" + ++tenantCreations, name: body.name } });
    }
    if (url === "https://control.example.invalid/v1/api-keys" && init.method === "POST") {
      return Response.json({
        api_key: { id: "key-" + body.tenant_id, tenant_id: body.tenant_id, label: body.label, scopes: body.scopes },
        secret: "fixture-tenant-key",
      });
    }
    assert.fail("unexpected service request: " + url);
  });
  const request = (email: string, password: string, requestOrigin = origin) =>
    signUp(new Request(origin + "/api/auth/password/sign-up", {
      method: "POST",
      headers: { "content-type": "application/json", origin: requestOrigin },
      body: JSON.stringify({ email, password, confirmPassword: password, name: "Fixture" }),
    }));
  const start = async (email: string, password: string) => {
    const response = await request(email, password);
    assert.equal(response.status, 202);
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^__Host-fugue_signup_/);
    for (const flag of ["Secure", "HttpOnly", "Path=/", "SameSite=lax"]) {
      assert.ok(setCookie.includes(flag), flag);
    }
    assert.ok(nextLink);
    return { link: nextLink, cookie: setCookie.split(";")[0] };
  };
  const finish = (link: string, cookie?: string) =>
    verifyEmail(new NextRequest(link, { headers: cookie ? { cookie } : {} }));
  const location = (response: Response) => new URL(response.headers.get("location")!);

  await ensureDbSchema();
  for (const [email, verified, status] of [
    ["legacy@example.invalid", false, "active"],
    ["blocked@example.invalid", false, "blocked"],
    ["established@example.invalid", true, "active"],
  ]) {
    await pool.query("INSERT INTO app_users(email,provider,verified,status) VALUES ($1,'email',$2,$3)",
      [email, verified, status]);
    await pool.query("INSERT INTO app_auth_methods(user_email,method,secret_hash) VALUES ($1,'password','legacy')", [email]);
  }

  assert.equal((await request(verifiedEmail, firstPassword, "https://other.example.invalid")).status, 403);
  assert.equal((await request("no-delivery@example.invalid", firstPassword)).status, 503);
  assert.equal((await pool.query("SELECT id FROM app_pending_password_registrations")).rowCount, 0);

  const first = await start(verifiedEmail, firstPassword);
  const second = await start(verifiedEmail, secondPassword);
  assert.equal(await getPasswordHashByEmail(verifiedEmail), null);
  assert.equal((await pool.query("SELECT email FROM app_users WHERE email = $1", [verifiedEmail])).rowCount, 0);
  assert.deepEqual((await listAppUsers()).map((user) => user.email), ["established@example.invalid"]);
  const hidden = await listAppUsersPage({ query: "blocked" });
  assert.equal(hidden.pageInfo.totalItems, 0);
  assert.equal(hidden.summary.userCount, 1);

  assert.equal(location(await finish(second.link)).searchParams.get("error"), "signup-browser-required");
  assert.equal(location(await finish(second.link, first.cookie)).searchParams.get("error"), "signup-browser-required");
  const wrongProof = second.cookie.split("=")[0] + "=" + "a".repeat(43);
  assert.equal(location(await finish(second.link, wrongProof)).searchParams.get("error"), "invalid-token");
  assert.equal(tenantCreations, 0);
  const completed = await Promise.all([finish(second.link, second.cookie), finish(second.link, second.cookie)]);
  assert.deepEqual(completed.map((res) => location(res).pathname).sort(), ["/auth/finalize", "/auth/sign-in"]);
  assert.equal(tenantCreations, 1);
  assert.equal(location(await finish(first.link, first.cookie)).searchParams.get("error"), "invalid-token");
  const installed = await getPasswordHashByEmail(verifiedEmail);
  assert.ok(installed);
  assert.equal(await verifyPassword(secondPassword, installed), true);
  assert.equal(await verifyPassword(firstPassword, installed), false);
  assert.equal((await pool.query("SELECT user_email FROM app_workspaces WHERE user_email = $1", [verifiedEmail])).rowCount, 1);

  for (const email of ["established@example.invalid", "blocked@example.invalid"]) {
    const attempt = await start(email, secondPassword);
    assert.equal(location(await finish(attempt.link, attempt.cookie)).searchParams.get("error"), "invalid-token");
    assert.equal(await getPasswordHashByEmail(email), "legacy");
  }

  const legacy = new URL(origin + "/api/auth/email/verify");
  legacy.searchParams.set("token", signToken({
    type: "email-verify", jti: randomUUID(), email: "legacy@example.invalid", origin, mode: "signup",
  }, 60));
  assert.equal(location(await finish(legacy.toString())).pathname, "/auth/finalize");
  assert.equal(await getPasswordHashByEmail("legacy@example.invalid"), null);

  const expired = await start("expired@example.invalid", secondPassword);
  await pool.query("UPDATE app_pending_password_registrations SET expires_at = NOW() WHERE email = 'expired@example.invalid'");
  assert.equal(location(await finish(expired.link, expired.cookie)).searchParams.get("error"), "invalid-token");
  assert.equal(await getPasswordHashByEmail("expired@example.invalid"), null);
});
