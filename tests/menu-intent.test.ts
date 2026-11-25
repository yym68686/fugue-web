import assert from "node:assert/strict";
import test from "node:test";
import { followsSubmenu } from "@/lib/ui/menu-intent";

test("a mouse crossing toward the actual submenu edge stays in its triangle", () => {
  const left = { left: 10, right: 100, top: 40, bottom: 180 };
  const origin = { x: 160, y: 60 };
  assert.equal(followsSubmenu({ x: 130, y: 100 }, origin, left), true);
  assert.equal(followsSubmenu({ x: 130, y: 160 }, origin, left), false);
  assert.equal(followsSubmenu({ x: 170, y: 60 }, origin, left), false);
  const right = { left: 240, right: 340, top: 40, bottom: 180 };
  assert.equal(followsSubmenu({ x: 200, y: 108 }, origin, right), true);
  assert.equal(followsSubmenu({ x: 200, y: 30 }, origin, right), false);
});
