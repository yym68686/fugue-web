import "server-only";

import { getFugueEnv } from "@/lib/fugue/env";

declare global {
  var __fugueWarmApiPromise: Promise<void> | undefined;
}

async function warmFugueApi() {
  const env = getFugueEnv();

  try {
    await fetch(new URL("/v1/cluster/control-plane", env.apiServerUrl), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.bootstrapKey}`,
      },
      signal: AbortSignal.timeout(5_000),
    });
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
