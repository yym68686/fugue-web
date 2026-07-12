import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("every successful billing mutation clears the five-minute live caches", async () => {
  const source = await readFile(path.join(webRoot, "lib/billing/service.ts"), "utf8");

  for (const functionName of [
    "updateBillingForEmail",
    "topUpBillingForEmail",
    "topUpBillingForTenant",
  ]) {
    assert.match(
      source,
      new RegExp(
        `export\\s+async\\s+function\\s+${functionName}[\\s\\S]*?invalidateBillingLiveUsageCache\\([^)]*\\)[\\s\\S]*?return\\s+billing`,
      ),
    );
  }

  assert.match(
    source,
    /billingLiveSummaryCache\.clear\(tenantId\)[\s\S]*billingImageStorageCache\.clear\(tenantId\)/,
  );
});
