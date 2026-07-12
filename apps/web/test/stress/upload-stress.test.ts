import { test } from "bun:test";

test("two bounded uploads preserve health responsiveness and clean temporary files", async () => {
  await import("../../scripts/upload-stress");
}, 30_000);
