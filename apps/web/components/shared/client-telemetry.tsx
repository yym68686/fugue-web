"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";

import {
  WEB_VITAL_NAMES,
  WEB_VITAL_RATINGS,
  type ClientErrorSource,
  type ClientTelemetryEvent,
  type WebVitalName,
  type WebVitalRating,
  readClientTelemetryRouteGroup,
} from "@/lib/telemetry/client-events";

const MAX_EVENTS_PER_DOCUMENT = 20;
let sentEventCount = 0;

function submitClientTelemetry(event: ClientTelemetryEvent) {
  if (typeof window === "undefined" || sentEventCount >= MAX_EVENTS_PER_DOCUMENT) {
    return;
  }

  sentEventCount += 1;
  const body = JSON.stringify(event);

  try {
    // A string keeps Beacon on the CORS-safelisted text/plain path. WebKit can
    // otherwise dispatch an empty body for an application/json Blob at unload.
    if (navigator.sendBeacon("/api/telemetry/client", body)) {
      return;
    }
  } catch {
    // A keepalive fetch is the bounded fallback when Beacon is unavailable.
  }

  void fetch("/api/telemetry/client", {
    body,
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

function readCurrentRouteGroup() {
  return readClientTelemetryRouteGroup(window.location.pathname);
}

export function reportClientError(source: ClientErrorSource) {
  submitClientTelemetry({
    kind: "client-error",
    route: readCurrentRouteGroup(),
    source,
  });
}

type ReportedWebVital = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

function reportWebVital(metric: ReportedWebVital) {
  if (
    !WEB_VITAL_NAMES.includes(metric.name as WebVitalName) ||
    !WEB_VITAL_RATINGS.includes(metric.rating as WebVitalRating) ||
    !Number.isFinite(metric.value) ||
    metric.value < 0
  ) {
    return;
  }

  submitClientTelemetry({
    kind: "web-vital",
    name: metric.name as WebVitalName,
    rating: metric.rating as WebVitalRating,
    route: readCurrentRouteGroup(),
    value: Math.round(metric.value * 1_000) / 1_000,
  });
}

export function ClientTelemetry() {
  useReportWebVitals(reportWebVital);

  useEffect(() => {
    const handleWindowError = () => reportClientError("window-error");
    const handleUnhandledRejection = () => reportClientError("unhandled-rejection");

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
