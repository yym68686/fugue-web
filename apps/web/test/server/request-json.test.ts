import assert from "node:assert/strict";
import test from "node:test";

import {
  readResponseError,
  readRequestError,
  readRequestErrorStatus,
  RequestError,
  requestJson,
} from "../../lib/ui/request-json";
import { PUBLIC_SERVER_ERROR } from "../../lib/security/public-error.mjs";
import { PUBLIC_ERROR_BODY_MAX_BYTES } from "../../lib/security/read-bounded-response-body";

test("requestJson preserves upload status and Retry-After metadata", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "Upload capacity is busy." }), {
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "7",
      },
      status: 429,
    })) as unknown as typeof fetch;

  try {
    await assert.rejects(requestJson("http://localhost/upload"), (error) => {
      assert.ok(error instanceof RequestError);
      assert.equal(error.status, 429);
      assert.equal(error.retryAfterSeconds, 7);
      assert.equal(readRequestErrorStatus(error), 429);
      assert.equal(
        readRequestError(error),
        "Upload capacity is busy. Try again in 7 seconds.",
      );
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requestJson preserves stable 413 and 415 statuses", async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const status of [413, 415]) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: `Upload rejected with ${status}.` }), {
          headers: { "Content-Type": "application/json" },
          status,
        })) as unknown as typeof fetch;

      await assert.rejects(requestJson("http://localhost/upload"), (error) => {
        assert.ok(error instanceof RequestError);
        assert.equal(error.status, status);
        assert.equal(readRequestErrorStatus(error), status);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("readResponseError bounds and redacts non-JSON 4xx responses", async () => {
  const secret = "topsecret-token-value-1234567890";
  const response = new Response(
    `Invalid request. Authorization: Bearer ${secret} ${"x".repeat(500)}`,
    { status: 400 },
  );
  const message = await readResponseError(response);

  assert.match(message, /^Invalid request\./);
  assert.match(message, /Bearer \[redacted\]/);
  assert.doesNotMatch(message, new RegExp(secret));
  assert.ok(Array.from(message).length <= 240);
});

test("readResponseError returns one stable message for non-JSON 5xx responses", async () => {
  const response = new Response(
    "postgresql://admin:database-secret@db.internal/fugue",
    { status: 502 },
  );

  assert.equal(await readResponseError(response), PUBLIC_SERVER_ERROR);
});

test("readRequestError does not expose unknown exception messages", () => {
  assert.equal(
    readRequestError(new Error("internal database detail")),
    "Request failed.",
  );
});

test("readResponseError cancels oversized streaming bodies at 64 KiB", async () => {
  const encoder = new TextEncoder();
  let cancelled = false;
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
    pull(controller) {
      pulls += 1;
      controller.enqueue(
        encoder.encode(
          pulls === 1
            ? `Invalid request. ${"x".repeat(PUBLIC_ERROR_BODY_MAX_BYTES + 1)}`
            : "Bearer secret-from-unbounded-tail-1234567890",
        ),
      );
    },
  });
  const message = await readResponseError(new Response(body, { status: 400 }));

  assert.equal(cancelled, true);
  assert.equal(pulls, 1);
  assert.match(message, /^Invalid request\./);
  assert.ok(Array.from(message).length <= 240);
  assert.doesNotMatch(message, /unbounded-tail/u);
});
