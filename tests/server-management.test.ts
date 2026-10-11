import assert from "node:assert/strict";
import { afterEach, beforeEach, test, type TestContext } from "node:test";
import type { Pool } from "pg";
import {
  runtimeView,
  runtimeCapabilities,
  nodeHealth,
  isSelectableRuntime,
  validatePublicOffer,
  type Runtime,
} from "@/lib/servers/model";
import { changeRuntime, type ServerActor } from "@/lib/servers/access";

const runtime: Runtime = {
  id: "runtime-fixture",
  tenant_id: "owner",
  name: "Fixture server",
  type: "managed-owned",
  status: "active",
  cluster_scope: "byovps",
  sharing: "private",
  created_at: "2026-10-11T00:00:00Z",
  updated_at: "2026-10-11T00:00:00Z",
};
const actor: ServerActor = {
  tenantId: "owner",
  email: "owner@example.test",
  key: "synthetic-tenant-key",
  scopes: ["runtime.write"],
  isAdmin: false,
};

let previousApiUrl: string | undefined;
beforeEach(() => {
  previousApiUrl = process.env.FUGUE_API_URL;
  process.env.FUGUE_API_URL = "https://api.example.test";
});
afterEach(() => {
  if (previousApiUrl === undefined) delete process.env.FUGUE_API_URL;
  else process.env.FUGUE_API_URL = previousApiUrl;
});

function backend(t: TestContext, source = runtime) {
  const requests: { url: string; init: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return Response.json({
      runtime: source,
      node_reconciled: false,
      deleted: true,
    });
  });
  return requests;
}

test("visible shared or public servers never inherit owner controls", () => {
  for (const access_mode of ["private", "public", "platform-shared"]) {
    const other = { ...runtime, tenant_id: "another-tenant", access_mode };
    assert.equal(runtimeView(other, actor.tenantId).owned, false);
    assert.deepEqual(runtimeCapabilities(other, { ...actor, isAdmin: true }), {
      sharing: false,
      scope: false,
      delete: false,
    });
  }
});

test("internal membership is exclusive of BYOVPS sharing and owner controls honor scopes", () => {
  const internal = {
    ...runtime,
    cluster_scope: "internal" as const,
    access_mode: "public",
  };
  assert.equal(runtimeView(internal, "owner").sharing, null);
  assert.deepEqual(runtimeCapabilities(internal, { ...actor, isAdmin: true }), {
    sharing: false,
    scope: true,
    delete: false,
  });
  assert.deepEqual(runtimeCapabilities(runtime, { ...actor, scopes: [] }), {
    sharing: false,
    scope: false,
    delete: false,
  });
  assert.equal(
    runtimeCapabilities({ ...runtime, status: "offline" }, actor).delete,
    true,
  );
});

test("runtime projection strips credentials, hashes and arbitrary labels", () => {
  const result = runtimeView(
    {
      ...runtime,
      agent_key_hash: "credential-must-not-leak",
      fingerprint_hash: "fingerprint-must-not-leak",
      labels: {
        private: "label-secret",
        "fugue.io/location-country-code": "us",
      },
    },
    "owner",
  );
  assert.equal(result.country, "US");
  for (const secret of [
    "credential-must-not-leak",
    "fingerprint-must-not-leak",
    "label-secret",
  ])
    assert.equal(JSON.stringify(result).includes(secret), false);
});

test("node readiness requires fresh Ready evidence and absence of pressure", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const node = {
    name: "node",
    status: "ready",
    observed_at: "2026-10-11T11:59:45Z",
    conditions: { Ready: { status: "true" } },
  };
  assert.equal(nodeHealth(node, now), "ready");
  assert.equal(
    nodeHealth({ ...node, observed_at: "2026-10-11T11:00:00Z" }, now),
    "unknown",
  );
  assert.equal(
    nodeHealth({ ...node, observed_at: "2026-10-11T13:00:00Z" }, now),
    "unknown",
  );
  assert.equal(nodeHealth({ ...node, conditions: {} }, now), "unready");
  assert.equal(
    nodeHealth(
      {
        ...node,
        conditions: { ...node.conditions, MemoryPressure: { status: "true" } },
      },
      now,
    ),
    "unready",
  );
  assert.equal(nodeHealth(null, now), "unknown");
  assert.equal(isSelectableRuntime({ status: "offline" }), false);
  assert.equal(isSelectableRuntime({ status: "unknown" }), false);
  assert.equal(isSelectableRuntime({ status: "active" }), true);
});

test("ownership is checked before all mutations, including platform scope changes", async (t) => {
  const calls = backend(t, { ...runtime, tenant_id: "other" });
  await assert.rejects(
    changeRuntime({ ...actor, isAdmin: true }, runtime.id, {
      action: "scope",
      scope: "internal",
      confirmName: runtime.name,
    }),
    { status: 403 },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "GET");
});

test("ordinary owners cannot escalate through the admin-only scope action", async (t) => {
  const calls = backend(t);
  await assert.rejects(
    changeRuntime(actor, runtime.id, {
      action: "scope",
      scope: "internal",
      confirmName: runtime.name,
      isAdmin: true,
    }),
    { status: 403 },
  );
  assert.equal(calls.length, 1);
});

