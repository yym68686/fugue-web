import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { PAGE_RETURN_TO_HEADER } from "@/lib/auth/page-request-context";

const CONSOLE_PREFIXES = [
  "/projects",
  "/keys",
  "/servers",
  "/billing",
  "/admin",
];

function isConsolePath(pathname: string) {
  return CONSOLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function readPageReturnTo(request: NextRequest) {
  const searchParams = new URLSearchParams(request.nextUrl.searchParams);
  searchParams.delete("_rsc");
  const search = searchParams.toString();
  return `${request.nextUrl.pathname}${search ? `?${search}` : ""}`;
}

// The per-page requireActivePageSession() guard reads this header to build the
// post-login returnTo. We only forward it for console routes so unauthenticated
// visitors land back on the page they requested after signing in.
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(PAGE_RETURN_TO_HEADER);

  if (isConsolePath(request.nextUrl.pathname)) {
    requestHeaders.set(PAGE_RETURN_TO_HEADER, readPageReturnTo(request));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/projects/:path*", "/keys/:path*", "/servers/:path*", "/billing/:path*", "/admin/:path*"],
};
