const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthMode = "signin" | "signup";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function sanitizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function parseAuthMode(value: string | null | undefined): AuthMode {
  return value === "signup" ? "signup" : "signin";
}

export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value) {
    return "/app";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

export function buildReturnToHref(pathname: string, returnTo: string | null | undefined) {
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
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

export function readBooleanEnv(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
