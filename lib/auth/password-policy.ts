// Single source of truth for the password rules. Both the server validator
// (lib/auth/password.ts) and the sign-up / change-password forms read these, so
// the hint the user sees can never drift from the rule that is enforced.
//
// This module is deliberately free of "server-only" and of any Node built-in so
// client components can import the constants directly.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

/** i18n key for the inline hint under a new-password field. */
export const PASSWORD_MIN_LENGTH_HINT_KEY = "At least {min} characters.";

/** i18n key matching the server's too-short message. */
export const PASSWORD_TOO_SHORT_KEY = "Use at least {min} characters.";

/** i18n key matching the server's too-long message. */
export const PASSWORD_TOO_LONG_KEY = "Passwords must stay under {max} characters.";

/**
 * The exact English strings the API returns. Kept in sync with the i18n keys
 * above by construction, so translating a server error is a lookup, not a
 * second hard-coded copy of the number.
 */
export const PASSWORD_TOO_SHORT_MESSAGE = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
export const PASSWORD_TOO_LONG_MESSAGE = `Passwords must stay under ${PASSWORD_MAX_LENGTH} characters.`;
export const PASSWORD_EMPTY_MESSAGE = "Enter a password.";

/**
 * Validate a candidate password against the policy. Returns the English
 * user-facing message, or null when the password is acceptable.
 *
 * Used by the API routes and by the forms before submitting, so a password that
 * the form accepts is always one the server accepts too.
 */
export function checkPasswordPolicy(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_TOO_SHORT_MESSAGE;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return PASSWORD_TOO_LONG_MESSAGE;
  }

  if (!password.trim()) {
    return PASSWORD_EMPTY_MESSAGE;
  }

  return null;
}
