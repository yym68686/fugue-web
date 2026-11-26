import assert from "node:assert/strict";
import test from "node:test";

import { isSameOriginJsonWrite } from "@/lib/auth/browser-json-write";
import { estimateManagedCap, managedCapFromSummary, readManagedCap, readManagedCapDraft } from "@/lib/billing/managed-cap";
import { readBoundedJson } from "@/lib/security/read-bounded-json";

const cap = { cpuMillicores: 550, memoryMebibytes: 1600, storageGibibytes: 256 };

test("a cap write accepts same-origin browser JSON on an alias but not cross-origin requests", () => {
  const canonical = "https://example.invalid";
  const json = (origin: string, fetchSite?: string, type = "application/json; charset=utf-8") =>
    new Request("http://127.0.0.1/console/billing", {
      method: "PATCH",
      headers: { origin, "content-type": type, ...(fetchSite ? { "sec-fetch-site": fetchSite } : {}) },
    });
  assert.equal(isSameOriginJsonWrite(json(canonical), canonical), true);
  assert.equal(isSameOriginJsonWrite(json("https://console.example.invalid", "same-origin"), canonical), true);
  assert.equal(isSameOriginJsonWrite(json("https://console.example.invalid"), canonical), false);
  assert.equal(isSameOriginJsonWrite(json(canonical, "same-site"), canonical), false);
  assert.equal(isSameOriginJsonWrite(json(canonical, "cross-site"), canonical), false);
  assert.equal(isSameOriginJsonWrite(json("null", "same-origin"), canonical), false);
  assert.equal(isSameOriginJsonWrite(json(canonical, "same-origin", "text/plain"), canonical), false);
});

test("a storage-only edit preserves fractional CPU and memory settings", () => {
  assert.deepEqual(readManagedCapDraft("0.55", "1.5625", "256"), cap);
  assert.deepEqual(readManagedCapDraft("1.001", "0.0009765625", "0"), {
    cpuMillicores: 1001, memoryMebibytes: 1, storageGibibytes: 0,
  });
  assert.deepEqual(managedCapFromSummary({}), {
    cpuMillicores: 0, memoryMebibytes: 0, storageGibibytes: 0,
  });
  for (const invalid of [["", "1.5625", "256"], ["0.5501", "1.5625", "256"],
    ["0.55", "1.562", "256"], ["0.55", "1.5625", ""], ["0.55", "1.5625", "256.5"]]) {
    assert.equal(readManagedCapDraft(invalid[0], invalid[1], invalid[2]), null);
  }
});

test("the cap write accepts exactly the three non-negative integer quantities", () => {
  assert.deepEqual(readManagedCap(cap), cap);
  for (const invalid of [
    null, [], { cpuMillicores: 550, memoryMebibytes: 1600 },
    { ...cap, tenantId: "another-tenant" }, { ...cap, balanceCents: 10000 },
    { ...cap, storageGibibytes: "256" }, { ...cap, storageGibibytes: null },
    { ...cap, storageGibibytes: 0.5 }, { ...cap, storageGibibytes: -1 },
    { ...cap, storageGibibytes: Number.MAX_SAFE_INTEGER + 1 },
  ]) assert.equal(readManagedCap(invalid), null);
});

test("cap forecasts use the same integer quantities as the write and reject overflow", () => {
  const book = {
    currency: "USD", hours_per_month: 730,
    cpu_microcents_per_millicore_hour: 154, memory_microcents_per_mib_hour: 53,
    storage_microcents_per_gib_hour: 760,
  };
  assert.deepEqual(estimateManagedCap(cap, book), { hourly: 364060, monthly: 265763800 });
  assert.equal(estimateManagedCap({ ...cap, storageGibibytes: Number.MAX_SAFE_INTEGER }, book), null);
  assert.equal(estimateManagedCap(cap, { ...book, hours_per_month: 0 }), null);
});

test("small JSON request parsing rejects truncation, oversize, and malformed bodies", async () => {
  const request = (body: string) => new Request("http://127.0.0.1/", { method: "PATCH", body });
  assert.deepEqual(await readBoundedJson(request('{"cap":5}'), 9), { cap: 5 });
  assert.equal(await readBoundedJson(request('{"cap":5}'), 8), null);
  assert.equal(await readBoundedJson(request('{"cap":'), 40), null);
  assert.equal(await readBoundedJson(request('"汉"'), 4), null);
});
