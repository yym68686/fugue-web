import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";

import {
  appendLocalizedPageVary,
  PRIVATE_PAGE_CACHE_CONTROL,
} from "../../lib/site/page-response-policy";
import { proxy } from "../../proxy";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalCanonicalHostTrust = process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS;
const originalAuthProxyTrust = process.env.AUTH_TRUST_PROXY_HEADERS;

afterEach(() => {
  if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = originalAppBaseUrl;
  if (originalCanonicalHostTrust === undefined) {
    delete process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS;
  } else {
    process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS = originalCanonicalHostTrust;
  }
  if (originalAuthProxyTrust === undefined) {
    delete process.env.AUTH_TRUST_PROXY_HEADERS;
  } else {
    process.env.AUTH_TRUST_PROXY_HEADERS = originalAuthProxyTrust;
  }
});

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

  test("permanently redirects rendered alternate hosts to the configured origin", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    const response = proxy(
      new NextRequest("https://web.fugue.example/docs?source=alternate", {
        headers: { host: "web.fugue.example" },
      }),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://fugue.example/docs?source=alternate",
    );
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  test("does not redirect a request already on the configured host", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    const response = proxy(
      new NextRequest("https://fugue.example/docs", {
        headers: { host: "fugue.example" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test("accepts the canonical forwarded host behind the Fugue runtime proxy", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS = "true";
    const response = proxy(
      new NextRequest("http://app-runtime.internal/docs", {
        headers: {
          host: "app-runtime.internal",
          "x-forwarded-host": "FUGUE.EXAMPLE",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test("redirects an alternate forwarded host behind the Fugue runtime proxy", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS = "true";
    const response = proxy(
      new NextRequest("http://app-runtime.internal/docs?source=alternate", {
        headers: {
          host: "app-runtime.internal",
          "x-forwarded-host": "web.fugue.example",
        },
      }),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://fugue.example/docs?source=alternate",
    );
  });

  test("ignores a forged forwarded host when the direct host is canonical", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS = "true";
    const response = proxy(
      new NextRequest("https://fugue.example/app", {
        headers: {
          host: "fugue.example",
          "x-forwarded-host": "attacker.example",
        },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://fugue.example/auth/sign-in?returnTo=%2Fapp",
    );
  });

  test("rejects ambiguous forwarded-host chains", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS = "true";
    const response = proxy(
      new NextRequest("http://app-runtime.internal/docs", {
        headers: {
          host: "app-runtime.internal",
          "x-forwarded-host": "fugue.example, attacker.example",
        },
      }),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://fugue.example/docs");
  });

  test("does not trust a canonical forwarded host without an explicit proxy boundary", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS = "false";
    const response = proxy(
      new NextRequest("http://app-runtime.internal/docs", {
        headers: {
          host: "app-runtime.internal",
          "x-forwarded-host": "fugue.example",
        },
      }),
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://fugue.example/docs");
  });

  test("inherits the existing trusted-proxy boundary when no host override is set", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    delete process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS;
    process.env.AUTH_TRUST_PROXY_HEADERS = "true";
    const response = proxy(
      new NextRequest("http://app-runtime.internal/docs", {
        headers: {
          host: "app-runtime.internal",
          "x-forwarded-host": "fugue.example",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test("normalizes the canonical HTTPS default port and IPv6 authority", () => {
    process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS = "true";

    process.env.APP_BASE_URL = "https://fugue.example";
    const defaultPortResponse = proxy(
      new NextRequest("http://app-runtime.internal/docs", {
        headers: {
          host: "app-runtime.internal",
          "x-forwarded-host": "fugue.example:443",
        },
      }),
    );
    expect(defaultPortResponse.status).toBe(200);

    process.env.APP_BASE_URL = "https://[2001:db8::1]";
    const ipv6Response = proxy(
      new NextRequest("http://app-runtime.internal/docs", {
        headers: {
          host: "app-runtime.internal",
          "x-forwarded-host": "[2001:db8::1]:443",
        },
      }),
    );
    expect(ipv6Response.status).toBe(200);
  });

  test("keeps network-path-looking page paths on the configured origin", () => {
    process.env.APP_BASE_URL = "https://fugue.example";
    const response = proxy(
      new NextRequest("https://web.fugue.example//attacker.example/docs?source=test", {
        headers: { host: "web.fugue.example" },
      }),
    );

    const location = new URL(response.headers.get("location") as string);
    expect(location.origin).toBe("https://fugue.example");
    expect(location.pathname).toBe("//attacker.example/docs");
    expect(location.search).toBe("?source=test");
  });

  test("passes the documented canonical proxy trust override through Compose", () => {
    const compose = readFileSync(
      new URL("../../../../docker-compose.yml", import.meta.url),
      "utf8",
    );
    const exampleEnvironment = readFileSync(
      new URL("../../../../.env.example", import.meta.url),
      "utf8",
    );

    expect(exampleEnvironment).toContain("CANONICAL_HOST_TRUST_PROXY_HEADERS=");
    expect(compose).toContain(
      "CANONICAL_HOST_TRUST_PROXY_HEADERS: ${CANONICAL_HOST_TRUST_PROXY_HEADERS:-}",
    );
  });

  test("keeps the matcher literal and excludes scoped non-page responses", () => {
    const source = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8");

    expect(source).toContain("export function proxy");
    expect(source).toContain('response.headers.set("Cache-Control"');
    expect(source).toContain('"Vary"');
    expect(source).toContain("readVersionedSessionToken(sessionToken)");
    expect(source).toContain("readRequestOrigin(request)");
    expect(source).toContain("readConfiguredCanonicalOrigin()");
    expect(source).toContain("NextResponse.redirect(canonicalPageRedirect, 308)");
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
