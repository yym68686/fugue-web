import assert from "node:assert/strict";
import { test } from "node:test";
import { apiTimingName, measurePageDependency, sqlTimingName, tracePage } from "../lib/server/page-timing";

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

test("timing labels omit identifiers, SQL text and query values", () => {
  assert.equal(apiTimingName("/v1/tenants/private-tenant/billing?include_current_usage=true&key=private"),
    "/v1/tenants/:id/billing?include_current_usage=true");
  assert.equal(apiTimingName("/v1/console/projects/private-project"), "/v1/console/projects/:id");
  const sql = "SELECT email FROM app_users WHERE email = $1";
  assert.match(sqlTimingName(sql), /^[0-9a-f]{16}$/);
  assert.equal(sqlTimingName(sql), sqlTimingName("  SELECT email\nFROM app_users WHERE email = $1 "));
});
