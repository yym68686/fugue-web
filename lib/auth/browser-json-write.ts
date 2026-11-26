import { normalizeAuthOrigin } from "@/lib/auth/origin";

/** Authorize only a browser's own origin, including a configured site's aliases. */
export function isSameOriginJsonWrite(request: Request, canonicalOrigin: string) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || normalizeAuthOrigin(origin) !== origin ||
      request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return false;
  }
  // Browsers, not page scripts, set Sec-Fetch-Site. Do not accept "same-site"
  // (a sibling origin) or guess from spoofable forwarded headers. Older
  // browsers without Fetch Metadata can still use the canonical public origin.
  return fetchSite === "same-origin" || (fetchSite === null && origin === canonicalOrigin);
}
