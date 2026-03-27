function firstHeader(request: Request, name: string) {
  const raw = request.headers.get(name);

  if (!raw) {
    return null;
  }

  const first = raw.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

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

export function readRequestOrigin(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = firstHeader(request, "x-forwarded-proto");
  const forwardedHost = firstHeader(request, "x-forwarded-host");
  const protocol = forwardedProto ?? url.protocol.replace(":", "");
  const host = forwardedHost ?? request.headers.get("host");

  if (!host) {
    return url.origin;
  }

  return `${protocol}://${host}`;
}

export function isSecureRequest(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = firstHeader(request, "x-forwarded-proto");
  const protocol = forwardedProto ?? url.protocol.replace(":", "");

  return protocol === "https";
}

export function buildOriginUrl(origin: string, pathname: string) {
  return new URL(pathname, origin);
}
