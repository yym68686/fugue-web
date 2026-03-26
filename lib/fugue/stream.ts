import "server-only";

import { getFugueEnv } from "@/lib/fugue/env";

type ProxyFugueEventStreamOptions = {
  accessToken: string;
  path: string;
  requestHeaders?: Headers;
  signal?: AbortSignal;
};

function forwardEventStreamHeaders(requestHeaders?: Headers) {
  const headers = new Headers({
    Accept: "text/event-stream",
  });

  if (!requestHeaders) {
    return headers;
  }

  const lastEventId = requestHeaders.get("last-event-id");

  if (lastEventId) {
    headers.set("Last-Event-ID", lastEventId);
  }

  return headers;
}

function buildProxyHeaders(upstream: Response) {
  const headers = new Headers();

  headers.set(
    "Cache-Control",
    upstream.headers.get("Cache-Control") || "no-cache, no-store, must-revalidate",
  );
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "text/event-stream");

  const xAccelBuffering = upstream.headers.get("X-Accel-Buffering");

  if (xAccelBuffering) {
    headers.set("X-Accel-Buffering", xAccelBuffering);
  }

  return headers;
}

export async function proxyFugueEventStream({
  accessToken,
  path,
  requestHeaders,
  signal,
}: ProxyFugueEventStreamOptions) {
  const env = getFugueEnv();
  const url = new URL(path, env.apiUrl);
  const upstream = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...Object.fromEntries(forwardEventStreamHeaders(requestHeaders).entries()),
    },
    method: "GET",
    signal,
  });

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text().catch(() => "");

    return new Response(body || "Fugue event stream is unavailable.", {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": upstream.headers.get("Content-Type") || "text/plain; charset=utf-8",
      },
      status: upstream.ok ? 502 : upstream.status,
      statusText: upstream.ok ? "Bad Gateway" : upstream.statusText,
    });
  }

  return new Response(upstream.body, {
    headers: buildProxyHeaders(upstream),
    status: upstream.status,
    statusText: upstream.statusText,
  });
}
