// Auth APIs answer with English user-facing text in `{ error: "..." }`. The
// forms cannot translate arbitrary server text, so this module is the single
// allowlist: a server string listed here is rendered through the i18n catalog,
// anything else is shown verbatim (still correct, just untranslated).
//
// Messages that embed a policy number are matched via the policy constants
// rather than a second literal, so changing PASSWORD_MIN_LENGTH cannot silently
// break the translation.

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_LONG_KEY,
  PASSWORD_TOO_LONG_MESSAGE,
  PASSWORD_TOO_SHORT_KEY,
  PASSWORD_TOO_SHORT_MESSAGE,
} from "@/lib/auth/password-policy";
import type { TranslateFn, TranslationValues } from "@/lib/i18n/translate";
import {
  PUBLIC_ERROR_FALLBACK,
  PUBLIC_SERVER_ERROR,
} from "@/lib/security/public-error.mjs";

/** Server strings whose English text is itself the catalog key. */
export const KNOWN_SERVER_MESSAGES: readonly string[] = [
  // Everything the public-error sanitizer collapses 5xx/unknown errors into.
  PUBLIC_ERROR_FALLBACK,
  PUBLIC_SERVER_ERROR,
  "Account registration is temporarily unavailable.",
  "Authentication protection is temporarily unavailable. Try again.",
  "Authentication request payload is too large.",
  "Choose a new password.",
  "Current password is incorrect.",
  "Display name is too long.",
  "Email or password is incorrect.",
  "Email verification is temporarily unavailable. Try again.",
  "Enter a password.",
  "Enter a valid email address.",
  "Enter your current password.",
  "Fugue could not open the workspace session. Try again.",
  "GitHub sign-in is not configured.",
  "GitHub sign-in is temporarily unavailable. Try again.",
  "Google sign-in is not configured.",
  "Google sign-in is temporarily unavailable. Try again.",
  "If this address can be registered, check your email for a verification link.",
  "Invalid request payload.",
  "Keep at least one sign-in method on the account.",
  "Password added.",
  "Password updated.",
  "Passwords do not match.",
  "Session user is no longer active.",
  "This account has been deleted.",
  "This account is blocked.",
  "This method cannot be added here.",
  "Unknown sign-in method.",
  "User not found.",
  "Verification email could not be sent. Try again.",
];

/** Server strings built from a policy number: match on the value the server
 * actually sends, translate through a templated key. */
const TEMPLATED_SERVER_MESSAGES: readonly {
  message: string;
  key: string;
  values: TranslationValues;
}[] = [
  {
    message: PASSWORD_TOO_SHORT_MESSAGE,
    key: PASSWORD_TOO_SHORT_KEY,
    values: { min: PASSWORD_MIN_LENGTH },
  },
  {
    message: PASSWORD_TOO_LONG_MESSAGE,
    key: PASSWORD_TOO_LONG_KEY,
    values: { max: PASSWORD_MAX_LENGTH },
  },
];

const KNOWN_SERVER_MESSAGE_SET = new Set(KNOWN_SERVER_MESSAGES);

// lib/auth/methods.ts encodes the HTTP status inside the thrown message
// ("400 Keep at least one sign-in method on the account.") and the public error
// sanitizer keeps it, so the raw code would otherwise be shown to the user.
const LEADING_STATUS_CODE = /^[45]\d{2}\s+(?=\S)/u;

/**
 * Localize one server-supplied message. Unknown text is returned unchanged so a
 * new API error still reaches the user instead of being swallowed.
 */
export function translateServerMessage(message: string, t: TranslateFn) {
  const trimmed = message.trim().replace(LEADING_STATUS_CODE, "");

  if (!trimmed) return "";

  const templated = TEMPLATED_SERVER_MESSAGES.find(
    (entry) => entry.message === trimmed,
  );

  if (templated) {
    return t(templated.key, templated.values);
  }

  return KNOWN_SERVER_MESSAGE_SET.has(trimmed) ? t(trimmed) : trimmed;
}

/** Catalog keys this module can ask for. Used by the i18n coverage test. */
export function listServerMessageCatalogKeys() {
  return [
    ...KNOWN_SERVER_MESSAGES,
    ...TEMPLATED_SERVER_MESSAGES.map((entry) => entry.key),
  ];
}
