import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";

type DependencyTiming = {
  kind: "api" | "sql";
  name: string;
  startMs: number;
  durationMs: number;
  ok: boolean;
  backend?: { name: string; durationMs: number }[];
  database?: { acquireMs: number; queryMs: number };
};

type PageTrace = {
  id: string;
  route: string;
  started: number;
  failures: number;
  pending: number;
  dependencies: DependencyTiming[];
};

const traces = new AsyncLocalStorage<PageTrace>();
const dependencyTraces = new AsyncLocalStorage<DependencyTiming>();
const milliseconds = (value: number) => Math.round(value * 10) / 10;

export function sqlTimingName(text: string): string {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);
}

export function apiTimingName(path: string): string {
  const url = new URL(path, "http://fugue.invalid");
  const pathname = ["/v1/projects/image-usage", "/v1/console/projects/snapshot"].includes(url.pathname) ? url.pathname : url.pathname.replace(
    /\/(apps|tenants|projects|api-keys|runtimes)\/[^/]+/g,
    "/$1/:id",
  );
  const flags = ["include_live_status", "include_resource_usage", "include_current_usage"]
    .filter((key) => url.searchParams.has(key))
    .map((key) => `${key}=${url.searchParams.get(key) === "true"}`);
  return pathname + (flags.length ? `?${flags.join("&")}` : "");
}

export async function measurePageDependency<T>(
  kind: DependencyTiming["kind"],
  name: string,
  run: () => Promise<T>,
): Promise<T> {
  const trace = traces.getStore();
  if (!trace) return run();
  const started = performance.now();
  trace.pending++;
  const dependency: DependencyTiming = {
    kind, name, ok: false, startMs: milliseconds(started - trace.started), durationMs: 0,
  };
  try {
    const result = await dependencyTraces.run(dependency, run);
    dependency.ok = true;
    return result;
  } finally {
    trace.pending--;
    if (!dependency.ok) trace.failures++;
    if (trace.dependencies.length < 512) {
      dependency.durationMs = milliseconds(performance.now() - started);
      trace.dependencies.push(dependency);
    }
  }
}

export function recordPageBackendTiming(header: string | null) {
  const dependency = dependencyTraces.getStore();
  if (!dependency || !header) return;
  const backend: NonNullable<DependencyTiming["backend"]> = [];
  for (const metric of header.slice(0, 8192).split(",").slice(0, 64)) {
    const match = /^\s*([a-z][a-z0-9_-]{0,63});dur=(\d+(?:\.\d+)?)\s*$/.exec(metric);
    if (!match) continue;
    const durationMs = Number(match[2]);
    if (Number.isFinite(durationMs)) backend.push({ name: match[1], durationMs });
  }
  if (backend.length) dependency.backend = backend;
}

export function recordPageDatabaseTiming(acquireMs: number, queryMs: number) {
  const dependency = dependencyTraces.getStore();
  if (dependency?.kind !== "sql") return;
  dependency.database = { acquireMs: milliseconds(acquireMs), queryMs: milliseconds(queryMs) };
}

export async function tracePage<T>(route: string, run: () => Promise<T>) {
  const trace: PageTrace = {
    id: randomUUID(), route, started: performance.now(),
    failures: 0, pending: 0, dependencies: [],
  };
  return traces.run(trace, async () => {
    let resolved = false;
    try {
      const result = await run();
      resolved = true;
      return {
        result,
        timing: {
          id: trace.id, route,
          serverMs: milliseconds(performance.now() - trace.started),
          dependenciesResolved: trace.failures === 0 && trace.pending === 0,
        },
      };
    } finally {
      console.info(JSON.stringify({
        event: "fugue_web_page_data", id: trace.id, route,
        durationMs: milliseconds(performance.now() - trace.started),
        resolved, failures: trace.failures, pending: trace.pending,
        dependencies: trace.dependencies,
      }));
    }
  });
}
