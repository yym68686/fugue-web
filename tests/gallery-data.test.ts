import assert from "node:assert/strict";
import test from "node:test";

import { getConsoleGalleryData } from "@/lib/fugue/console";

test("gallery waits for actual app usage even when summary usage is empty", async (t) => {
  let releaseUsage!: (response: Response) => void;
  const usageResponse = new Promise<Response>((resolve) => { releaseUsage = resolve; });
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL) => {
    const request = new URL(String(url));
    paths.push(request.pathname + request.search);
    if (request.pathname === "/v1/apps") return usageResponse;
    if (request.pathname === "/v1/console/gallery") {
      return Response.json({ projects: [{ id: "project-a", resource_usage_snapshot: {} }] });
    }
    return Response.json({
      measurement_status: "complete",
      projects: [{ project_id: "project-a", total_size_bytes: 4096 }],
    });
  });
  let settled = false;
  const dataPromise = getConsoleGalleryData("synthetic-key").then((value) => {
    settled = true;
    return value;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  releaseUsage(Response.json({
    apps: [{
      id: "app-a", project_id: "project-a",
      current_resource_usage: { cpu_millicores: 50, memory_bytes: 1024 },
      backing_services: [{ id: "service-a", current_resource_usage: {
        cpu_millicores: 10, memory_bytes: 512, persistent_storage_used_bytes: 2048,
      } }],
    }],
  }));
  const data = await dataPromise;
  const usage = data.resources.get("project-a");
  assert.equal(usage?.cpu_millicores, 60);
  assert.equal(usage?.memory_bytes, 1536);
  assert.equal(usage?.persistent_storage_used_bytes, 2048);
  assert.equal(usage?.image_total_bytes, 4096);
  assert.ok(paths.includes("/v1/console/gallery?include_live_status=true"));
  assert.ok(paths.includes("/v1/apps?include_resource_usage=true&include_live_status=true"));
});

test("gallery rejects a failed resource source instead of publishing zero usage", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string | URL) => {
    if (new URL(String(url)).pathname === "/v1/apps") {
      return Response.json({ error: "resource source unavailable" }, { status: 503 });
    }
    return Response.json({ projects: [] });
  });
  await assert.rejects(getConsoleGalleryData("synthetic-key"), {
    status: 503,
    message: "resource source unavailable",
  });
});
