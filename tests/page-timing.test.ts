import assert from "node:assert/strict";
import { test } from "node:test";
import { apiTimingName, measurePageDependency, recordPageBackendTiming, recordPageDatabaseTiming, sqlTimingName, tracePage } from "../lib/server/page-timing";

test("edge correlation is bounded and arbitrary header content is not published", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "info", (value: string) => logs.push(value));
  const good = await tracePage("/projects", async () => true, { edgeRequestId: "edge_abc123_def456" });
  const bad = await tracePage("/projects", async () => true, { edgeRequestId: "Bearer secret\nforged-log" });
  assert.equal(good.timing.edgeRequestId, "edge_abc123_def456");
  assert.equal(bad.timing.edgeRequestId, undefined);
  assert.equal(logs.join("").includes("secret"), false);
  assert.equal(JSON.parse(logs[0]).edgeRequestId, good.timing.edgeRequestId);
});

test("parallel page traces stay isolated and swallowed failures remain visible", async () => {
  const [failed, successful] = await Promise.all([
    tracePage("/projects", async () => {
      await measurePageDependency("api", "/v1/apps", async () => {
        await Promise.resolve();
        throw new Error("unavailable");
      }).catch(() => []);
      return "fallback";
    }),
    tracePage("/keys", async () => measurePageDependency("sql", "query-hash", async () => 42)),
  ]);
  assert.equal(failed.result, "fallback");
  assert.equal(failed.timing.dependenciesResolved, false);
  assert.equal(successful.result, 42);
  assert.equal(successful.timing.dependenciesResolved, true);
  assert.notEqual(failed.timing.id, successful.timing.id);
});

test("backend stages stay attached to their parallel dependency and omit arbitrary descriptions", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "info", (value: string) => logs.push(value));
  await tracePage("/timing-test", () => Promise.all([
    measurePageDependency("api", "/v1/apps", async () => {
      await Promise.resolve();
      recordPageBackendTiming('store_apps;dur=12.4, private;desc="secret", invalid;dur=NaN');
    }),
    measurePageDependency("api", "/v1/billing", async () => {
      recordPageBackendTiming("billing_batch_summary;dur=6.2");
    }),
  ]));
  const trace = JSON.parse(logs.find((value) => JSON.parse(value).route === "/timing-test")!);
  assert.deepEqual(trace.dependencies.find((d: {name:string}) => d.name === "/v1/apps").backend,
    [{name:"store_apps",durationMs:12.4}]);
  assert.deepEqual(trace.dependencies.find((d: {name:string}) => d.name === "/v1/billing").backend,
    [{name:"billing_batch_summary",durationMs:6.2}]);
  assert.equal(logs.join("").includes("secret"), false);
});

test("timing labels omit identifiers, SQL text and query values", () => {
  assert.equal(apiTimingName("/v1/tenants/private-tenant/billing?include_current_usage=true&key=private"),
    "/v1/tenants/:id/billing?include_current_usage=true");
  assert.equal(apiTimingName("/v1/console/projects/private-project"), "/v1/console/projects/:id");
  assert.equal(apiTimingName("/v1/projects/image-usage?tenant_id=private"), "/v1/projects/image-usage");
  assert.equal(apiTimingName("/v1/console/projects/snapshot"), "/v1/console/projects/snapshot");
  const sql = "SELECT email FROM app_users WHERE email = $1";
  assert.match(sqlTimingName(sql), /^[0-9a-f]{16}$/);
  assert.equal(sqlTimingName(sql), sqlTimingName("  SELECT email\nFROM app_users WHERE email = $1 "));
});

test("SQL acquisition and execution timings remain on their own dependency", async (t) => {
  const logs: string[] = [];
  t.mock.method(console, "info", (value: string) => logs.push(value));
  await tracePage("/timing-test", () => Promise.all([
    measurePageDependency("sql", "query-a", async () => { recordPageDatabaseTiming(180.25, 0.34); }),
    measurePageDependency("api", "/v1/test", async () => { recordPageDatabaseTiming(10, 20); }),
  ]));
  const trace = JSON.parse(logs[0]);
  assert.deepEqual(trace.dependencies.find((d: {name:string}) => d.name === "query-a").database, {acquireMs:180.3,queryMs:0.3});
  assert.equal(trace.dependencies.find((d: {kind:string}) => d.kind === "api").database, undefined);
});
