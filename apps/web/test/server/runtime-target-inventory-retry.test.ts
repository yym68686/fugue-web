import assert from "node:assert/strict";
import test from "node:test";

import {
  readRuntimeTargetRetryDelayMs,
  scheduleRuntimeTargetInventoryRetry,
  shouldRetryRuntimeTargetInventory,
  type RuntimeTargetRetryScheduler,
  type RuntimeTargetRetryTimer,
} from "../../lib/console/runtime-target-inventory-retry";
import { RequestError } from "../../lib/ui/request-json";

class FakeTimer {
  private now = 0;
  private nextId = 1;
  private readonly tasks = new Map<number, { callback: () => void; runAt: number }>();

  readonly schedule: RuntimeTargetRetryScheduler = (callback, delayMs) => {
    const id = this.nextId;
    this.nextId += 1;
    this.tasks.set(id, { callback, runAt: this.now + delayMs });
    return id as unknown as RuntimeTargetRetryTimer;
  };

  advanceBy(milliseconds: number) {
    this.now += milliseconds;
    const ready = Array.from(this.tasks.entries())
      .filter(([, task]) => task.runAt <= this.now)
      .sort((left, right) => left[1].runAt - right[1].runAt);

    for (const [id, task] of ready) {
      this.tasks.delete(id);
      task.callback();
    }
  }
}

test("runtime inventory retries only network, 408, 429, and 5xx failures", () => {
  assert.equal(shouldRetryRuntimeTargetInventory(new TypeError("fetch failed")), true);

  for (const status of [408, 429, 500, 502, 503, 599]) {
    assert.equal(
      shouldRetryRuntimeTargetInventory(new RequestError("failed", status, null)),
      true,
      `expected ${status} to retry`,
    );
  }

  for (const status of [400, 401, 403, 404, 409, 413, 415, 422]) {
    assert.equal(
      shouldRetryRuntimeTargetInventory(new RequestError("failed", status, null)),
      false,
      `expected ${status} not to retry`,
    );
  }
});

test("runtime inventory limits retries to the configured schedule", () => {
  const error = new RequestError("unavailable", 503, null);

  assert.equal(readRuntimeTargetRetryDelayMs(error, 0), 1_000);
  assert.equal(readRuntimeTargetRetryDelayMs(error, 1), 3_000);
  assert.equal(readRuntimeTargetRetryDelayMs(error, 2), null);
});

test("429 retry uses the maximum of backoff and Retry-After with fake time", () => {
  const timer = new FakeTimer();
  let calls = 0;
  const error = new RequestError("rate limited", 429, 7);
  const scheduled = scheduleRuntimeTargetInventoryRetry(
    error,
    0,
    () => {
      calls += 1;
    },
    timer.schedule,
  );

  assert.notEqual(scheduled, null);
  assert.equal(readRuntimeTargetRetryDelayMs(error, 0), 7_000);

  timer.advanceBy(6_999);
  assert.equal(calls, 0);

  timer.advanceBy(1);
  assert.equal(calls, 1);

  assert.equal(
    readRuntimeTargetRetryDelayMs(new RequestError("rate limited", 429, 1), 1),
    3_000,
  );
});

test("non-retryable validation errors do not schedule fake timers", () => {
  const timer = new FakeTimer();
  const scheduled = scheduleRuntimeTargetInventoryRetry(
    new RequestError("invalid filter", 422, null),
    0,
    () => {
      throw new Error("must not run");
    },
    timer.schedule,
  );

  assert.equal(scheduled, null);
  timer.advanceBy(60_000);
});