test("sharing writes use only the tenant key and the current BYOVPS contract", async (t) => {
  const calls = backend(t);
  await changeRuntime(actor, runtime.id, {
    action: "sharing",
    sharing: "public",
    tenant_id: "attacker",
    bootstrap: true,
  });
  assert.equal(calls.length, 2);
  assert.equal(
    new URL(calls[1].url).pathname,
    "/v1/runtimes/runtime-fixture/byovps-sharing",
  );
  assert.deepEqual(JSON.parse(calls[1].init.body as string), {
    sharing: "public",
  });
  assert.equal(
    (calls[1].init.headers as Record<string, string>).Authorization,
    "Bearer synthetic-tenant-key",
  );
});

test("internal nodes reject sharing changes and grants before issuing a mutation", async (t) => {
  const calls = backend(t, { ...runtime, cluster_scope: "internal" });
  for (const action of ["sharing", "grant", "revoke", "offer"]) {
    await assert.rejects(
      changeRuntime(actor, runtime.id, {
        action,
        sharing: "public",
        email: "friend@example.test",
      }),
      { status: 409 },
    );
  }
  assert.equal(calls.filter((c) => c.init.method !== "GET").length, 0);
});

test("runtime.write is required even if the browser claims capabilities", async (t) => {
  const calls = backend(t);
  await assert.rejects(
    changeRuntime({ ...actor, scopes: [] }, runtime.id, {
      action: "sharing",
      sharing: "public",
      capabilities: { sharing: true },
    }),
    { status: 403 },
  );
  assert.equal(calls.length, 1);
});

test("offline deletion requires a fresh offline state and exact name confirmation", async (t) => {
  const calls = backend(t);
  await assert.rejects(
    changeRuntime(actor, runtime.id, {
      action: "delete",
      confirmName: runtime.name,
    }),
    { status: 409 },
  );
  assert.equal(calls.length, 1);
  const offline = backend(t, { ...runtime, status: "offline" });
  await assert.rejects(
    changeRuntime(actor, runtime.id, {
      action: "delete",
      confirmName: "wrong",
    }),
    { status: 400 },
  );
  assert.equal(offline.length, 1);
  assert.deepEqual(
    await changeRuntime(actor, runtime.id, {
      action: "delete",
      confirmName: runtime.name,
    }),
    { deleted: true },
  );
  assert.equal(offline.at(-1)?.init.method, "DELETE");
});

test("scope mutation is audited and an unapplied node is not reported as reconciled", async (t) => {
  const previousPool = globalThis.__fuguePgPool;
  const previousKey = process.env.FUGUE_BOOTSTRAP_KEY;
  const audit: unknown[][] = [];
  process.env.FUGUE_BOOTSTRAP_KEY = "synthetic-platform-key";
  globalThis.__fuguePgPool = {
    connect: async () => ({
      query: async (_sql: string, values: unknown[]) => {
        audit.push(values);
        return { rows: [], rowCount: 1 };
      },
      release() {},
    }),
  } as unknown as Pool;
  t.after(() => {
    globalThis.__fuguePgPool = previousPool;
    if (previousKey === undefined) delete process.env.FUGUE_BOOTSTRAP_KEY;
    else process.env.FUGUE_BOOTSTRAP_KEY = previousKey;
  });
  const calls = backend(t, { ...runtime, cluster_scope: "internal" });
  const result = await changeRuntime({ ...actor, isAdmin: true }, runtime.id, {
    action: "scope",
    scope: "internal",
    confirmName: runtime.name,
  });
  assert.equal("nodeReconciled" in result && result.nodeReconciled, false);
  assert.equal(
    (calls[1].init.headers as Record<string, string>).Authorization,
    "Bearer synthetic-platform-key",
  );
  assert.equal(audit[0][0], "admin.runtime.scope.requested");
  assert.equal(audit[1][0], "admin.runtime.scope.completed");
  assert.equal(JSON.stringify(audit).includes("synthetic-platform-key"), false);
});

test("public pricing validates paid dimensions and does not accept NaN, negative or unsafe money", () => {
  const offer = {
    reference_bundle: {
      cpu_millicores: 1000,
      memory_mebibytes: 1024,
      storage_gibibytes: 10,
    },
    reference_monthly_price_microcents: 1_000_000_000,
    free: false,
    free_cpu: false,
    free_memory: false,
    free_storage: false,
  };
  assert.deepEqual(validatePublicOffer({ ...offer, secret: "ignored" }), offer);
  for (const price of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1.5])
    assert.throws(
      () =>
        validatePublicOffer({
          ...offer,
          reference_monthly_price_microcents: price,
        }),
      { status: 400 },
    );
  assert.equal(
    validatePublicOffer({ ...offer, reference_monthly_price_microcents: 0 })
      .reference_monthly_price_microcents,
    0,
  );
  assert.throws(
    () =>
      validatePublicOffer({
        ...offer,
        reference_bundle: { ...offer.reference_bundle, cpu_millicores: 0 },
      }),
    { status: 400 },
  );
  assert.equal(
    validatePublicOffer({
      ...offer,
      free: true,
      reference_monthly_price_microcents: 0,
    }).free,
    true,
  );
});
