import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  appendLocalizedPageVary,
  PRIVATE_PAGE_CACHE_CONTROL,
} from "../../lib/site/page-response-policy";

describe("rendered page response policy", () => {
  test("keeps localized and authenticated documents out of shared caches", () => {
    expect(PRIVATE_PAGE_CACHE_CONTROL).toBe(
      "private, no-store, no-cache, max-age=0, must-revalidate",
    );
    expect(appendLocalizedPageVary(null)).toBe("Accept-Language, Cookie");
  });

  test("preserves existing Vary fields without duplicates", () => {
    expect(appendLocalizedPageVary("RSC, cookie, Accept-Encoding")).toBe(
      "RSC, Cookie, Accept-Encoding, Accept-Language",
    );
  });

  test("keeps the matcher literal and excludes scoped non-page responses", () => {
    const source = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");

    expect(source).toContain("export function proxy");
    expect(source).toContain('response.headers.set("Cache-Control"');
    expect(source).toContain('"Vary"');
    expect(source).toContain("readVersionedSessionToken(sessionToken)");
    expect(source).toContain("readRequestOrigin(request)");
    expect(source).toContain("NextResponse.redirect(signInUrl, 307)");
    expect(source).toContain('searchParams.delete("_rsc")');
    expect(source).toContain("requestHeaders.delete(PAGE_RETURN_TO_HEADER)");
    expect(source).toContain("requestHeaders.set(PAGE_RETURN_TO_HEADER, returnTo)");
    expect(source).toContain('"/app/:path*"');
    expect(source).toContain(
      '"/((?!api|healthz|auth/finalize/complete|_next/static|_next/image|robots\\\\.txt|sitemap\\\\.xml|.*\\\\.[^/]+$).*)"',
    );
  });
});
