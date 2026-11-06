import assert from "node:assert/strict";
import test from "node:test";
import { ConsoleResponseError, readConsoleResult } from "@/lib/console/response";

test("console mutations return confirmed results, including secret-bearing key creation", async () => {
  const result = { key: { id: "key-test" }, secret: "synthetic-secret" };
  assert.deepEqual(await readConsoleResult(Response.json({ ok: true, result })), result);
});

test("HTML proxy failures never expose parse errors or raw upstream contents", async () => {
  for (const status of [502, 503, 504]) {
    await assert.rejects(readConsoleResult(new Response("<html>private proxy diagnostics</html>", { status })),
      (error: unknown) => error instanceof ConsoleResponseError && error.status === status && error.message === "The service is temporarily unavailable. Try again.");
  }
});

test("invalid successful responses never masquerade as completed mutations", async () => {
  for (const body of ["", "<html>sign in</html>", "null", "[]", "{}", '{"ok":true}', '{"ok":false}']) {
    await assert.rejects(readConsoleResult(new Response(body)), ConsoleResponseError);
  }
});

test("structured API errors keep useful client messages and redact credentials", async () => {
  await assert.rejects(readConsoleResult(Response.json({ error: "Choose at least one scope." }, { status: 400 })), /Choose at least one scope/);
  await assert.rejects(readConsoleResult(Response.json({ error: "token=private-test-value" }, { status: 403 })),
    (error: unknown) => error instanceof ConsoleResponseError && !error.message.includes("private-test-value"));
  await assert.rejects(readConsoleResult(Response.json({ error: "database diagnostics" }, { status: 500 })),
    (error: unknown) => error instanceof ConsoleResponseError && !error.message.includes("database diagnostics"));
});

test("expired sessions, redirected sign-in pages and plain rejection responses are actionable", async () => {
  await assert.rejects(readConsoleResult(new Response("sign in", { status: 401 })), /Sign in again/);
  const redirected = new Response("<html>sign in</html>");
  Object.defineProperty(redirected, "redirected", { value: true });
  await assert.rejects(readConsoleResult(redirected), /Sign in again/);
  await assert.rejects(readConsoleResult(new Response("Forbidden", { status: 403 })), /Request was rejected/);
});

test("an unbounded error response is cancelled without leaking contents", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new TextEncoder().encode("<html>".repeat(3000))); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readConsoleResult(new Response(stream, { status: 502 })), ConsoleResponseError);
  assert.equal(cancelled, true);
});
