import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeLongTasks } from "../lib/page-navigation-timing";

test("long task metrics count only the part overlapping this navigation", () => {
  assert.deepEqual(summarizeLongTasks([
    { startTime: 0, duration: 50 },
    { startTime: 80, duration: 80 },
    { startTime: 180, duration: 100 },
    { startTime: 300, duration: 100 },
  ], 100, 250), { count: 2, totalMs: 130, maxMs: 70 });
  assert.deepEqual(summarizeLongTasks([], 100, 250), { count: 0, totalMs: 0, maxMs: 0 });
});
