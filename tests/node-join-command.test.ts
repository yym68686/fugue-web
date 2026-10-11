import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { buildNodeJoinCommand, createNodeKey } from "@/lib/fugue/console";

const internalBase = "http://fugue-fugue.fugue-system.svc.cluster.local.";
const secret = "synthetic-node-key";

function configureEndpoints(t: TestContext, publicBase: string | undefined, internal: string | undefined) {
  for (const [name, value] of Object.entries({
    FUGUE_API_URL: publicBase,
    FUGUE_INTERNAL_API_URL: internal,
  })) {
    const previous = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
}

test("node enrollment uses the internal API but the VPS command uses the public API", async (t) => {
  configureEndpoints(t, "https://api.fugue.pro", internalBase);
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests++;
    assert.equal(url, `${internalBase}/v1/node-keys`);
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body as string), {
      label: "fixture-node", tenant_id: "fixture-tenant", scope: "tenant-runtime",
    });
    return Response.json({ node_key: { id: "fixture-node-key" }, secret });
  });

  const created = await createNodeKey("synthetic-admin-key", {
    label: "fixture-node", tenantId: "fixture-tenant",
  });
  assert.equal(requests, 1);
  assert.equal(
    buildNodeJoinCommand(created.secret!),
    `curl -fsSL https://api.fugue.pro/install/join-cluster.sh | sudo FUGUE_NODE_KEY='${secret}' bash`,
  );
});

test("self-hosted commands preserve the configured public path and normalize trailing slashes", (t) => {
  configureEndpoints(t, "  https://control.example.test/fugue///  ", internalBase);
  assert.equal(
    buildNodeJoinCommand(secret),
    `curl -fsSL https://control.example.test/fugue/install/join-cluster.sh | sudo FUGUE_NODE_KEY='${secret}' bash`,
  );
});

test("enrollment and commands still work when only the public API is configured", async (t) => {
  configureEndpoints(t, "https://control.example.test/", undefined);
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "https://control.example.test/v1/node-keys");
    return Response.json({ node_key: { id: "fixture-node-key" }, secret });
  });
  const created = await createNodeKey("synthetic-admin-key", {
    label: "fixture-node", tenantId: "fixture-tenant",
  });
  assert.equal(
    buildNodeJoinCommand(created.secret!),
    `curl -fsSL https://control.example.test/install/join-cluster.sh | sudo FUGUE_NODE_KEY='${secret}' bash`,
  );
});

for (const publicBase of [undefined, "", "   "]) {
  test(`a ${JSON.stringify(publicBase)} public API never falls back to the cluster address`, (t) => {
    configureEndpoints(t, publicBase, internalBase);
    assert.throws(() => buildNodeJoinCommand(secret), /Missing FUGUE_API_URL/);
  });
}
