import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeResourceTiming } from "../lib/page-navigation-timing";

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
