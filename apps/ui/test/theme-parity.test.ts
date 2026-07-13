import { expect, test } from "bun:test";

import { validateThemeParity } from "../scripts/validate-theme-parity";

test("registry style and font metadata match the runtime package", async () => {
  const result = await validateThemeParity();
  expect(result.errors).toEqual([]);
  expect(result.semanticTokenCount).toBeGreaterThan(20);
  expect(result.fontCount).toBe(3);
});
