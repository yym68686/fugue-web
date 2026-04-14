import "server-only";

import { lookup } from "node:dns/promises";

const INTERNAL_SERVICE_SUFFIXES = [
  ".svc",
  ".svc.cluster.local",
] as const;
const RESOLVED_HOST_TTL_MS = 5 * 60_000;

type ResolvedHostCacheEntry = {
  address: string;
  expiresAt: number;
};

const resolvedHostCache = new Map<string, ResolvedHostCacheEntry>();
const pendingResolvedHostLoads = new Map<string, Promise<string | null>>();

function isInternalServiceHost(hostname: string) {
  return INTERNAL_SERVICE_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

async function resolveInternalServiceHost(hostname: string) {
  const now = Date.now();
  const cached = resolvedHostCache.get(hostname);

  if (cached && cached.expiresAt > now) {
    return cached.address;
  }

  const pending = pendingResolvedHostLoads.get(hostname);

  if (pending) {
    return pending;
  }

  // Tenant pods pay a noticeable first-hop cost when they repeatedly resolve the
  // control-plane service name. Resolve it once and reuse the cluster IP.
  const loadPromise = (async () => {
    try {
      const result = await lookup(hostname, { family: 4 });

      if (!result.address) {
        return null;
      }

      resolvedHostCache.set(hostname, {
        address: result.address,
        expiresAt: Date.now() + RESOLVED_HOST_TTL_MS,
      });
      return result.address;
    } catch {
      return null;
    } finally {
      pendingResolvedHostLoads.delete(hostname);
    }
  })();

  pendingResolvedHostLoads.set(hostname, loadPromise);
  return loadPromise;
}

async function resolveInternalServiceUrl(input: URL | string) {
  const url = input instanceof URL ? new URL(input) : new URL(input);

  if (!isInternalServiceHost(url.hostname)) {
    return url;
  }

  const address = await resolveInternalServiceHost(url.hostname);

  if (!address || address === url.hostname) {
    return url;
  }

  url.hostname = address;
  return url;
}

type RequestInitWithDuplex = RequestInit & {
  duplex?: "half";
};

function cloneRequestInit(request: Request): RequestInitWithDuplex {
  const init: RequestInitWithDuplex = {
    body: request.bodyUsed ? undefined : request.body,
    cache: request.cache,
    credentials: request.credentials,
    headers: new Headers(request.headers),
    integrity: request.integrity,
    keepalive: request.keepalive,
    method: request.method,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
  };

  const duplex = (request as Request & { duplex?: "half" }).duplex;

  if (duplex) {
    init.duplex = duplex;
  }

  return init;
}

export async function fugueServerFetch(request: Request) {
  const resolvedUrl = await resolveInternalServiceUrl(request.url);

  if (resolvedUrl.href === request.url) {
    return fetch(request);
  }

  return fetch(resolvedUrl, cloneRequestInit(request));
}

export async function fetchFugueServer(
  input: URL | string,
  init: RequestInitWithDuplex = {},
) {
  const resolvedUrl = await resolveInternalServiceUrl(input);
  return fetch(resolvedUrl, init);
}
