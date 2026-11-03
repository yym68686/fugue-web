import assert from "node:assert/strict";
import { test } from "node:test";
import { patchApp } from "@/lib/fugue/console";
import { fugueApiEnv } from "./fixtures/fugue-api-env";

fugueApiEnv();

test("node loss updates preserve explicit zero and do not add availability resources", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests++;
    assert.equal(new URL(url).pathname, "/v1/apps/app_example");
    assert.equal(init.method, "PATCH");
    assert.deepEqual(JSON.parse(String(init.body)), { node_loss: { mode: "replace", toleration_seconds: 0 } });
    return Response.json({ operation: { id: "op_example", status: "pending" } });
  });
  await patchApp("synthetic-key", "app_example", { node_loss: { mode: "replace", toleration_seconds: 0 } });
  assert.equal(requests, 1);
});

test("rejected lifecycle changes propagate failure instead of displaying success", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "policy deployment blocked" }, { status: 409 }));
  await assert.rejects(patchApp("synthetic-key", "app_example", { node_loss: { mode: "wait" } }), { status: 409 });
});
