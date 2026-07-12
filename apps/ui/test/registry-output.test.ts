import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const appRoot = path.resolve(import.meta.dir, "..");

describe("installable registry output", () => {
  test("contains exactly one JSON artifact per current item plus the index", async () => {
    const registry = JSON.parse(
      await readFile(path.join(appRoot, "registry.json"), "utf8"),
    ) as { items: Array<{ name: string }> };
    const expected = [
      "registry.json",
      ...registry.items.map((item) => `${item.name}.json`),
    ].sort();
    const actual = (await readdir(path.join(appRoot, "public/r")))
      .filter((file) => file.endsWith(".json"))
      .sort();

    expect(actual).toEqual(expected);
  });
});
