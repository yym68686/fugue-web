let transition: { route: string; started: number } | undefined;

type LongTaskTiming = Pick<PerformanceEntry, "startTime" | "duration">;
const longTasks: LongTaskTiming[] = [];
let longTaskObserver: PerformanceObserver | undefined;
let droppedLongTasksThrough = 0;

function retainLongTasks(entries: PerformanceEntry[]) {
  for (const { startTime, duration } of entries) {
    longTasks.push({ startTime, duration });
    if (longTasks.length > 128) {
      const dropped = longTasks.shift()!;
      droppedLongTasksThrough = dropped.startTime + dropped.duration;
    }
  }
}

export function startPagePerformanceObservation() {
  if (longTaskObserver || typeof PerformanceObserver === "undefined") return;
  try {
    if (!PerformanceObserver.supportedEntryTypes.includes("longtask")) return;
    const observer = new PerformanceObserver((list) => retainLongTasks(list.getEntries()));
    observer.observe({ type: "longtask", buffered: true });
    longTaskObserver = observer;
  } catch {
    // Missing browser instrumentation must never block navigation.
  }
}

export function summarizeLongTasks(entries: LongTaskTiming[], started: number, completed: number) {
  const overlaps = entries.map((entry) =>
    Math.max(0, Math.min(completed, entry.startTime + entry.duration) - Math.max(started, entry.startTime)),
  ).filter((duration) => duration > 0);
  return {
    count: overlaps.length,
    totalMs: Math.round(overlaps.reduce((sum, value) => sum + value, 0) * 10) / 10,
    maxMs: Math.round(Math.max(0, ...overlaps) * 10) / 10,
  };
}

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
  if (longTaskObserver) retainLongTasks(longTaskObserver.takeRecords());
  const mainThreadLongTasks = longTaskObserver
    ? { observed: true, partial: droppedLongTasksThrough > started, ...summarizeLongTasks(longTasks, started, completed) }
    : { observed: false };
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
  return {
    kind, requestObserved: Boolean(entry), completedMatchingResources: entries.length,
    mainThreadLongTasks,
    ...(entry ? summarizeResourceTiming(entry, started, completed) : {}),
  };
}
