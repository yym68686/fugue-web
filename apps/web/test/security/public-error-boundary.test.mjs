import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_ERROR_FALLBACK,
  PUBLIC_ERROR_MAX_LENGTH,
  PUBLIC_SERVER_ERROR,
  sanitizePublicErrorMessage,
} from "../../lib/security/public-error.mjs";
import { scanSecretOutput } from "../../../../scripts/quality/secret-output-scan.mjs";

const positiveFixture = new URL(
  "../../../../scripts/quality/fixtures/secret-output-positive.txt",
  import.meta.url,
);
const redactedNegativeFixture = new URL(
  "../../../../scripts/quality/fixtures/secret-output-redacted-negative.txt",
  import.meta.url,
);
const secretOutputGate = fileURLToPath(
  new URL("../../../../scripts/quality/secret-output-gate.mjs", import.meta.url),
);
const recoveryCommand = fileURLToPath(
  new URL("../../scripts/recover-fugue-admin.mjs", import.meta.url),
);

test("public errors fail closed for unknown and server failures", () => {
  const secret = "Bearer topsecret-token-value-1234567890";

  assert.equal(sanitizePublicErrorMessage(secret), PUBLIC_ERROR_FALLBACK);
  assert.equal(sanitizePublicErrorMessage(secret, 500), PUBLIC_SERVER_ERROR);
  assert.equal(sanitizePublicErrorMessage(secret, 503), PUBLIC_SERVER_ERROR);
});

test("bounded 4xx errors redact credentials without erasing safe context", () => {
  const raw = [
    "Invalid deployment configuration.",
    "Authorization: Bearer topsecret-token-value-1234567890",
    "dsn=postgresql://fugue:database-password@db.internal/fugue",
    "https://user:password@example.test/path?access_token=query-token-value-1234567890",
    "Cookie: session=browser-cookie-value",
    "api_key=sk-api-key-value-12345678901234567890",
    "eyJhbGciOiJIUzI1NiJ9.c2Vzc2lvbi1wYXlsb2Fk.c2lnbmF0dXJlLXZhbHVl",
    "-----BEGIN PRIVATE KEY----- private-key-material -----END PRIVATE KEY-----",
    "x".repeat(500),
  ].join("\n");
  const message = sanitizePublicErrorMessage(raw, 422);

  assert.match(message, /^Invalid deployment configuration\./);
  assert.ok(Array.from(message).length <= PUBLIC_ERROR_MAX_LENGTH);
  assert.equal(scanSecretOutput(message).total, 0);
  assert.doesNotMatch(
    message,
    /topsecret|database-password|query-token|browser-cookie/u,
  );
  assert.match(message, /\[redacted/u);
});

test("secret output fixtures detect plaintext and accept redacted output", async () => {
  const [positive, redactedNegative] = await Promise.all([
    readFile(positiveFixture, "utf8"),
    readFile(redactedNegativeFixture, "utf8"),
  ]);

  assert.ok(scanSecretOutput(positive).total >= 6);
  assert.equal(scanSecretOutput(redactedNegative).total, 0);
});

test("secret output command gate preserves a clean child exit code", () => {
  const result = spawnSync(
    process.execPath,
    [
      secretOutputGate,
      "--",
      process.execPath,
      "-e",
      'process.stderr.write("expected failure\\n"); process.exit(17)',
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 17);
  assert.equal(result.stderr, "expected failure\n");
});

test("secret output command gate blocks findings without replaying them", () => {
  const secret = "Bearer topsecret-token-value-1234567890";
  const result = spawnSync(
    process.execPath,
    [
      secretOutputGate,
      "--",
      process.execPath,
      "-e",
      `process.stdout.write(${JSON.stringify(secret)})`,
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /topsecret-token/u);
  assert.match(result.stderr, /Secret output gate blocked/u);
});

test("admin recovery keeps internal database failures out of stderr", () => {
  const result = spawnSync(
    process.execPath,
    [recoveryCommand, "--email=admin@example.com", "--confirm=RECOVER_FUGUE_ADMIN"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://admin:recovery-database-secret@127.0.0.1:1/fugue",
        PGCONNECT_TIMEOUT: "1",
      },
      timeout: 5_000,
    },
  );

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), PUBLIC_SERVER_ERROR);
  assert.doesNotMatch(result.stderr, /recovery-database-secret/u);
});
