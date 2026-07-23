// Maps auth error codes (from OAuth redirects / handoff) to a user-facing
// message. Values are English source strings that double as i18n keys; callers
// pass the result through t() so the active locale's catalog can localize it.
const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Third-party sign-in was cancelled.",
  oauth_failed: "Third-party sign-in failed. Please try again.",
  "invalid-credentials": "Incorrect email or password.",
  "invalid-token":
    "This sign-in link is invalid or has expired. Please request a new one.",
  "session-open-failed": "Couldn't open a session. Please try again.",
  "handoff-failed": "Sign-in couldn't be completed. Please try again.",
  "auth-required": "Please sign in to continue.",
  "account-blocked": "This account has been blocked.",
  "account-deleted": "This account has been deleted.",
};

const FALLBACK_MESSAGE = "Something went wrong during sign-in. Please try again.";

/**
 * Resolve an auth error code to its English source message (an i18n key), or
 * undefined when no code is present. Callers wrap the result in t() to localize.
 */
export function readAuthErrorMessage(
  error?: string | string[],
): string | undefined {
  const code = Array.isArray(error) ? error[0] : error;
  if (!code) return undefined;
  return ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
