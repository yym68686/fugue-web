import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { FugueApiError } from "../lib/fugue/console";
import { mailNoStore, readMailMutation } from "../lib/fugue/mail-route";

const url = "https://console.example.test/api/console/apps/app-test/mail";
function publicOrigin(t: TestContext) {
  const previous = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "https://console.example.test";
  t.after(() => {
    if (previous === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previous;
  });
}
test("mail mutations reject missing and foreign origins before reading a body", async (t) => {
  publicOrigin(t);
  for (const origin of [null, "https://foreign.example.test"]) {
    const request = new Request(url, { method: "PUT", headers: origin ? { origin } : {}, body: "{}" });
    await assert.rejects(readMailMutation(request), (error: unknown) => error instanceof FugueApiError && error.status === 403);
  }
});
test("mail mutations require a bounded JSON object, including chunked bodies", async (t) => {
  publicOrigin(t);
  const headers = { origin: new URL(url).origin };
  assert.deepEqual(await readMailMutation(new Request(url, { method: "PUT", headers, body: '{"state":"active"}' })), { state: "active" });
  for (const body of ["[]", "null", "not-json"]) {
    await assert.rejects(readMailMutation(new Request(url, { method: "PUT", headers, body })), (error: unknown) => error instanceof FugueApiError && error.status === 400);
  }
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(9000)); }, cancel() { cancelled = true; } });
  const request = new Request(url, { method: "PUT", headers, body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readMailMutation(request), (error: unknown) => error instanceof FugueApiError && error.status === 413);
  assert.equal(cancelled, true);
  assert.equal(mailNoStore(new Response()).headers.get("cache-control"), "no-store");
});

test("mutation origin checks use the configured public URL behind an internal HTTP proxy", async (t) => {
  publicOrigin(t);
  const internal = "http://0.0.0.0:3000/api/console/keys";
  const request = new Request(internal, { method: "POST", headers: { origin: "https://console.example.test" }, body: "{}" });
  assert.deepEqual(await readMailMutation(request), {});
  for (const origin of ["http://0.0.0.0:3000", "https://foreign.example.test"]) {
    const request = new Request(internal, { method: "POST", headers: { origin, "x-forwarded-host": "console.example.test", "x-forwarded-proto": "https" }, body: "{}" });
    await assert.rejects(readMailMutation(request), (error: unknown) => error instanceof FugueApiError && error.status === 403);
  }
});
