import assert from "node:assert/strict";
import test from "node:test";

import { createExpiringAsyncCache } from "../../lib/server/expiring-async-cache";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

test("deduplicates concurrent loaders for the same key", async () => {
  const cache = createExpiringAsyncCache<string>(60_000);
  const load = deferred<string>();
  let calls = 0;
  const loader = () => {
    calls += 1;
    return load.promise;
  };

  const first = cache.getOrLoad("tenant", loader);
  const second = cache.getOrLoad("tenant", loader);

  assert.equal(calls, 1);
  load.resolve("current");
  assert.equal(await first, "current");
  assert.equal(await second, "current");
  assert.equal(cache.read("tenant"), "current");
});

test("clear prevents an older in-flight loader from reviving stale data", async () => {
  const cache = createExpiringAsyncCache<string>(60_000);
  const oldLoad = deferred<string>();
  const newLoad = deferred<string>();

  const oldRequest = cache.getOrLoad("tenant", () => oldLoad.promise);
  cache.clear("tenant");
  const newRequest = cache.getOrLoad("tenant", () => newLoad.promise);

  newLoad.resolve("new");
  assert.equal(await newRequest, "new");
  oldLoad.resolve("old");
  assert.equal(await oldRequest, "old");
  assert.equal(cache.read("tenant"), "new");
});

test("clearAll invalidates every older in-flight loader", async () => {
  const cache = createExpiringAsyncCache<string>(60_000);
  const firstLoad = deferred<string>();
  const secondLoad = deferred<string>();

  const firstRequest = cache.getOrLoad("first", () => firstLoad.promise);
  const secondRequest = cache.getOrLoad("second", () => secondLoad.promise);
  cache.clearAll();

  firstLoad.resolve("stale-first");
  secondLoad.resolve("stale-second");
  await Promise.all([firstRequest, secondRequest]);

  assert.equal(cache.read("first"), null);
  assert.equal(cache.read("second"), null);
});

test("an explicit set cannot be overwritten by an older loader", async () => {
  const cache = createExpiringAsyncCache<string>(60_000);
  const oldLoad = deferred<string>();
  const oldRequest = cache.getOrLoad("tenant", () => oldLoad.promise);

  cache.set("tenant", "explicit");
  oldLoad.resolve("old");
  assert.equal(await oldRequest, "old");
  assert.equal(cache.read("tenant"), "explicit");
});

test("a synchronous loader error does not poison later reads", async () => {
  const cache = createExpiringAsyncCache<string>(60_000);

  await assert.rejects(
    cache.getOrLoad("tenant", () => {
      throw new Error("boom");
    }),
    /boom/,
  );

  assert.equal(await cache.getOrLoad("tenant", async () => "recovered"), "recovered");
  assert.equal(cache.read("tenant"), "recovered");
});
