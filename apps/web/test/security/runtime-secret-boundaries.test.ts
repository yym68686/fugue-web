import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("session, rate-limit and seal keys have independent production boundaries", async () => {
  const [authEnvironment, instrumentation, rateLimit, seal] = await Promise.all([
    readFile(path.join(root, "lib/auth/env.ts"), "utf8"),
    readFile(path.join(root, "instrumentation.ts"), "utf8"),
    readFile(path.join(root, "lib/auth/rate-limit.ts"), "utf8"),
    readFile(path.join(root, "lib/security/seal.ts"), "utf8"),
  ]);

  assert.doesNotMatch(
    authEnvironment,
    /createHash|GOOGLE_CLIENT_SECRET[\s\S]*RESEND_API_KEY[\s\S]*digest/,
  );
  assert.doesNotMatch(
    rateLimit,
    /AUTH_RATE_LIMIT_SECRET\?\.trim\(\)\s*\|\|\s*process\.env\.AUTH_SESSION_SECRET/,
  );
  assert.doesNotMatch(seal, /AUTH_SESSION_SECRET|GOOGLE_CLIENT_SECRET|RESEND_API_KEY/);
  assert.match(seal, /CURRENT_SEAL_VERSION = "v2"/);
  assert.match(seal, /WORKSPACE_STORE_PREVIOUS_KEYS/);
  assert.match(seal, /resealTextIfNeeded/);
  assert.match(instrumentation, /validateAuthRateLimitConfiguration/);
});

test("production rate limiting fails closed for missing or weak independent keys", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecret = process.env.AUTH_RATE_LIMIT_SECRET;

  try {
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.AUTH_RATE_LIMIT_SECRET;
    const { validateAuthRateLimitConfiguration } = await import(
      "../../lib/auth/rate-limit"
    );
    assert.throws(
      validateAuthRateLimitConfiguration,
      /AUTH_RATE_LIMIT_SECRET is required/,
    );

    process.env.AUTH_RATE_LIMIT_SECRET = "too-short";
    assert.throws(validateAuthRateLimitConfiguration, /at least 32 characters/);

    process.env.AUTH_RATE_LIMIT_SECRET =
      "independent-production-rate-limit-secret-value";
    assert.doesNotThrow(validateAuthRateLimitConfiguration);
  } finally {
    if (previousNodeEnv === undefined) {
      Reflect.deleteProperty(process.env, "NODE_ENV");
    } else {
      Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
    }

    if (previousSecret === undefined) {
      delete process.env.AUTH_RATE_LIMIT_SECRET;
    } else {
      process.env.AUTH_RATE_LIMIT_SECRET = previousSecret;
    }
  }
});
