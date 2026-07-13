export const CLIENT_TELEMETRY_ROUTE_GROUPS = [
  "auth-sign-in",
  "auth-sign-up",
  "console",
  "console-project",
  "docs",
  "marketing",
  "new-project",
  "unknown",
] as const;

export const CLIENT_ERROR_SOURCES = [
  "console-boundary",
  "root-boundary",
  "unhandled-rejection",
  "window-error",
] as const;

export const WEB_VITAL_NAMES = ["CLS", "FCP", "INP", "LCP", "TTFB"] as const;
export const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;

export type ClientTelemetryRouteGroup = (typeof CLIENT_TELEMETRY_ROUTE_GROUPS)[number];
export type ClientErrorSource = (typeof CLIENT_ERROR_SOURCES)[number];
export type WebVitalName = (typeof WEB_VITAL_NAMES)[number];
export type WebVitalRating = (typeof WEB_VITAL_RATINGS)[number];

export type ClientTelemetryEvent =
  | {
      kind: "client-error";
      route: ClientTelemetryRouteGroup;
      source: ClientErrorSource;
    }
  | {
      kind: "web-vital";
      name: WebVitalName;
      rating: WebVitalRating;
      route: ClientTelemetryRouteGroup;
      value: number;
    };

export function readClientTelemetryRouteGroup(
  pathname: string,
): ClientTelemetryRouteGroup {
  if (pathname === "/") return "marketing";
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return "docs";
  if (pathname === "/auth/sign-in") return "auth-sign-in";
  if (pathname === "/auth/sign-up") return "auth-sign-up";
  if (pathname === "/new" || pathname.startsWith("/new/")) return "new-project";
  if (pathname.startsWith("/app/projects/")) return "console-project";
  if (pathname === "/app" || pathname.startsWith("/app/")) return "console";
  return "unknown";
}
