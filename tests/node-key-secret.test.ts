import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { Pool } from "pg";
import {
  persistManagedNodeKey,
  revokeManagedNodeKey,
} from "@/lib/workspace/store";
import {
  readNodeKeySecret,
  syncNodeKeyMetadata,
} from "@/lib/servers/node-keys";
import { sealText, unsealText } from "@/lib/security/seal";

function database(t: TestContext, rows: unknown[] = []) {
  const oldPool = globalThis.__fuguePgPool;
  const oldSecret = process.env.WORKSPACE_STORE_SECRET;
  process.env.WORKSPACE_STORE_SECRET = "synthetic-server-secret-storage-key";
  const queries: { sql: string; values: unknown[] }[] = [];
  globalThis.__fuguePgPool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[]) => {
        queries.push({ sql, values });
        return { rows, rowCount: rows.length };
      },
      release() {},
    }),
  } as unknown as Pool;
  t.after(() => {
    globalThis.__fuguePgPool = oldPool;
    if (oldSecret === undefined) delete process.env.WORKSPACE_STORE_SECRET;
    else process.env.WORKSPACE_STORE_SECRET = oldSecret;
  });
  return queries;
}

test("new node credentials are encrypted and explicit copy is owner/tenant scoped", async (t) => {
  const rows: unknown[] = [];
  const queries = database(t, rows);
  await persistManagedNodeKey({
    email: "Owner@Example.test",
    secret: "synthetic-node-secret",
    key: {
      id: "nodekey",
      tenantId: "tenant",
      label: "Fixture",
      prefix: "test",
      createdAt: null,
    },
  });
  assert.equal(queries[0].values.includes("synthetic-node-secret"), false);
  assert.equal(
    unsealText(queries[0].values[7] as string),
    "synthetic-node-secret",
  );
  rows.push({ secret_sealed: sealText("synthetic-node-secret") });
  assert.deepEqual(
    await readNodeKeySecret("Owner@Example.test", "tenant", "nodekey"),
    { found: true, secret: "synthetic-node-secret" },
  );
  assert.deepEqual(queries[1].values, [
    "nodekey",
    "owner@example.test",
    "tenant",
  ]);
  assert.match(
    queries[1].sql,
    /user_email = \$2 AND tenant_id = \$3 AND status = 'active'/,
  );
});

test("legacy node secrets cannot be fabricated and revoked keys erase ciphertext", async (t) => {
  const queries = database(t, [{ secret_sealed: null }]);
  assert.deepEqual(
    await readNodeKeySecret("owner@example.test", "tenant", "nodekey"),
    { found: true, secret: null },
  );
  await revokeManagedNodeKey({
    email: "owner@example.test",
    nodeKeyId: "nodekey",
  });
  assert.match(queries[1].sql, /secret_sealed = NULL/);
});

test("metadata sync preserves local labels, deletion and revocation boundaries", async (t) => {
  const queries = database(t);
  const key = {
    id: "nodekey",
    tenant_id: "tenant",
    label: "Fixture",
    prefix: "test",
    scope: "tenant-runtime",
    status: "active",
    created_at: null,
    updated_at: null,
    last_used_at: "2026-10-11T02:58:06Z",
    revoked_at: null,
  };
  await syncNodeKeyMetadata("Owner@Example.test", "tenant", [
    key,
    { ...key, id: "foreign", tenant_id: "other" },
  ]);
  const { sql, values } = queries[0];
  assert.equal(values[0], "owner@example.test");
  assert.equal(values[1], "tenant");
  assert.equal(JSON.parse(values[2] as string).length, 1);
  assert.doesNotMatch(sql, /INSERT|label_override\s*=/i);
  assert.match(sql, /WHEN local.status = 'revoked' THEN 'revoked'/);
  assert.match(sql, /local.user_email = \$1 AND local.tenant_id = \$2/);
});
