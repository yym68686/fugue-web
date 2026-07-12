import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  appendLocalizedPageVary,
  PRIVATE_PAGE_CACHE_CONTROL,
} from "@/lib/site/page-response-policy";

/**
 * Every rendered document depends on the request locale and may also depend on
 * authentication cookies. Keep those documents out of shared caches. Static
 * assets, metadata files, health checks, and Route Handlers retain their own
 * deliberately scoped cache policy.
 */
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set("Cache-Control", PRIVATE_PAGE_CACHE_CONTROL);
  response.headers.set("Vary", appendLocalizedPageVary(response.headers.get("Vary")));

  return response;
}

export const config = {
  matcher: [
    "/((?!api|healthz|auth/finalize/complete|_next/static|_next/image|robots\\.txt|sitemap\\.xml|.*\\.[^/]+$).*)",
  ],
};
