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

export function readBooleanEnv(value: string | undefined, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}
