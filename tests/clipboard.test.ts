import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { copyText } from "@/lib/ui/clipboard";

function browserFixture(t: TestContext, clipboard: unknown, fallbackResult: boolean | Error = true) {
  const calls: string[] = [];
  class Element {
    focus() { calls.push("restore focus"); }
  }
  const field = {
    value: "", readOnly: false, style: {},
    focus() { calls.push("focus"); },
    select() { calls.push("select"); },
    remove() { calls.push("remove"); },
  };
  const replacements = {
    navigator: { clipboard },
    HTMLElement: Element,
    document: {
      activeElement: new Element(),
      createElement: () => field,
      body: { appendChild() { calls.push("append"); } },
      execCommand(command: string) {
        calls.push(command);
        if (fallbackResult instanceof Error) throw fallbackResult;
        return fallbackResult;
      },
    },
  };
  for (const [key, value] of Object.entries(replacements)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  return { calls, field };
}

test("copies the complete secret through the modern clipboard API", async (t) => {
  const written: string[] = [];
  const { calls } = browserFixture(t, { writeText: async (value: string) => { written.push(value); } });
  assert.equal(await copyText("synthetic-full-secret"), true);
  assert.deepEqual(written, ["synthetic-full-secret"]);
  assert.deepEqual(calls, []);
});

for (const clipboard of [undefined, { writeText: async () => { throw new Error("permission denied"); } }]) {
  test("unavailable or denied clipboard falls back and removes the temporary secret", async (t) => {
    const { calls, field } = browserFixture(t, clipboard);
    assert.equal(await copyText("synthetic-full-secret"), true);
    assert.equal(field.value, "synthetic-full-secret");
    assert.equal(field.readOnly, true);
    assert.deepEqual(calls, ["append", "focus", "select", "copy", "remove", "restore focus"]);
  });
}

for (const failure of [false, new Error("copy unsupported")]) {
  test("failed fallback reports failure and still removes the secret field", async (t) => {
    const { calls } = browserFixture(t, undefined, failure);
    assert.equal(await copyText("synthetic-full-secret"), false);
    assert.deepEqual(calls.slice(-2), ["remove", "restore focus"]);
  });
}
