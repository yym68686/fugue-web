import { defineConfig, devices } from "@playwright/test";

const WEB_SERVER_ENV_ALLOW_LIST = [
  "BUN_INSTALL",
  "CI",
  "FORCE_COLOR",
  "HOME",
  "LANG",
  "LC_ALL",
  "NODE_OPTIONS",
  "NO_COLOR",
  "PATH",
  "RUNNER_TEMP",
  "SHELL",
  "TERM",
  "TMPDIR",
  "USER",
  "XDG_CACHE_HOME",
] as const;

function readAllowedWebServerEnvironment() {
  const environment: Record<string, string> = {};

  for (const name of WEB_SERVER_ENV_ALLOW_LIST) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }

  return environment;
}

const port = Number(process.env.PLAYWRIGHT_PORT ?? "3100");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const startsLocalServer = !process.env.PLAYWRIGHT_BASE_URL;
const testDatabaseUrl =
  process.env.PLAYWRIGHT_DATABASE_URL?.trim() ||
  process.env.TEST_DATABASE_URL?.trim() ||
  "";
const authSessionSecret =
  process.env.PLAYWRIGHT_AUTH_SESSION_SECRET ??
  "playwright-session-secret-32-characters-minimum";
const authRateLimitSecret =
  process.env.PLAYWRIGHT_AUTH_RATE_LIMIT_SECRET ??
  "playwright-rate-limit-secret-32-characters";
const workspaceStoreSecret =
  process.env.PLAYWRIGHT_WORKSPACE_STORE_SECRET ??
  "playwright-workspace-seal-key-32-characters";
const workspaceStoreKeyId =
  process.env.PLAYWRIGHT_WORKSPACE_STORE_KEY_ID ?? "playwright-v1";
const playwrightControlPlaneUrl =
  process.env.PLAYWRIGHT_FUGUE_API_URL?.trim() || "http://127.0.0.1:9";
const playwrightBootstrapKey =
  process.env.PLAYWRIGHT_FUGUE_BOOTSTRAP_KEY?.trim() || "playwright-bootstrap-key";

process.env.AUTH_SESSION_SECRET = authSessionSecret;
process.env.AUTH_RATE_LIMIT_SECRET = authRateLimitSecret;
process.env.WORKSPACE_STORE_SECRET = workspaceStoreSecret;
process.env.WORKSPACE_STORE_KEY_ID = workspaceStoreKeyId;
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  testDir: "./test/browser",
  globalSetup: "./test/browser/global-setup.ts",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  expect: {
    timeout: 10_000,
  },
  timeout: 45_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  webServer: startsLocalServer
    ? {
        command: `bun run build && bun run start -- --hostname 127.0.0.1 --port ${port}`,
        url: `${baseURL}/healthz`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...readAllowedWebServerEnvironment(),
          NEXT_TELEMETRY_DISABLED: "1",
          APP_BASE_URL: baseURL,
          APP_PUBLIC_URL: baseURL,
          NEXT_PUBLIC_APP_BASE_URL: baseURL,
          CANONICAL_HOST_TRUST_PROXY_HEADERS: "true",
          AUTH_TRUST_PROXY_HEADERS: "false",
          AUTH_TRUSTED_PROXY_HOPS: "1",
          EMAIL_VERIFICATION_REQUIRED: "true",
          GOOGLE_CLIENT_ID:
            process.env.PLAYWRIGHT_GOOGLE_CLIENT_ID ?? "playwright-google-client-id",
          GOOGLE_CLIENT_SECRET:
            process.env.PLAYWRIGHT_GOOGLE_CLIENT_SECRET ??
            "playwright-google-client-secret",
          GOOGLE_REDIRECT_URI:
            process.env.PLAYWRIGHT_GOOGLE_REDIRECT_URI ??
            `${baseURL}/api/auth/google/callback`,
          RESEND_API_KEY:
            process.env.PLAYWRIGHT_RESEND_API_KEY ?? "playwright-resend-api-key",
          RESEND_FROM_EMAIL:
            process.env.PLAYWRIGHT_RESEND_FROM_EMAIL ??
            "Fugue Playwright <noreply@example.test>",
          GITHUB_AUTH_CLIENT_ID:
            process.env.PLAYWRIGHT_GITHUB_AUTH_CLIENT_ID ??
            "playwright-github-auth-client-id",
          GITHUB_AUTH_CLIENT_SECRET:
            process.env.PLAYWRIGHT_GITHUB_AUTH_CLIENT_SECRET ??
            "playwright-github-auth-client-secret",
          GITHUB_AUTH_REDIRECT_URI:
            process.env.PLAYWRIGHT_GITHUB_AUTH_REDIRECT_URI ??
            `${baseURL}/api/auth/github/callback`,
          GITHUB_AUTH_SCOPE: "read:user user:email",
          GITHUB_OAUTH_CLIENT_ID:
            process.env.PLAYWRIGHT_GITHUB_OAUTH_CLIENT_ID ??
            "playwright-github-oauth-client-id",
          GITHUB_OAUTH_CLIENT_SECRET:
            process.env.PLAYWRIGHT_GITHUB_OAUTH_CLIENT_SECRET ??
            "playwright-github-oauth-client-secret",
          GITHUB_OAUTH_REDIRECT_URI:
            process.env.PLAYWRIGHT_GITHUB_OAUTH_REDIRECT_URI ??
            `${baseURL}/api/github/app/install/callback`,
          GITHUB_OAUTH_SCOPE: "repo",
          GITHUB_APP_ID: "1",
          GITHUB_APP_INSTALL_URL:
            "https://github.com/apps/playwright-fugue/installations/new",
          GITHUB_APP_SLUG: "playwright-fugue",
          GITHUB_APP_WEBHOOK_SECRET: "playwright-github-app-webhook-secret",
          CREEM_API_KEY: "playwright-creem-api-key",
          CREEM_PRODUCT_ID: "playwright-creem-product-id",
          CREEM_WEBHOOK_SECRET: "playwright-creem-webhook-secret",
          FUGUE_API_URL: playwrightControlPlaneUrl,
          FUGUE_API_INTERNAL_URL: playwrightControlPlaneUrl,
          FUGUE_BOOTSTRAP_KEY: playwrightBootstrapKey,
          FUGUE_ADMIN_BOOTSTRAP_EMAIL: "",
          AUTH_SESSION_SECRET: authSessionSecret,
          AUTH_RATE_LIMIT_SECRET: authRateLimitSecret,
          WORKSPACE_STORE_SECRET: workspaceStoreSecret,
          WORKSPACE_STORE_KEY_ID: workspaceStoreKeyId,
          WORKSPACE_STORE_PREVIOUS_KEYS: "",
          ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}),
        },
      }
    : undefined,
  projects: [
    {
      name: "chromium-desktop",
      testMatch: /.*\.e2e\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      testMatch: /.*\.e2e\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "firefox-desktop",
      testMatch: /.*\.e2e\.spec\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-desktop",
      testMatch: /.*\.e2e\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "webkit-mobile",
      testMatch: /.*\.e2e\.spec\.ts/,
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "chromium-a11y",
      testMatch: /.*\.a11y\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
