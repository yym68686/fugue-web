import assert from "node:assert/strict";
import test from "node:test";

import { getConsoleGalleryData } from "@/lib/fugue/console";

test("gallery waits for the complete snapshot and uses its resource totals", async (t) => {
  let releaseUsage!: (response: Response) => void;
  const usageResponse = new Promise<Response>((resolve) => { releaseUsage = resolve; });
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL) => {
    const request = new URL(String(url));
    paths.push(request.pathname + request.search);
    return usageResponse;
  });
  let settled = false;
  const dataPromise = getConsoleGalleryData("synthetic-key").then((value) => {
    settled = true;
    return value;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  releaseUsage(Response.json({
    projects: [{
      id: "project-a", resource_usage_snapshot: {
        cpu_millicores: 60, memory_bytes: 1536, persistent_storage_used_bytes: 2048,
      },
    }],
    image_usage: {
      measurement_status: "complete",
      projects: [{ project_id: "project-a", total_size_bytes: 4096 }],
    },
  }));
  const data = await dataPromise;
  const usage = data.resources.get("project-a");
  assert.equal(usage?.cpu_millicores, 60);
  assert.equal(usage?.memory_bytes, 1536);
  assert.equal(usage?.persistent_storage_used_bytes, 2048);
  assert.equal(usage?.image_total_bytes, 4096);
  assert.deepEqual(paths, ["/v1/console/projects/snapshot"]);
});

test("gallery rejects a failed resource source instead of publishing zero usage", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "resource source unavailable" }, { status: 503 }));
  await assert.rejects(getConsoleGalleryData("synthetic-key"), {
    status: 503,
    message: "resource source unavailable",
  });
});

test("gallery rejects a snapshot that omits image data", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ projects: [] }));
  await assert.rejects(getConsoleGalleryData("synthetic-key"), /incomplete project snapshot/);
});

test("gallery preserves incomplete image evidence without claiming zero disk usage", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    projects: [{ id: "project-a", resource_usage_snapshot: { cpu_millicores: 20 } }],
    image_usage: {
      measurement_status: "unavailable", measurement_reasons: ["missing_blob"],
      observed_at: "2026-01-01T00:00:00Z", projects: [],
    },
  }));
  const { resources } = await getConsoleGalleryData("synthetic-key");
  assert.equal(resources.get("project-a")?.cpu_millicores, 20);
  assert.equal(resources.get("project-a")?.image_total_bytes, undefined);
  assert.equal(resources.get("project-a")?.image_measurement_status, "unavailable");
  assert.deepEqual(resources.get("project-a")?.image_measurement_reasons, ["missing_blob"]);
});
