import assert from "node:assert/strict";
import test from "node:test";
import { mutateObjectStore } from "@/lib/fugue/console";

test("R2 creation remains compatible with older Fugue API replicas", async (t) => {
  const previousApiUrl = process.env.FUGUE_API_URL;
  process.env.FUGUE_API_URL = "https://api.example.test";
  t.after(() => {
    if (previousApiUrl === undefined) delete process.env.FUGUE_API_URL;
    else process.env.FUGUE_API_URL = previousApiUrl;
  });
  const bodies: unknown[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return Response.json({ store: {} });
  });
  const body = { project_id: "project", name: "archive", quota_bytes: 0 };
  await mutateObjectStore("key", "create", { ...body, provider: "cloudflare-r2" });
  await mutateObjectStore("key", "create", { ...body, provider: "backblaze-b2" });
  await assert.rejects(mutateObjectStore("key", "create", { ...body, provider: "unknown" }), /Unsupported object storage provider/);
  assert.deepEqual(bodies, [body, { ...body, provider: "backblaze-b2" }]);
});
