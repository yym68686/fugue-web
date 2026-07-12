import { describe, expect, test } from "bun:test";

import { normalizeTemplateRouteSlug } from "../../lib/deploy/template-route-slug";

describe("template route slug normalization", () => {
  test("decodes a Unicode path segment before canonicalizing it", () => {
    const value = `项目-🚀-${"跨区域运行时".repeat(14)}`;

    expect(normalizeTemplateRouteSlug(encodeURIComponent(value))).toEqual({
      slug: value,
      redirectPath: null,
    });
  });

  test("redirects decoded mixed-case and surrounding whitespace once", () => {
    expect(normalizeTemplateRouteSlug(encodeURIComponent("  Next-Starter  "))).toEqual({
      slug: "next-starter",
      redirectPath: "/new/template/next-starter",
    });
  });

  test("rejects malformed encodings and values that escape one path segment", () => {
    expect(normalizeTemplateRouteSlug("%E0%A4%A")).toBeNull();
    expect(normalizeTemplateRouteSlug(encodeURIComponent("../secret"))).toBeNull();
    expect(normalizeTemplateRouteSlug(encodeURIComponent("line\nbreak"))).toBeNull();
  });
});
