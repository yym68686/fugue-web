import { expect, mock, test } from "bun:test";

const workspace = {
  adminKeySecret: "workspace-test-secret",
  tenantId: "tenant-cache-test",
  tenantName: "Cache test",
};
let liveVersion = 1;
let liveSummaryReads = 0;
let imageUsageReads = 0;

function billingSummary() {
  return { marker: liveVersion };
}

mock.module("@/lib/server/session-state-cache", () => ({
  getCachedWorkspaceAccessByEmail: async () => workspace,
}));

mock.module("@/lib/fugue/api", () => ({
  getFugueBillingSummary: async () => {
    liveSummaryReads += 1;
    return billingSummary();
  },
  getFugueProjectImageUsage: async () => {
    imageUsageReads += 1;
    return { projects: [{ totalSizeBytes: liveVersion * 100 }] };
  },
  topUpFugueBilling: async () => {
    liveVersion += 1;
    return billingSummary();
  },
  updateFugueBilling: async () => {
    liveVersion += 1;
    return billingSummary();
  },
}));

test("billing mutations evict both five-minute live caches before the next read", async () => {
  const { getBillingPageData, topUpBillingForEmail } = await import(
    "../../lib/billing/service"
  );

  const first = await getBillingPageData("cache@example.test", {
    includeCurrentUsage: true,
  });
  const cached = await getBillingPageData("cache@example.test", {
    includeCurrentUsage: true,
  });

  expect((first?.billing as { marker?: number } | null)?.marker).toBe(1);
  expect((cached?.billing as { marker?: number } | null)?.marker).toBe(1);
  expect(first?.imageStorageBytes).toBe(100);
  expect(cached?.imageStorageBytes).toBe(100);
  expect(liveSummaryReads).toBe(1);
  expect(imageUsageReads).toBe(1);

  await topUpBillingForEmail("cache@example.test", { amountCents: 500 });
  const refreshed = await getBillingPageData("cache@example.test", {
    includeCurrentUsage: true,
  });

  expect((refreshed?.billing as { marker?: number } | null)?.marker).toBe(2);
  expect(refreshed?.imageStorageBytes).toBe(200);
  expect(liveSummaryReads).toBe(2);
  expect(imageUsageReads).toBe(2);
});
