import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("Playwright passes only an explicit process-environment allow-list to its server", async () => {
  const config = await readFile(path.join(webRoot, "playwright.config.ts"), "utf8");

  assert.doesNotMatch(config, /\.\.\.process\.env/);
  assert.match(config, /WEB_SERVER_ENV_ALLOW_LIST/);
  assert.match(config, /readAllowedWebServerEnvironment\(\)/);

  for (const productionVariable of [
    "process.env.FUGUE_API_URL",
    "process.env.FUGUE_API_INTERNAL_URL",
    "process.env.FUGUE_BOOTSTRAP_KEY",
    "process.env.GOOGLE_CLIENT_ID",
    "process.env.GOOGLE_CLIENT_SECRET",
    "process.env.GOOGLE_REDIRECT_URI",
    "process.env.GITHUB_AUTH_CLIENT_ID",
    "process.env.GITHUB_AUTH_CLIENT_SECRET",
    "process.env.GITHUB_AUTH_REDIRECT_URI",
    "process.env.GITHUB_OAUTH_CLIENT_ID",
    "process.env.GITHUB_OAUTH_CLIENT_SECRET",
    "process.env.GITHUB_OAUTH_REDIRECT_URI",
    "process.env.GITHUB_APP_ID",
    "process.env.GITHUB_APP_WEBHOOK_SECRET",
    "process.env.CREEM_API_KEY",
    "process.env.CREEM_PRODUCT_ID",
    "process.env.CREEM_WEBHOOK_SECRET",
    "process.env.RESEND_API_KEY",
    "process.env.RESEND_FROM_EMAIL",
    "process.env.WORKSPACE_STORE_PREVIOUS_KEYS",
  ]) {
    assert.doesNotMatch(config, new RegExp(productionVariable.replaceAll(".", "\\.")));
  }

  assert.doesNotMatch(
    config,
    /const authSessionSecret\s*=\s*process\.env\.AUTH_SESSION_SECRET/,
  );
  assert.doesNotMatch(
    config,
    /const authRateLimitSecret\s*=\s*process\.env\.AUTH_RATE_LIMIT_SECRET/,
  );
  assert.doesNotMatch(
    config,
    /const workspaceStoreSecret\s*=\s*process\.env\.WORKSPACE_STORE_SECRET/,
  );
  assert.doesNotMatch(
    config,
    /const workspaceStoreKeyId\s*=\s*process\.env\.WORKSPACE_STORE_KEY_ID/,
  );

  assert.match(config, /process\.env\.PLAYWRIGHT_FUGUE_API_URL/);
  assert.match(config, /process\.env\.PLAYWRIGHT_FUGUE_BOOTSTRAP_KEY/);
  assert.match(config, /process\.env\.PLAYWRIGHT_GITHUB_AUTH_CLIENT_SECRET/);
  assert.match(config, /process\.env\.PLAYWRIGHT_GITHUB_OAUTH_CLIENT_SECRET/);
  assert.match(config, /process\.env\.PLAYWRIGHT_AUTH_SESSION_SECRET/);
  assert.match(config, /process\.env\.PLAYWRIGHT_AUTH_RATE_LIMIT_SECRET/);
  assert.match(config, /process\.env\.PLAYWRIGHT_WORKSPACE_STORE_SECRET/);
  assert.match(config, /FUGUE_API_URL: playwrightControlPlaneUrl/);
  assert.match(config, /FUGUE_API_INTERNAL_URL: playwrightControlPlaneUrl/);
  assert.match(config, /FUGUE_BOOTSTRAP_KEY: playwrightBootstrapKey/);
  assert.match(config, /WORKSPACE_STORE_PREVIOUS_KEYS: ""/);
  assert.match(config, /CANONICAL_HOST_TRUST_PROXY_HEADERS: "true"/);
  assert.match(config, /AUTH_TRUST_PROXY_HEADERS: "false"/);
  assert.match(config, /"http:\/\/127\.0\.0\.1:9"/);
});

test("resolved Playwright server environment drops generic secret sentinels", async () => {
  const sentinels = {
    AUTH_SESSION_SECRET: "production-auth-session-sentinel",
    CREEM_API_KEY: "production-creem-sentinel",
    FUGUE_BOOTSTRAP_KEY: "production-fugue-key-sentinel",
    GITHUB_AUTH_CLIENT_SECRET: "production-github-auth-sentinel",
    GITHUB_OAUTH_CLIENT_SECRET: "production-github-oauth-sentinel",
    GOOGLE_CLIENT_SECRET: "production-google-sentinel",
    RESEND_API_KEY: "production-resend-sentinel",
    WORKSPACE_STORE_SECRET: "production-workspace-sentinel",
  };
  const previous = new Map(
    [...Object.keys(sentinels), "PLAYWRIGHT_BASE_URL"].map((name) => [
      name,
      process.env[name],
    ]),
  );

  try {
    delete process.env.PLAYWRIGHT_BASE_URL;
    Object.assign(process.env, sentinels);
    const configUrl = pathToFileURL(path.join(webRoot, "playwright.config.ts"));
    configUrl.searchParams.set("isolation", String(Date.now()));
    const resolved = (await import(configUrl.href)).default;
    const server = Array.isArray(resolved.webServer)
      ? resolved.webServer[0]
      : resolved.webServer;

    assert.ok(server?.env, "the local Playwright server environment must exist");
    const values = new Set(Object.values(server.env));
    for (const sentinel of Object.values(sentinels)) {
      assert.equal(
        values.has(sentinel),
        false,
        `${sentinel} leaked into webServer.env`,
      );
    }
    assert.equal(server.env.FUGUE_API_URL, "http://127.0.0.1:9");
    assert.equal(server.env.CANONICAL_HOST_TRUST_PROXY_HEADERS, "true");
    assert.equal(server.env.AUTH_TRUST_PROXY_HEADERS, "false");
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
