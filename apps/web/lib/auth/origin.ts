import { isIP } from "node:net";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeAuthOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function readConfiguredCanonicalOrigin() {
  const configured =
    process.env.APP_BASE_URL?.trim() ||
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
  return normalizeAuthOrigin(configured);
}

function isLoopbackOrigin(origin: string) {
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * Auth redirects and cookie policy derive from one configured public origin.
 * Forwarded Host/Proto are deliberately ignored because clients can forge them
 * unless every ingress in front of the app has a separately enforced trust
 * policy.
 */
export function readRequestOrigin(request: Request) {
  const configuredOrigin = readConfiguredCanonicalOrigin();

  if (configuredOrigin) {
    if (
      process.env.NODE_ENV === "production" &&
      !configuredOrigin.startsWith("https://") &&
      !isLoopbackOrigin(configuredOrigin)
    ) {
      throw new Error("APP_BASE_URL must use HTTPS in production.");
    }

    return configuredOrigin;
  }

  const requestOrigin = normalizeAuthOrigin(request.url);

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL is required for production authentication routes.");
  }

  if (!requestOrigin || !isLoopbackOrigin(requestOrigin)) {
    return "http://localhost:3000";
  }

  return requestOrigin;
}

export function isSecureRequest(request: Request) {
  return readRequestOrigin(request).startsWith("https://");
}

function readTrustedProxyHops() {
  const value = Number.parseInt(process.env.AUTH_TRUSTED_PROXY_HOPS ?? "1", 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 5) : 1;
}

export function readClientIp(request: Request) {
  if (process.env.AUTH_TRUST_PROXY_HEADERS?.trim().toLowerCase() !== "true") {
    return null;
  }

  const rawForwarded = request.headers.get("x-forwarded-for");

  if (!rawForwarded || rawForwarded.length > 1_024) {
    return null;
  }

  const forwarded = rawForwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!forwarded?.length) {
    return null;
  }

  const candidate = forwarded[Math.max(0, forwarded.length - readTrustedProxyHops())];
  return candidate && isIP(candidate) ? candidate : null;
}

export function buildOriginUrl(origin: string, pathname: string) {
  return new URL(pathname, origin);
}
