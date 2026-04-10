import { buildOriginUrl } from "@/lib/auth/origin";

export const AUTH_ERROR_OAUTH_DENIED = "oauth_denied";
export const AUTH_ERROR_OAUTH_FAILED = "oauth_failed";
export const AUTH_ERROR_INVALID_CREDENTIALS = "invalid-credentials";
export const AUTH_ERROR_INVALID_TOKEN = "invalid-token";
export const AUTH_ERROR_SESSION_OPEN_FAILED = "session-open-failed";
export const AUTH_ERROR_HANDOFF_FAILED = "handoff-failed";
export const AUTH_ERROR_AUTH_REQUIRED = "auth-required";
export const AUTH_ERROR_ACCOUNT_BLOCKED = "account-blocked";
export const AUTH_ERROR_ACCOUNT_DELETED = "account-deleted";

export type AuthErrorCode =
  | typeof AUTH_ERROR_OAUTH_DENIED
  | typeof AUTH_ERROR_OAUTH_FAILED
  | typeof AUTH_ERROR_INVALID_CREDENTIALS
  | typeof AUTH_ERROR_INVALID_TOKEN
  | typeof AUTH_ERROR_SESSION_OPEN_FAILED
  | typeof AUTH_ERROR_HANDOFF_FAILED
  | typeof AUTH_ERROR_AUTH_REQUIRED
  | typeof AUTH_ERROR_ACCOUNT_BLOCKED
  | typeof AUTH_ERROR_ACCOUNT_DELETED;

export function buildSignInErrorUrl(
  origin: string,
  error: AuthErrorCode,
  provider?: "github" | "google",
) {
  const url = buildOriginUrl(origin, "/auth/sign-in");
  url.searchParams.set("error", error);

  if (provider) {
    url.searchParams.set("provider", provider);
  }

  return url;
}
