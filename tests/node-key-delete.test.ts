import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { Pool } from "pg";

import { deleteOwnedNodeKey } from "@/lib/console/delete-node-key";

const input = { email: "Owner@Example.com", nodeKeyId: "nodekey_fixture", adminKeySecret: "synthetic-test-key" };

function databaseFixture(t: TestContext) {
  const queries: { sql: string; values: unknown[] }[] = [];
  const previous = globalThis.__fuguePgPool;
  globalThis.__fuguePgPool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[]) => {
        queries.push({ sql, values });
        return { rows: [], rowCount: 1 };
      },
      release: () => {},
    }),
  } as unknown as Pool;
  t.after(() => { globalThis.__fuguePgPool = previous; });
  return queries;
}

test("deletion revokes upstream before removing the caller's mirror", async (t) => {
  const queries = databaseFixture(t);
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(queries.length, 0);
    assert.equal(new URL(url).pathname, "/v1/node-keys/nodekey_fixture/revoke");
    assert.equal(init.method, "POST");
    return Response.json({ node_key: { id: input.nodeKeyId, status: "revoked" }, cleanup: {} });
  });
  await deleteOwnedNodeKey(input);
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /status = 'revoked'/);
  assert.match(queries[1].sql, /DELETE FROM app_node_keys WHERE fugue_node_key_id = \$1 AND user_email = \$2/);
  assert.deepEqual(queries[1].values, [input.nodeKeyId, "owner@example.com"]);
});

for (const status of [403, 404, 503]) {
  test(`upstream ${status} preserves the local key and propagates failure`, async (t) => {
    const queries = databaseFixture(t);
    t.mock.method(globalThis, "fetch", async () => Response.json({ error: "fixture failure" }, { status }));
    await assert.rejects(deleteOwnedNodeKey(input), { status });
    assert.equal(queries.length, 0);
  });
}

test("cleanup warnings retain a revoked row and retry completes cleanup before deletion", async (t) => {
  const queries = databaseFixture(t);
  let attempts = 0;
  t.mock.method(globalThis, "fetch", async () => Response.json({
    node_key: { id: input.nodeKeyId, status: "revoked" },
    cleanup: { warnings: attempts++ === 0 ? ["runtime cleanup failed"] : [] },
  }));
  await assert.rejects(deleteOwnedNodeKey(input), { status: 409 });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /status = 'revoked'/);
  await deleteOwnedNodeKey(input);
  assert.equal(queries.length, 3);
  assert.match(queries[2].sql, /DELETE FROM/);
});

test("unverified revocation cannot delete a key", async (t) => {
  const queries = databaseFixture(t);
  for (const node_key of [undefined, { id: input.nodeKeyId, status: "active" }, { id: "another-key", status: "revoked" }]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ node_key }));
    await assert.rejects(deleteOwnedNodeKey(input), { status: 502 });
  }
  assert.equal(queries.length, 0);
});

test("missing cleanup evidence preserves the revoked mirror", async (t) => {
  const queries = databaseFixture(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ node_key: { id: input.nodeKeyId, status: "revoked" } }));
  await assert.rejects(deleteOwnedNodeKey(input), { status: 502 });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /status = 'revoked'/);
});

test("failed mirror deletion can be retried without reactivating the key", async (t) => {
  const queries = databaseFixture(t);
  const pool = globalThis.__fuguePgPool!;
  const originalConnect = pool.connect.bind(pool);
  let fail = true;
  t.mock.method(pool, "connect", async () => {
    const client = await originalConnect();
    const originalQuery = client.query.bind(client);
    client.query = (async (sql: string, values: unknown[]) => {
      if (sql.startsWith("DELETE") && fail) { fail = false; throw new Error("database unavailable"); }
      return originalQuery(sql, values);
    }) as typeof client.query;
    return client;
  });
  t.mock.method(globalThis, "fetch", async () => Response.json({ node_key: { id: input.nodeKeyId, status: "revoked" }, cleanup: {} }));
  await assert.rejects(deleteOwnedNodeKey(input), /database unavailable/);
  await deleteOwnedNodeKey(input);
  assert.equal(queries.length, 3);
  assert.match(queries[2].sql, /DELETE FROM/);
});
