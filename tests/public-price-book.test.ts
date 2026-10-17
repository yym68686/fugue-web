import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicPriceBook } from "../lib/billing/public-price-book";

const book = {
  currency: "USD", hours_per_month: 730, effective_date: "2026-10-17",
  cpu_microcents_per_millicore_hour: 154,
  memory_microcents_per_mib_hour: 53,
  storage_microcents_per_gib_hour: 760,
};

test("public prices preserve exact billing units and expose only public fields", () => {
  assert.deepEqual(parsePublicPriceBook(JSON.stringify({ ...book, tenant_id: "private", balance: 100 })), book);
});

test("invalid or incomplete publication does not advertise a free or fabricated rate", () => {
  for (const raw of [undefined, "", "not json", "null", "{}", "[]",
    ...[
      { currency: "XYZ" }, { hours_per_month: 0 }, { hours_per_month: 745 },
      { cpu_microcents_per_millicore_hour: -1 }, { memory_microcents_per_mib_hour: "53" },
      { storage_microcents_per_gib_hour: 0.5 }, { storage_microcents_per_gib_hour: 1e30 },
      { effective_date: "2026-02-30" }, { effective_date: "2026-13-01" },
      { memory_microcents_per_mib_hour: undefined },
    ].map((patch) => JSON.stringify({ ...book, ...patch })),
  ]) assert.equal(parsePublicPriceBook(raw), null);
});
