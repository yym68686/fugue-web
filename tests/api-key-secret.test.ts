import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { Pool } from "pg";

import { getApiKeySecretForUser, persistManagedApiKey, updateManagedApiKeyStatus } from "@/lib/workspace/store";
import { sealText, unsealText } from "@/lib/security/seal";

function databaseFixture(t: TestContext, rows: { secret_sealed: string | null }[] = []) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const previous = globalThis.__fuguePgPool;
  const previousSecret = process.env.WORKSPACE_STORE_SECRET;
  process.env.WORKSPACE_STORE_SECRET = "synthetic-api-key-copy-test-seal-secret";
  globalThis.__fuguePgPool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[]) => {
        queries.push({ sql, values });
        return { rows, rowCount: rows.length };
      },
      release: () => {},
    }),
  } as unknown as Pool;
  t.after(() => {
    globalThis.__fuguePgPool = previous;
    if (previousSecret === undefined) delete process.env.WORKSPACE_STORE_SECRET;
    else process.env.WORKSPACE_STORE_SECRET = previousSecret;
  });
  return queries;
}

test("new keys persist an encrypted, recoverable secret instead of plaintext", async (t) => {
  const queries = databaseFixture(t);
  const secret = "synthetic-full-api-key";
  await persistManagedApiKey({
    email: "Owner@Example.com",
    secret,
    key: { id: "key_fixture", tenantId: "tenant_fixture", label: "Fixture", prefix: "synthetic", scopes: ["app.deploy"], createdAt: null },
  });
  const { sql, values } = queries[0];
  assert.equal(values[1], "owner@example.com");
  assert.equal(values.includes(secret), false);
  assert.equal(unsealText(values[6] as string), secret);
  assert.match(sql, /secret_sealed = EXCLUDED.secret_sealed/);
  assert.match(sql, /\$7, 'active', 'managed'/);
});

test("secret lookup is scoped to the owner and excludes deleted keys", async (t) => {
  const rows: { secret_sealed: string | null }[] = [];
  const queries = databaseFixture(t, rows);
  rows.push({ secret_sealed: sealText("synthetic-full-api-key") });
  assert.deepEqual(await getApiKeySecretForUser("Owner@Example.com", "key_fixture"), {
    found: true, secret: "synthetic-full-api-key",
  });
  assert.deepEqual(queries[0].values, ["key_fixture", "owner@example.com"]);
  assert.match(queries[0].sql, /WHERE fugue_key_id = \$1 AND user_email = \$2 AND status != 'deleted'/);
});

test("unknown or unowned keys return no secret", async (t) => {
  databaseFixture(t);
  assert.deepEqual(await getApiKeySecretForUser("stranger@example.com", "key_fixture"), { found: false, secret: null });
});

test("legacy keys without a saved secret are distinguishable from missing keys", async (t) => {
  databaseFixture(t, [{ secret_sealed: null }]);
  assert.deepEqual(await getApiKeySecretForUser("owner@example.com", "key_fixture"), { found: true, secret: null });
});

test("corrupted encrypted data fails closed", async (t) => {
  databaseFixture(t, [{ secret_sealed: "corrupted" }]);
  await assert.rejects(getApiKeySecretForUser("owner@example.com", "key_fixture"), /Invalid sealed payload/);
});

test("deleting a key erases its saved secret while disabling preserves it", async (t) => {
  const queries = databaseFixture(t);
  for (const status of ["disabled", "active", "deleted"] as const) {
    await updateManagedApiKeyStatus({ email: "Owner@Example.com", fugueKeyId: "key_fixture", status });
  }
  for (const { sql } of queries) {
    assert.match(sql, /secret_sealed = CASE WHEN \$3 = 'deleted' THEN NULL ELSE secret_sealed END/);
    assert.match(sql, /user_email = \$2\s+AND is_workspace_admin = FALSE/);
  }
  assert.deepEqual(queries.map(({ values }) => values[2]), ["disabled", "active", "deleted"]);
});
