import assert from "node:assert/strict";
import test from "node:test";

import { listTenantBillingSummaries } from "@/lib/fugue/console";

test("billing snapshot accounts for every requested tenant", async (t) => {
  const original = process.env.FUGUE_BOOTSTRAP_KEY;
  process.env.FUGUE_BOOTSTRAP_KEY = "synthetic-test-key";
  t.after(() => {
    if (original === undefined) delete process.env.FUGUE_BOOTSTRAP_KEY;
    else process.env.FUGUE_BOOTSTRAP_KEY = original;
  });
  let payload: unknown = { billings: [{ tenant_id: "a", app_count: 0 }], missing_tenant_ids: ["b"] };
  t.mock.method(globalThis, "fetch", async () => Response.json(payload));
  const snapshot = await listTenantBillingSummaries(["a", " b ", "a"]);
  assert.equal(snapshot.billings.length, 1);
  assert.equal(snapshot.billings[0].app_count, 0);
  assert.deepEqual(snapshot.missingTenantIds, ["b"]);
  for (const invalid of [
    { billings: [], missing_tenant_ids: [] },
    { billings: [{ tenant_id: "a", app_count: 1 }], missing_tenant_ids: ["a", "b"] },
    { billings: [{ tenant_id: "foreign", app_count: 1 }], missing_tenant_ids: ["b"] },
    { billings: [{ tenant_id: "a" }] },
    { billings: [{ tenant_id: "a" }], missing_tenant_ids: ["b"] },
    { billings: [{ tenant_id: "a", app_count: -1 }], missing_tenant_ids: ["b"] },
    { billings: [{ tenant_id: "a", app_count: 1.5 }], missing_tenant_ids: ["b"] },
  ]) {
    payload = invalid;
    await assert.rejects(listTenantBillingSummaries(["a", "b"]));
  }
});
