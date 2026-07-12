import { normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { AuthRequestTooLargeError, readLimitedRequestText } from "@/lib/auth/request";
import {
  CLIENT_ERROR_SOURCES,
  CLIENT_TELEMETRY_ROUTE_GROUPS,
  WEB_VITAL_NAMES,
  WEB_VITAL_RATINGS,
  type ClientErrorSource,
  type ClientTelemetryEvent,
  type ClientTelemetryRouteGroup,
  type WebVitalName,
  type WebVitalRating,
} from "@/lib/telemetry/client-events";

const MAX_CLIENT_TELEMETRY_BYTES = 2 * 1_024;
const MAX_WEB_VITAL_VALUE = 86_400_000;

function noStoreJson(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOriginBrowserRequest(request: Request) {
  const originHeader = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!originHeader) return true;
  return normalizeAuthOrigin(originHeader) === readRequestOrigin(request);
}

function readTelemetryEvent(payload: unknown): ClientTelemetryEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  if (
    !CLIENT_TELEMETRY_ROUTE_GROUPS.includes(
      candidate.route as ClientTelemetryRouteGroup,
    )
  ) {
    return null;
  }
  const route = candidate.route as ClientTelemetryRouteGroup;

  if (candidate.kind === "client-error") {
    if (!CLIENT_ERROR_SOURCES.includes(candidate.source as ClientErrorSource)) {
      return null;
    }
    return {
      kind: "client-error",
      route,
      source: candidate.source as ClientErrorSource,
    };
  }

  if (
    candidate.kind !== "web-vital" ||
    !WEB_VITAL_NAMES.includes(candidate.name as WebVitalName) ||
    !WEB_VITAL_RATINGS.includes(candidate.rating as WebVitalRating) ||
    typeof candidate.value !== "number" ||
    !Number.isFinite(candidate.value) ||
    candidate.value < 0 ||
    candidate.value > MAX_WEB_VITAL_VALUE
  ) {
    return null;
  }

  return {
    kind: "web-vital",
    name: candidate.name as WebVitalName,
    rating: candidate.rating as WebVitalRating,
    route,
    value: Math.round(candidate.value * 1_000) / 1_000,
  };
}

export async function POST(request: Request) {
  if (!isSameOriginBrowserRequest(request)) {
    return noStoreJson("Telemetry request origin is not allowed.", 403);
  }

  let payload: unknown;
  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      !contentType.includes("application/json") &&
      !contentType.includes("text/plain")
    ) {
      throw new TypeError("Unsupported telemetry content type.");
    }
    payload = JSON.parse(
      await readLimitedRequestText(request, MAX_CLIENT_TELEMETRY_BYTES),
    ) as unknown;
  } catch (error) {
    return noStoreJson(
      error instanceof AuthRequestTooLargeError
        ? "Telemetry request payload is too large."
        : "Invalid telemetry request payload.",
      error instanceof AuthRequestTooLargeError ? 413 : 400,
    );
  }

  const event = readTelemetryEvent(payload);
  if (!event) return noStoreJson("Invalid telemetry event.", 400);

  console.info(
    JSON.stringify({
      event: "fugue_web_client_telemetry",
      ...event,
    }),
  );
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
