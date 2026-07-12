const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RETURN_TO_VALIDATION_ORIGIN = "https://fugue.invalid";

function isControlCharacter(character: string) {
  const codePoint = character.codePointAt(0);
  return (
    codePoint !== undefined &&
    (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
  );
}

function containsControlCharacter(value: string) {
  return Array.from(value).some(isControlCharacter);
}

export const AUTH_EMAIL_MAX_LENGTH = 254;
export const AUTH_DISPLAY_NAME_MAX_LENGTH = 80;
export const AUTH_PROVIDER_ID_MAX_LENGTH = 255;
export const AUTH_RETURN_TO_MAX_LENGTH = 2_048;
export const AUTH_EXTERNAL_URL_MAX_LENGTH = 2_048;

export type ReturnToRejectionReason =
  | "absolute-or-protocol-relative"
  | "control-character"
  | "invalid-encoding"
  | "invalid-type"
  | "invalid-url"
  | "too-long"
  | "unexpected-origin"
  | "unsafe-backslash";

export type ReturnToValidation =
  | {
      accepted: true;
      path: string;
      reason: null;
    }
  | {
      accepted: false;
      path: "/app";
      reason: ReturnToRejectionReason;
    };

export type AuthMode = "signin" | "signup";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  const normalized = normalizeEmail(value);
  return (
    normalized.length > 0 &&
    normalized.length <= AUTH_EMAIL_MAX_LENGTH &&
    EMAIL_PATTERN.test(normalized)
  );
}

export function sanitizeDisplayName(value: string) {
  const normalized = Array.from(value.normalize("NFKC"), (character) =>
    isControlCharacter(character) ? " " : character,
  )
    .join("")
    .trim()
    .replace(/\s+/g, " ");

  return Array.from(normalized).slice(0, AUTH_DISPLAY_NAME_MAX_LENGTH).join("");
}

export function sanitizeExternalHttpUrl(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > AUTH_EXTERNAL_URL_MAX_LENGTH
  ) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function parseAuthMode(value: string | null | undefined): AuthMode {
  return value === "signup" ? "signup" : "signin";
}

function rejectedReturnTo(reason: ReturnToRejectionReason): ReturnToValidation {
  return {
    accepted: false,
    path: "/app",
    reason,
  };
}

/**
 * Validate a post-authentication destination as a same-origin path.
 *
 * Each decoding layer is inspected because framework/router layers may decode
 * percent-encoded input more than once. The returned value always comes from
 * WHATWG URL serialization rather than the original user-controlled string.
 */
export function validateReturnTo(
  value: unknown,
  canonicalOrigin = RETURN_TO_VALIDATION_ORIGIN,
): ReturnToValidation {
  if (!value) {
    return {
      accepted: true,
      path: "/app",
      reason: null,
    };
  }

  if (typeof value !== "string") {
    return rejectedReturnTo("invalid-type");
  }

  if (value.length > AUTH_RETURN_TO_MAX_LENGTH) {
    return rejectedReturnTo("too-long");
  }

  let decoded = value;

  for (let depth = 0; depth < 5; depth += 1) {
    if (containsControlCharacter(decoded)) {
      return rejectedReturnTo("control-character");
    }

    if (decoded.includes("\\")) {
      return rejectedReturnTo("unsafe-backslash");
    }

    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
      return rejectedReturnTo("absolute-or-protocol-relative");
    }

    if (!/%[0-9a-f]{2}/i.test(decoded)) {
      if (depth === 0 && decoded.includes("%")) {
        return rejectedReturnTo("invalid-encoding");
      }

      break;
    }

    let next: string;

    try {
      next = decodeURIComponent(decoded);
    } catch {
      return rejectedReturnTo("invalid-encoding");
    }

    if (next === decoded) {
      break;
    }

    decoded = next;
  }

  if (/%[0-9a-f]{2}/i.test(decoded)) {
    // Five nested encoding layers is never needed for a legitimate in-app URL.
    return rejectedReturnTo("invalid-encoding");
  }

  try {
    const trustedOrigin = new URL(canonicalOrigin).origin;
    const url = new URL(value, trustedOrigin);

    if (url.origin !== trustedOrigin) {
      return rejectedReturnTo("unexpected-origin");
    }

    return {
      accepted: true,
      path: `${url.pathname}${url.search}${url.hash}`,
      reason: null,
    };
  } catch {
    return rejectedReturnTo("invalid-url");
  }
}

export function sanitizeReturnTo(
  value: unknown,
  canonicalOrigin = RETURN_TO_VALIDATION_ORIGIN,
) {
  const result = validateReturnTo(value, canonicalOrigin);

  if (!result.accepted && value) {
    console.warn("Rejected unsafe authentication return path.", {
      reason: result.reason,
    });
  }

  return result.path;
}

export function buildReturnToHref(
  pathname: string,
  returnTo: string | null | undefined,
) {
  const sanitizedReturnTo = sanitizeReturnTo(returnTo);
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}returnTo=${encodeURIComponent(sanitizedReturnTo)}`;
}

export function appendReturnToSearchParams(
  returnTo: string | null | undefined,
  values: Record<string, string | null | undefined>,
) {
  const sanitizedReturnTo = sanitizeReturnTo(returnTo);
  const url = new URL(sanitizedReturnTo, "https://fugue.local");

  for (const [key, value] of Object.entries(values)) {
    if (!value) {
      url.searchParams.delete(key);
      continue;
    }

    url.searchParams.set(key, value);
  }

  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

export function readBooleanEnv(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
