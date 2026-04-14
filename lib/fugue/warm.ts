import "server-only";

import { getAdminAppsPageData, getAdminClusterPageData } from "@/lib/admin/service";
import { getFugueEnv } from "@/lib/fugue/env";

declare global {
  var __fugueWarmApiPromise: Promise<void> | undefined;
  var __fugueWarmServerRuntimePromise: Promise<void> | undefined;
}

async function warmFugueApi() {
  const env = getFugueEnv();
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${env.bootstrapKey}`,
  };
  const warmPaths = [
    "/v1/cluster/control-plane",
    "/v1/apps?include_resource_usage=false&include_live_status=false",
    "/v1/cluster/nodes?sync_locations=false",
    "/v1/console/gallery",
  ];

  try {
    await Promise.allSettled(
      warmPaths.map((path) =>
        fetch(new URL(path, env.apiServerUrl), {
          cache: "no-store",
          headers,
          signal: AbortSignal.timeout(5_000),
        }),
      ),
    );
  } catch {
    // Route reads should stay functional even if warmup misses.
  }
}

export function warmFugueApiConnection() {
  if (!globalThis.__fugueWarmApiPromise) {
    globalThis.__fugueWarmApiPromise = warmFugueApi();
  }

  return globalThis.__fugueWarmApiPromise;
}

async function warmCriticalRouteModules() {
  await Promise.allSettled([
    import("@/app/layout"),
    import("@/app/page"),
    import("@/app/app/layout"),
    import("@/app/app/page"),
    import("@/app/app/apps/page"),
    import("@/app/app/cluster/page"),
    import("@/app/app/cluster-nodes/page"),
    import("@/app/new/repository/page"),
    import("@/app/api/auth/session/route"),
    import("@/app/api/fugue/console/gallery/route"),
    import("@/app/api/fugue/console/pages/cluster-nodes/route"),
    import("@/app/api/fugue/admin/pages/apps/route"),
    import("@/app/api/fugue/admin/pages/cluster/route"),
  ]);
}

async function warmCriticalSnapshots() {
  await Promise.allSettled([
    getAdminAppsPageData(),
    getAdminClusterPageData(),
  ]);
}

async function warmServerRuntimeInternal() {
  await warmCriticalRouteModules();

  await Promise.allSettled([
    warmFugueApiConnection(),
    warmCriticalSnapshots(),
  ]);
}

export function warmServerRuntime() {
  if (!globalThis.__fugueWarmServerRuntimePromise) {
    globalThis.__fugueWarmServerRuntimePromise = warmServerRuntimeInternal();
  }

  return globalThis.__fugueWarmServerRuntimePromise;
}
