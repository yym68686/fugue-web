import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import test from "node:test";

import {
  resealTextIfNeeded,
  sealText,
  unsealText,
  unsealTextWithMetadata,
  validateSealConfiguration,
} from "../../lib/security/seal";

const trackedEnvironment = [
  "NODE_ENV",
  "WORKSPACE_STORE_KEY_ID",
  "WORKSPACE_STORE_PREVIOUS_KEYS",
  "WORKSPACE_STORE_SECRET",
] as const;

async function withEnvironment(
  values: Partial<Record<(typeof trackedEnvironment)[number], string | undefined>>,
  run: () => void | Promise<void>,
) {
  const previous = Object.fromEntries(
    trackedEnvironment.map((name) => [name, process.env[name]]),
  );
  for (const name of trackedEnvironment) {
    const value = values[name];
    if (value === undefined) Reflect.deleteProperty(process.env, name);
    else Reflect.set(process.env, name, value);
  }
  try {
    await run();
  } finally {
    for (const name of trackedEnvironment) {
      const value = previous[name];
      if (value === undefined) Reflect.deleteProperty(process.env, name);
      else Reflect.set(process.env, name, value);
    }
  }
}

function legacySeal(value: string, secret: string): string {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

test("new ciphertext records its active key id", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      WORKSPACE_STORE_KEY_ID: "key-2026-07",
      WORKSPACE_STORE_SECRET: "active-test-secret-with-at-least-thirty-two-characters",
    },
    () => {
      const payload = sealText("sensitive-value");
      assert.match(payload, /^v2\.key-2026-07\./);
      assert.equal(unsealText(payload), "sensitive-value");
      assert.deepEqual(unsealTextWithMetadata(payload), {
        keyId: "key-2026-07",
        needsReseal: false,
        value: "sensitive-value",
      });
    },
  );
});

test("previous v2 and legacy v1 keys remain readable and are re-encrypted", async () => {
  const oldSecret = "previous-test-secret-with-at-least-thirty-two-characters";
  let oldV2 = "";

  await withEnvironment(
    {
      NODE_ENV: "production",
      WORKSPACE_STORE_KEY_ID: "old-key",
      WORKSPACE_STORE_SECRET: oldSecret,
    },
    () => {
      oldV2 = sealText("rotate-me");
    },
  );

  await withEnvironment(
    {
      NODE_ENV: "production",
      WORKSPACE_STORE_KEY_ID: "new-key",
      WORKSPACE_STORE_PREVIOUS_KEYS: JSON.stringify({ "old-key": oldSecret }),
      WORKSPACE_STORE_SECRET: "new-active-secret-with-at-least-thirty-two-characters",
    },
    () => {
      const rotatedV2 = resealTextIfNeeded(oldV2);
      assert.equal(rotatedV2.value, "rotate-me");
      assert.match(rotatedV2.resealed ?? "", /^v2\.new-key\./);

      const rotatedV1 = resealTextIfNeeded(legacySeal("legacy", oldSecret));
      assert.equal(rotatedV1.value, "legacy");
      assert.match(rotatedV1.resealed ?? "", /^v2\.new-key\./);
    },
  );
});

test("production seal configuration fails closed for missing or weak keys", async () => {
  await withEnvironment({ NODE_ENV: "production" }, () => {
    assert.throws(() => validateSealConfiguration(), /Missing WORKSPACE_STORE_SECRET/);
  });
  await withEnvironment(
    { NODE_ENV: "production", WORKSPACE_STORE_SECRET: "short" },
    () => {
      assert.throws(() => validateSealConfiguration(), /at least 32 characters/);
    },
  );
});
