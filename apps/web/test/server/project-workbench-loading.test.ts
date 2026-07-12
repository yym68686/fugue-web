import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  resolveWorkbenchSelection,
  shouldUseInitialEndpointData,
  shouldUseInitialWorkbenchDetail,
} from "../../components/fugue-coss/project-workbench-shared";
import type { ConsoleProjectDetailData } from "../../lib/console/gallery-types";

const webRoot = path.resolve(import.meta.dir, "../..");

async function readWebFile(relativePath: string) {
  return readFile(path.join(webRoot, relativePath), "utf8");
}

function detailWithServices(): ConsoleProjectDetailData {
  return {
    project: {
      id: "project-1",
      services: [
        { id: "app-1", kind: "app" },
        { id: "database-1", kind: "backing-service" },
      ],
    },
  } as ConsoleProjectDetailData;
}

describe("project workbench loading boundaries", () => {
  test("keeps deferred app tabs together while domains owns a smaller client chunk", async () => {
    const [workbench, deferredTabs, domains] = await Promise.all([
      readWebFile("components/fugue-coss/project-workbench.tsx"),
      readWebFile("components/fugue-coss/project-workbench-deferred-tabs.tsx"),
      readWebFile("components/fugue-coss/project-workbench-domains.tsx"),
    ]);
    const deferredModule = "@/components/fugue-coss/project-workbench-deferred-tabs";

    expect(deferredTabs.startsWith('"use client";')).toBe(true);
    for (const tab of [
      "EnvironmentTab",
      "LogsTab",
      "FilesTab",
      "ImagesTab",
      "ObservabilityTab",
    ]) {
      expect(deferredTabs).toContain(`export function ${tab}`);
      expect(workbench).not.toContain(`function ${tab}`);
      expect(workbench).toContain(`module.${tab}`);
    }

    expect(workbench).toContain(`import("${deferredModule}")`);
    expect(workbench).not.toContain(`from "${deferredModule}"`);
    expect(workbench).toContain("onMouseEnter={");
    expect(workbench).toContain("onFocus={");
    expect(workbench).toContain("preloadDeferredWorkbenchTabs");
    expect(workbench).toContain('tab === "Environment"');
    expect(workbench).toContain("<DeferredEnvironmentTab");
    expect(domains.startsWith('"use client";')).toBe(true);
    expect(domains).toContain("export function CustomDomainsPanel");
    expect(deferredTabs).not.toContain("CustomDomainsPanel");
    expect(workbench).not.toContain("function CustomDomainsPanel");
    expect(workbench).toContain(
      'import("@/components/fugue-coss/project-workbench-domains")',
    );
  });

  test("server prefetch failure remains an explicit client fallback", async () => {
    const page = await readWebFile("app/app/projects/[projectId]/page.tsx");

    expect(page).toContain("getConsoleProjectDetailData(projectId, locale)");
    expect(page).toMatch(/try\s*\{[\s\S]*?getConsoleProjectDetailData/);
    expect(page).toMatch(/catch\s*\{\s*initialDetail = undefined;/);
    expect(page).toContain("initialDetail={initialDetail}");
  });

  test("a serialized initial detail skips bootstrap loading but refresh fetches", async () => {
    const serializedDetail = JSON.parse(
      JSON.stringify(detailWithServices()),
    ) as ConsoleProjectDetailData;
    let fetchCount = 0;

    const load = async (
      initialDetail: ConsoleProjectDetailData | undefined,
      refreshKey: number,
    ) => {
      if (shouldUseInitialWorkbenchDetail(initialDetail, refreshKey)) {
        return initialDetail;
      }

      fetchCount += 1;
      return { project: null } satisfies ConsoleProjectDetailData;
    };

    expect(await load(serializedDetail, 0)).toEqual(serializedDetail);
    expect(fetchCount).toBe(0);
    expect(await load(serializedDetail, 1)).toEqual({ project: null });
    expect(fetchCount).toBe(1);
    expect(await load(undefined, 0)).toEqual({ project: null });
    expect(fetchCount).toBe(2);
  });

  test("initial endpoint data is single-use across refreshes and service switches", () => {
    expect(
      shouldUseInitialEndpointData("/apps/a/domains", "/apps/a/domains", 0, false),
    ).toBe(true);
    expect(
      shouldUseInitialEndpointData("/apps/a/domains", "/apps/a/domains", 1, false),
    ).toBe(false);
    expect(
      shouldUseInitialEndpointData("/apps/a/domains", "/apps/b/domains", 0, false),
    ).toBe(false);
    expect(
      shouldUseInitialEndpointData("/apps/a/domains", "/apps/a/domains", 0, true),
    ).toBe(false);
  });

  test("server domains prefetch is limited to an app in the default service slot", async () => {
    const [galleryData, workbench, wizard] = await Promise.all([
      readWebFile("lib/console/gallery-data.ts"),
      readWebFile("components/fugue-coss/project-workbench.tsx"),
      readWebFile("components/fugue-coss/new-project-wizard.tsx"),
    ]);

    expect(galleryData).toContain("const firstService = project?.services[0]");
    expect(galleryData).toContain(
      'const firstApp = firstService?.kind === "app" ? firstService : null',
    );
    expect(galleryData).toContain("getFugueAppDomains(active.adminKeySecret");
    expect(galleryData).toContain("initialDomains");
    expect(workbench).toContain("initialDomains={detail?.initialDomains}");
    expect(workbench).toContain('method: "POST"');
    expect(workbench).toContain("messages.projectUnavailable");
    expect(workbench).toContain("messages.retry");
    expect(workbench).toContain("aria-pressed={service.id === item.id}");
    expect(workbench).not.toContain("aria-selected=");
    expect(wizard).toContain("aria-pressed={runtime === item.id}");
    expect(wizard).not.toContain("aria-selected=");
  });

  test("URL service and tab selection keeps app and backing-service fallbacks", () => {
    const detail = detailWithServices();

    expect(resolveWorkbenchSelection(detail, "app-1", "Logs")).toEqual({
      selectedServiceId: "app-1",
      tab: "Logs",
    });
    expect(resolveWorkbenchSelection(detail, "database-1", "Logs")).toEqual({
      selectedServiceId: "database-1",
      tab: "Overview",
    });
    expect(resolveWorkbenchSelection(detail, "missing", "missing")).toEqual({
      selectedServiceId: "app-1",
      tab: "Route",
    });
  });
});
