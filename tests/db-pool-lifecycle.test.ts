import assert from "node:assert/strict";
import { test } from "node:test";
import { getDbPool } from "../lib/db/pool";

test("idle database failure is observed without crashing or exposing error details", async (t) => {
  const previousUrl = process.env.DATABASE_URL;
  const previousPool = globalThis.__fuguePgPool;
  process.env.DATABASE_URL = "postgresql://unused@127.0.0.1:1/unused";
  globalThis.__fuguePgPool = undefined;
  const logs: string[] = [];
  t.mock.method(console, "error", (value: string) => logs.push(value));
  const pool = getDbPool();
  try {
    const error = Object.assign(new Error("private database connection details"), { code: "57P01" });
    assert.doesNotThrow(() => pool.emit("error", error));
    assert.deepEqual(JSON.parse(logs[0]), { event: "fugue_web_database_idle_error", code: "57P01" });
    assert.equal(logs.join("").includes("private"), false);
  } finally {
    await pool.end();
    globalThis.__fuguePgPool = previousPool;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
