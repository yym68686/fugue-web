import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readConfiguredCanonicalOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { PAGE_RETURN_TO_HEADER } from "@/lib/auth/page-request-context";
import { readVersionedSessionToken } from "@/lib/auth/session-claim";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { buildReturnToHref } from "@/lib/auth/validation";
import {
  appendLocalizedPageVary,
  PRIVATE_PAGE_CACHE_CONTROL,
} from "@/lib/site/page-response-policy";

function applyRenderedPagePolicy(response: NextResponse) {
  response.headers.set("Cache-Control", PRIVATE_PAGE_CACHE_CONTROL);
  response.headers.set("Vary", appendLocalizedPageVary(response.headers.get("Vary")));
  return response;
}

function isConsolePath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

function readPageReturnTo(request: NextRequest) {
  const searchParams = new URLSearchParams(request.nextUrl.searchParams);
  searchParams.delete("_rsc");
  const search = searchParams.toString();
  return `${request.nextUrl.pathname}${search ? `?${search}` : ""}`;
}

function normalizeRequestHost(value: string | null, protocol: string) {
  const host = value?.trim();
  if (!host || host.length > 255 || host.includes(",")) return null;

  try {
    const parsed = new URL(`${protocol}//${host}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

function trustsCanonicalForwardedHost() {
  const explicit = process.env.CANONICAL_HOST_TRUST_PROXY_HEADERS?.trim().toLowerCase();
  if (explicit) return explicit === "true";
  return process.env.AUTH_TRUST_PROXY_HEADERS?.trim().toLowerCase() === "true";
}

function readCanonicalPageRedirect(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const canonicalOrigin = readConfiguredCanonicalOrigin();
  if (!canonicalOrigin) return null;

  const canonicalUrl = new URL(canonicalOrigin);
  const canonicalHost = canonicalUrl.host.toLowerCase();
  const requestHost = normalizeRequestHost(
    request.headers.get("host") ?? request.nextUrl.host,
    canonicalUrl.protocol,
  );
  if (requestHost === canonicalHost) return null;

  // Fugue's edge deliberately replaces the upstream Host with the internal
  // runtime target and overwrites X-Forwarded-Host with the public route host.
  // This header can only suppress a redirect when it exactly matches the
  // server-configured canonical host; it never controls the redirect target or
  // authentication origin.
  if (trustsCanonicalForwardedHost()) {
    const forwardedHost = normalizeRequestHost(
      request.headers.get("x-forwarded-host"),
      canonicalUrl.protocol,
    );
    if (forwardedHost === canonicalHost) return null;
  }

  const redirectUrl = new URL(canonicalUrl);
  redirectUrl.pathname = request.nextUrl.pathname;
  redirectUrl.search = request.nextUrl.search;
  return redirectUrl;
}

/**
 * Every rendered document depends on the request locale and may also depend on
 * authentication cookies. Keep those documents out of shared caches. Static
 * assets, metadata files, health checks, and Route Handlers retain their own
 * deliberately scoped cache policy.
 */
export function proxy(request: NextRequest) {
  const canonicalPageRedirect = readCanonicalPageRedirect(request);
  if (canonicalPageRedirect) {
    return applyRenderedPagePolicy(NextResponse.redirect(canonicalPageRedirect, 308));
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const consolePath = isConsolePath(request.nextUrl.pathname);
  const returnTo = consolePath ? readPageReturnTo(request) : "/app";

  if (
    (request.method === "GET" || request.method === "HEAD") &&
    consolePath &&
    (!sessionToken || !readVersionedSessionToken(sessionToken))
  ) {
    const signInUrl = new URL(
      buildReturnToHref("/auth/sign-in", returnTo),
      readRequestOrigin(request),
    );

    return applyRenderedPagePolicy(NextResponse.redirect(signInUrl, 307));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(PAGE_RETURN_TO_HEADER);
  if (consolePath) requestHeaders.set(PAGE_RETURN_TO_HEADER, returnTo);

  return applyRenderedPagePolicy(
    NextResponse.next({ request: { headers: requestHeaders } }),
  );
}

export const config = {
  matcher: [
    "/app/:path*",
    "/((?!api|healthz|auth/finalize/complete|_next/static|_next/image|robots\\.txt|sitemap\\.xml|.*\\.[^/]+$).*)",
  ],
};
