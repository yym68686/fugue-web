let transition: { route: string; started: number } | undefined;

export function startPageNavigation(url: string) {
  transition = {
    route: new URL(url, window.location.href).pathname,
    started: performance.now(),
  };
}

export function pageNavigationStart(route: string): number | null {
  if (transition) return transition.route === route ? transition.started : null;
  return window.location.pathname === route ? 0 : null;
}

type ResourceTimingInput = Pick<PerformanceResourceTiming,
  "startTime" | "domainLookupStart" | "domainLookupEnd" | "connectStart" | "connectEnd" |
  "secureConnectionStart" | "requestStart" | "responseStart" | "responseEnd" | "encodedBodySize">;

export function summarizeResourceTiming(entry: ResourceTimingInput, started: number, completed: number) {
  const ms = (value: number) => Math.round(Math.max(0, value) * 10) / 10;
  return {
    requestStartMs: ms(entry.requestStart - started),
    dnsMs: ms(entry.domainLookupEnd - entry.domainLookupStart),
    connectMs: ms(entry.connectEnd - entry.connectStart),
    tlsMs: entry.secureConnectionStart > 0 ? ms(entry.connectEnd - entry.secureConnectionStart) : 0,
    responseWaitMs: ms(entry.responseStart - entry.requestStart),
    responseReadMs: ms(entry.responseEnd - entry.responseStart),
    afterResponseMs: ms(completed - entry.responseEnd),
    encodedBodyBytes: entry.encodedBodySize,
  };
}

export function pageBrowserTiming(route: string, started: number, completed: number) {
  const kind = transition?.route === route ? "client" : "document";
  const entries = kind === "document"
    ? performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]
    : (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((entry) => {
      const url = new URL(entry.name, window.location.href);
      return url.origin === window.location.origin && url.pathname === route && entry.startTime >= started;
    });
  const entry = entries.filter((entry) => entry.responseEnd > 0).at(-1);
  // A prefetched transition or unfinished stream may have no completed resource
  // entry. Leave its phases unknown instead of reporting a fabricated zero.
  return { kind, requestObserved: Boolean(entry), ...(entry ? summarizeResourceTiming(entry, started, completed) : {}) };
}
