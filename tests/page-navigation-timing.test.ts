import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeNavigationResources, summarizeResourceTiming } from "../lib/page-navigation-timing";

test("browser timing separates response waiting, transfer and rendering without recording URLs", () => {
  const timing = summarizeResourceTiming({
    startTime: 100, domainLookupStart: 110, domainLookupEnd: 115,
    connectStart: 115, secureConnectionStart: 130, connectEnd: 160,
    requestStart: 165, responseStart: 365, responseEnd: 415, encodedBodySize: 2048,
  }, 100, 445);
  assert.deepEqual(timing, {
    requestStartMs: 65, dnsMs: 5, connectMs: 45, tlsMs: 30,
    responseWaitMs: 200, responseReadMs: 50, afterResponseMs: 30, encodedBodyBytes: 2048,
  });
});

function resource(startTime: number, responseEnd: number) {
  return {
    startTime, domainLookupStart: startTime, domainLookupEnd: startTime,
    connectStart: startTime, connectEnd: startTime, secureConnectionStart: 0,
    requestStart: startTime + 5, responseStart: startTime + 20,
    responseEnd, encodedBodySize: 512,
  };
}

test("navigation evidence includes an overlapping prefetch and uses the last completion, not the last start", () => {
  const timing = summarizeNavigationResources([
    resource(190, 250), resource(80, 400), resource(20, 90), resource(210, 0),
  ], 100, 450);
  assert.equal(timing.completedMatchingResources, 2);
  assert.equal(timing.afterResponseMs, 50);
  assert.equal(timing.summarizedResource, "last-completed");
  assert.deepEqual(timing.resourceTimings.map(({ startMs, responseEndMs, beganBeforeNavigation }) =>
    ({ startMs, responseEndMs, beganBeforeNavigation })), [
    { startMs: -20, responseEndMs: 300, beganBeforeNavigation: true },
    { startMs: 90, responseEndMs: 150, beganBeforeNavigation: false },
  ]);
});

test("missing completed network evidence remains unknown", () => {
  const timing = summarizeNavigationResources([resource(10, 0), resource(20, 900)], 100, 500);
  assert.equal(timing.requestObserved, false);
  assert.equal(timing.completedMatchingResources, 0);
  assert.equal(timing.summarizedResource, null);
  assert.equal("requestStartMs" in timing, false);
});

test("request-chain diagnostics are bounded and cannot leak URLs or query values", () => {
  const input = Array.from({ length: 20 }, (_, i) => ({
    ...resource(i * 10, i * 10 + 30), name: "https://example.invalid/path?secret=private",
  }));
  const timing = summarizeNavigationResources(input, 0, 500);
  assert.equal(timing.completedMatchingResources, 20);
  assert.equal(timing.resourceTimings.length, 16);
  assert.equal(timing.resourceTimingsTruncated, true);
  assert.equal(JSON.stringify(timing).includes("private"), false);
  assert.equal(JSON.stringify(timing).includes("example.invalid"), false);
});
