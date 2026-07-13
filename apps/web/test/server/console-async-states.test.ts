import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const componentsRoot = path.join(import.meta.dir, "../../components");

async function component(relativePath: string) {
  return readFile(path.join(componentsRoot, relativePath), "utf8");
}

describe("console asynchronous state semantics", () => {
  test("the shared loading state is busy and announced politely", async () => {
    const source = await component("console/async-state.tsx");

    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('role="status"');
    expect(source).toContain("Promise.resolve(onRetry()).catch");
  });

  test("snapshot-backed console surfaces expose retryable failures", async () => {
    const expectations = [
      ["fugue-coss/billing-console.tsx", "onRetry={refreshBilling}"],
      ["fugue-coss/servers-console.tsx", "onRetry={() => refresh({ force: true })}"],
      ["fugue-coss/access-keys-console.tsx", "onRetry={refreshAccessKeys}"],
      ["fugue-coss/profile-security.tsx", "onRetry={() => refresh({ force: true })}"],
    ] as const;

    for (const [relativePath, retry] of expectations) {
      const source = await component(relativePath);
      expect(source).toContain("ConsoleLoadError");
      expect(source).toContain("ConsoleLoadingState");
      expect(source).toContain(retry);
    }
  });

  test("manual refreshes publish loading and recoverable error state", async () => {
    const source = await readFile(
      path.join(import.meta.dir, "../../lib/console/page-snapshot-client.ts"),
      "utf8",
    );

    expect(source).toContain(
      "refresh: async (refreshOptions?: SnapshotFetchOptions) => {",
    );
    expect(source).toContain("setLoading(true)");
    expect(source).toContain("setError(readRequestError(error))");
  });

  test("every console skeleton branch uses the shared or explicit status contract", async () => {
    const sharedConsumers = [
      "fugue-coss/access-keys-console.tsx",
      "fugue-coss/admin-apps-console.tsx",
      "fugue-coss/admin-cluster-console.tsx",
      "fugue-coss/admin-users-console.tsx",
      "fugue-coss/billing-console.tsx",
      "fugue-coss/new-project-wizard.tsx",
      "fugue-coss/profile-security.tsx",
      "fugue-coss/project-gallery.tsx",
      "fugue-coss/project-workbench-deferred-tabs.tsx",
      "fugue-coss/project-workbench.tsx",
      "fugue-coss/servers-console.tsx",
    ];
    const explicitConsumers = [
      "console/island-loading.tsx",
      "fugue-coss/dns-console.tsx",
      "fugue-coss/shells.tsx",
    ];

    for (const relativePath of sharedConsumers) {
      const source = await component(relativePath);
      expect(source).toContain("<Skeleton");
      expect(source).toContain("ConsoleLoadingState");
    }

    for (const relativePath of explicitConsumers) {
      const source = await component(relativePath);
      expect(source).toContain("<Skeleton");
      expect(source).toContain('aria-busy="true"');
      expect(source).toContain('aria-live="polite"');
      expect(source).toContain('role="status"');
    }
  });
});
