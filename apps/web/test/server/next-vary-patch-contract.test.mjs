import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dir, "../../../..");

function readWorkspaceFile(relativePath) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

describe("Next App Router Vary patch", () => {
  test("pins the patch in Bun and makes it available to the container install", () => {
    const rootPackage = JSON.parse(readWorkspaceFile("package.json"));
    const dockerfile = readWorkspaceFile("Dockerfile");

    expect(rootPackage.patchedDependencies).toEqual({
      "next@16.2.10": "patches/next@16.2.10.patch",
    });
    expect(dockerfile).toContain("COPY patches ./patches");
    expect(dockerfile.indexOf("COPY patches ./patches")).toBeLessThan(
      dockerfile.indexOf("RUN bun install --frozen-lockfile"),
    );
  });

  test("merges rather than overwrites or duplicates application Vary fields", () => {
    const patch = readWorkspaceFile("patches/next@16.2.10.patch");

    expect(patch).toContain("res.getHeader('Vary')");
    expect(patch).toContain("varyFields.set(normalized.toLowerCase(), normalized)");
    expect(patch).toContain("res.setHeader('Vary'");
    expect(patch).not.toContain("+        res.appendHeader('Vary', varyHeader)");
    expect(patch.match(/dist\/(?:esm\/)?build\/templates\/app-page\.js/g)).toHaveLength(
      8,
    );
  });

  test("records upstream ownership and a testable removal condition", () => {
    const decision = readWorkspaceFile(
      "docs/adr/0002-next-app-router-vary-header-patch.md",
    );

    expect(decision).toContain("vercel/next.js/issues/85852");
    expect(decision).toContain("vercel/next.js/issues/85999");
    expect(decision).toContain("## Removal condition");
    expect(decision).toContain("browser/container matrix");
  });
});
