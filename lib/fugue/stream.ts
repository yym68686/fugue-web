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
    upstream.headers.get("Cache-Control") ||
      "no-cache, no-store, must-revalidate, no-transform",
  );
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "text/event-stream");
  headers.set("Connection", "keep-alive");

  const xAccelBuffering = upstream.headers.get("X-Accel-Buffering");

  headers.set("X-Accel-Buffering", xAccelBuffering || "no");

  return headers;
}

function proxyEventStreamBody(
  upstream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = upstream.getReader();
      const abortUpstream = () => {
        void reader.cancel().catch(() => undefined);
      };

      signal?.addEventListener("abort", abortUpstream, { once: true });

      // Keep start() synchronous so long-lived SSE streams can flush
      // immediately instead of waiting for the entire pump to finish.
      void (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              return;
            }

            if (value && value.byteLength > 0) {
              controller.enqueue(value);
            }
          }
        } catch (error) {
          if (signal?.aborted) {
            controller.close();
            return;
          }

          controller.error(error);
        } finally {
          signal?.removeEventListener("abort", abortUpstream);
          reader.releaseLock();
        }
      })();
    },
    async cancel(reason) {
      await upstream.cancel(reason).catch(() => undefined);
    },
  });
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

  return new Response(proxyEventStreamBody(upstream.body, signal), {
    headers: buildProxyHeaders(upstream),
    status: upstream.status,
    statusText: upstream.statusText,
  });
}
