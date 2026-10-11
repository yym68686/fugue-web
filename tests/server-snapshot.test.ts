import assert from "node:assert/strict";
import { test } from "node:test";
import type { Pool } from "pg";
import { serversSnapshot } from "@/lib/servers/snapshot";
import type { WorkspaceAccess } from "@/lib/workspace/store";

const workspace = {
  email: "owner@example.test",
  tenantId: "owner",
  adminKeySecret: "synthetic-key",
} as WorkspaceAccess;

for (const isAdmin of [false, true]) {
  for (const failNodes of [false, true]) {
    test(`server snapshot preserves ownership and key usage for admin=${isAdmin} when node metrics ${failNodes ? "fail" : "succeed"}`, async (t) => {
      const oldPool = globalThis.__fuguePgPool;
      const oldUrl = process.env.FUGUE_API_URL;
      const oldBootstrap = process.env.FUGUE_BOOTSTRAP_KEY;
      process.env.FUGUE_BOOTSTRAP_KEY = "synthetic-platform-key";
      process.env.FUGUE_API_URL = "https://api.example.test";
      const queries: string[] = [];
      globalThis.__fuguePgPool = {
        connect: async () => ({
          query: async (sql: string) => {
            queries.push(sql);
            return {
              rows: sql.startsWith("SELECT")
                ? [
                    {
                      id: "key",
                      label: "Renamed locally",
                      prefix: "abc",
                      status: "active",
                      last_used_at: new Date("2026-10-11T02:58:06Z"),
                      created_at: new Date("2026-10-11T02:51:54Z"),
                      has_secret: true,
                    },
                  ]
                : [],
              rowCount: 1,
            };
          },
          release() {},
        }),
      } as unknown as Pool;
      t.after(() => {
        globalThis.__fuguePgPool = oldPool;
        if (oldBootstrap === undefined) delete process.env.FUGUE_BOOTSTRAP_KEY;
        else process.env.FUGUE_BOOTSTRAP_KEY = oldBootstrap;
        if (oldUrl === undefined) delete process.env.FUGUE_API_URL;
        else process.env.FUGUE_API_URL = oldUrl;
      });
      t.mock.method(
        globalThis,
        "fetch",
        async (url: string, init: RequestInit) => {
          const path = new URL(url).pathname;
          assert.equal(
            (init.headers as Record<string, string>).Authorization,
            path === "/v1/cluster/nodes" && isAdmin
              ? "Bearer synthetic-platform-key"
              : "Bearer synthetic-key",
          );
          if (path === "/v1/auth/context")
            return Response.json({
              principal: { tenant_id: "owner", scopes: ["runtime.write"] },
            });
          if (path === "/v1/node-keys")
            return Response.json({
              node_keys: [
                {
                  id: "key",
                  tenant_id: "owner",
                  label: "Upstream label",
                  status: "active",
                  last_used_at: "2026-10-11T02:58:06Z",
                },
              ],
            });
          if (path === "/v1/runtimes")
            return Response.json({
              runtimes: [
                {
                  id: "runtime",
                  tenant_id: "owner",
                  name: "own",
                  type: "managed-owned",
                  status: "active",
                  node_key_id: "key",
                  cluster_node_name: "node",
                  agent_key_hash: "must-not-leak",
                },
                {
                  id: "public",
                  tenant_id: "other",
                  name: "public",
                  type: "managed-owned",
                  status: "active",
                  access_mode: "public",
                },
              ],
            });
          if (path === "/v1/cluster/nodes")
            return failNodes
              ? Response.json({ error: "metrics unavailable" }, { status: 503 })
              : Response.json({
                  cluster_nodes: [
                    { name: "unrelated-private-host", status: "ready" },
                    {
                      name: "node",
                      status: "ready",
                      observed_at: "2026-10-11T02:58:00Z",
                      machine: { token: "must-not-leak" },
                      conditions: { Ready: { status: "true" } },
                      cpu: { capacity_millicores: 1000 },
                    },
                  ],
                });
          throw new Error(`Unexpected test request: ${path}`);
        },
      );
      const data = await serversSnapshot(workspace, isAdmin);
      assert.equal(data.keys[0].lastUsedAt, "2026-10-11T02:58:06.000Z");
      assert.equal(data.keys[0].attachedCount, 1);
      assert.equal(data.keys[0].hasSecret, true);
      assert.equal(data.keys[0].label, "Renamed locally");
      assert.equal(data.servers[0].capabilities.scope, isAdmin);
      assert.equal(data.servers[1].capabilities.scope, false);
      assert.equal(data.servers[1].runtime.owned, false);
      assert.equal(data.servers[1].runtime.kind, "public");
      assert.equal(JSON.stringify(data).includes("must-not-leak"), false);
      assert.equal(JSON.stringify(data).includes("synthetic-key"), false);
      if (failNodes) {
        assert.equal(data.servers[0].node, null);
        assert.equal(data.errors.length, 1);
      } else assert.equal(data.servers[0].node?.cpu?.capacity_millicores, 1000);
      if (!failNodes) assert.deepEqual(data.servers[0].node?.workloads, []);
      assert.equal(
        JSON.stringify(data).includes("unrelated-private-host"),
        false,
      );
      assert.equal(
        JSON.stringify(data).includes("synthetic-platform-key"),
        false,
      );
      assert.equal(queries.length, 2);
    });
  }
}
