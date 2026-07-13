import "server-only";

import { readConfiguredCanonicalOrigin } from "@/lib/auth/origin";

export const DEFAULT_PUBLIC_ORIGIN = "https://web.fugue.pro";

export function getCanonicalPublicOrigin() {
  return readConfiguredCanonicalOrigin() ?? DEFAULT_PUBLIC_ORIGIN;
}

export function absolutePublicUrl(pathname: string) {
  return new URL(pathname, getCanonicalPublicOrigin());
}
