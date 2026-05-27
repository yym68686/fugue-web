"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppCustomDomainsPanel } from "@/components/console/app-custom-domains-panel";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { HintInline, HintTooltip } from "@/components/ui/hint-tooltip";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/ui/cx";

type RouteAvailability = {
  available: boolean;
  baseDomain: string | null;
  current: boolean;
  hostname: string | null;
  input: string | null;
  label: string | null;
  pathPrefix: string | null;
  publicUrl: string | null;
  reason: string | null;
  valid: boolean;
};

type RouteAvailabilityResponse = {
  availability: RouteAvailability | null;
};

type RoutePatchResponse = {
  alreadyCurrent: boolean;
  app: {
    route: {
      hostname: string | null;
      pathPrefix: string | null;
      publicUrl: string | null;
    } | null;
  } | null;
  availability: RouteAvailability | null;
};

type ProjectRouteDomainView = {
  host?: string | null;
  hostname?: string | null;
  name?: string | null;
  ownerAppId?: string | null;
  ownerService?: string | null;
  tls?: string | null;
};

type ProjectRouteEntrypointRouteView = {
  appId?: string | null;
  path?: string | null;
  pathPrefix?: string | null;
  rewrite?: string | null;
  service?: string | null;
  stripPrefix?: boolean;
};

type ProjectRouteEntrypointView = {
  domain?: string | null;
  name?: string | null;
  routes?: ProjectRouteEntrypointRouteView[];
};

type ProjectRouteBindingView = {
  appId?: string | null;
  appName?: string | null;
  domainName?: string | null;
  entrypointName?: string | null;
  hostname?: string | null;
  pathPrefix?: string | null;
  publicUrl?: string | null;
  service?: string | null;
  servicePort?: number | null;
};

type ProjectRouteTableView = {
  bindings: ProjectRouteBindingView[];
  domains: ProjectRouteDomainView[];
  entrypoints: ProjectRouteEntrypointView[];
  legacy: boolean;
  projectId?: string | null;
  tenantId?: string | null;
};

type ProjectRouteTableResponse = {
  routeTable: ProjectRouteTableView | null;
};

type ProjectRouteTableDraftPayload = {
  domains: unknown[];
  entrypoints: unknown[];
};

type RoutePanelProps = {
  appId: string;
  appName: string;
  projectId: string;
  initialBaseDomain: string | null;
  initialHostname: string | null;
  initialPathPrefix: string | null;
  initialPublicUrl: string | null;
};

type AvailabilityState = "checking" | "error" | "idle" | "ready";
type RouteFieldState = {
  detail: string | null;
  label: string | null;
  variant: "error" | "info" | "neutral" | "success";
};

type Translator = (key: string, values?: Record<string, string | number>) => string;

function asRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringValueAny(record: Record<string, unknown> | null, ...keys: string[]) {
  for (const key of keys) {
    const value = readStringValue(record, key);

    if (value) {
      return value;
    }
  }

  return null;
}

function readBooleanValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : false;
}

function readBooleanValueAny(record: Record<string, unknown> | null, ...keys: string[]) {
  for (const key of keys) {
    if (typeof record?.[key] === "boolean") {
      return record[key] as boolean;
    }
  }

  return false;
}

function readArrayValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function normalizeHostname(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function readHostnameFromUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return normalizeHostname(new URL(value).hostname);
  } catch {
    return null;
  }
}

function resolveRouteHostname(hostname?: string | null, publicUrl?: string | null) {
  return normalizeHostname(hostname) ?? readHostnameFromUrl(publicUrl);
}

function normalizePathPrefix(value?: string | null) {
  let normalized = value?.trim() ?? "";

  if (!normalized) {
    return "/";
  }

  normalized = normalized.replace(/\\/g, "/");
  normalized = normalized.split("#")[0]?.split("?")[0]?.trim() ?? "";

  if (!normalized) {
    return "/";
  }

  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }

  normalized = normalized.replace(/\/{2,}/g, "/");

  if (normalized.length > 1) {
    normalized = normalized.replace(/\/+$/, "");
  }

  return normalized || "/";
}

function sanitizePathPrefixInput(value: string) {
  const next = value.trim().replace(/\\/g, "/");

  if (!next) {
    return "";
  }

  return next.startsWith("/") ? next : `/${next}`;
}

function readPathPrefixFromUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return normalizePathPrefix(new URL(value).pathname);
  } catch {
    return null;
  }
}

function buildRoutePublicUrl(hostname?: string | null, pathPrefix?: string | null) {
  const normalizedHostname = normalizeHostname(hostname);

  if (!normalizedHostname) {
    return null;
  }

  const normalizedPathPrefix = normalizePathPrefix(pathPrefix);
  return `https://${normalizedHostname}${normalizedPathPrefix === "/" ? "" : normalizedPathPrefix}`;
}

function readRouteLabel(hostname?: string | null, baseDomain?: string | null) {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedBaseDomain = normalizeHostname(baseDomain);

  if (!normalizedHostname) {
    return "";
  }

  if (normalizedBaseDomain) {
    const suffix = `.${normalizedBaseDomain}`;

    if (normalizedHostname.endsWith(suffix)) {
      return normalizedHostname.slice(0, -suffix.length);
    }
  }

  return normalizedHostname.split(".")[0] ?? normalizedHostname;
}

function sanitizeRouteLabelInput(value: string, baseDomain?: string | null) {
  let normalized = value.trim().toLowerCase();
  const normalizedBaseDomain = normalizeHostname(baseDomain);

  if (normalizedBaseDomain) {
    const suffix = `.${normalizedBaseDomain}`;

    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
    }
  }

  normalized = normalized.replace(/^\.+/, "").replace(/\.+$/, "");

  if (normalized.includes(".")) {
    normalized = normalized.split(".")[0] ?? normalized;
  }

  return normalized;
}

function readBaseDomainFromHostname(hostname?: string | null) {
  const normalized = normalizeHostname(hostname);

  if (!normalized) {
    return null;
  }

  const segments = normalized.split(".").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  return segments.slice(1).join(".");
}

function readErrorMessage(error: unknown, t: Translator = (key) => key) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
}

async function readResponseError(response: Response, t: Translator = (key) => key) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return t("Request failed with status {status}.", { status: response.status });
  }

  try {
    const payload = JSON.parse(trimmed) as { error?: unknown };

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Fall back to the raw response body when the payload is not JSON.
  }

  return trimmed;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit, t: Translator = (key) => key) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readResponseError(response, t));
  }

  return (await response.json().catch(() => null)) as T | null;
}

function sanitizeRouteAvailability(value: unknown): RouteAvailability | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    available: readBooleanValue(record, "available"),
    baseDomain: readStringValueAny(record, "base_domain", "baseDomain"),
    current: readBooleanValue(record, "current"),
    hostname: readStringValue(record, "hostname"),
    input: readStringValue(record, "input"),
    label: readStringValue(record, "label"),
    pathPrefix: readStringValueAny(record, "path_prefix", "pathPrefix"),
    publicUrl: readStringValueAny(record, "public_url", "publicUrl"),
    reason: readStringValue(record, "reason"),
    valid: readBooleanValue(record, "valid"),
  };
}

function readRouteAvailabilityResponse(value: unknown): RouteAvailabilityResponse {
  const record = asRecord(value);

  return {
    availability: sanitizeRouteAvailability(record?.availability),
  };
}

function readRoutePatchResponse(value: unknown): RoutePatchResponse {
  const record = asRecord(value);
  const app = asRecord(record?.app);
  const route = asRecord(app?.route);

  return {
    alreadyCurrent: readBooleanValueAny(record, "already_current", "alreadyCurrent"),
    app: app
      ? {
          route: route
            ? {
                hostname: readStringValue(route, "hostname"),
                pathPrefix: readStringValueAny(route, "path_prefix", "pathPrefix"),
                publicUrl: readStringValueAny(route, "public_url", "publicUrl"),
              }
            : null,
        }
      : null,
    availability: sanitizeRouteAvailability(record?.availability),
  };
}

function sanitizeProjectRouteDomain(value: unknown): ProjectRouteDomainView {
  const record = asRecord(value);

  return {
    host: readStringValue(record, "host"),
    hostname: readStringValue(record, "hostname"),
    name: readStringValue(record, "name"),
    ownerAppId: readStringValueAny(record, "owner_app_id", "ownerAppId"),
    ownerService: readStringValueAny(record, "owner_service", "ownerService"),
    tls: readStringValue(record, "tls"),
  };
}

function sanitizeProjectRouteEntrypointRoute(value: unknown): ProjectRouteEntrypointRouteView {
  const record = asRecord(value);

  return {
    appId: readStringValueAny(record, "app_id", "appId"),
    path: readStringValue(record, "path"),
    pathPrefix: readStringValueAny(record, "path_prefix", "pathPrefix"),
    rewrite: readStringValue(record, "rewrite"),
    service: readStringValue(record, "service"),
    stripPrefix: readBooleanValueAny(record, "strip_prefix", "stripPrefix"),
  };
}

function sanitizeProjectRouteEntrypoint(value: unknown): ProjectRouteEntrypointView {
  const record = asRecord(value);

  return {
    domain: readStringValue(record, "domain"),
    name: readStringValue(record, "name"),
    routes: readArrayValue(record, "routes").map(sanitizeProjectRouteEntrypointRoute),
  };
}

function sanitizeProjectRouteBinding(value: unknown): ProjectRouteBindingView {
  const record = asRecord(value);
  const servicePort = record?.service_port ?? record?.servicePort;

  return {
    appId: readStringValueAny(record, "app_id", "appId"),
    appName: readStringValueAny(record, "app_name", "appName"),
    domainName: readStringValueAny(record, "domain_name", "domainName"),
    entrypointName: readStringValueAny(record, "entrypoint_name", "entrypointName"),
    hostname: readStringValue(record, "hostname"),
    pathPrefix: readStringValueAny(record, "path_prefix", "pathPrefix"),
    publicUrl: readStringValueAny(record, "public_url", "publicUrl"),
    service: readStringValue(record, "service"),
    servicePort: typeof servicePort === "number" && Number.isFinite(servicePort) ? servicePort : null,
  };
}

function sanitizeProjectRouteTable(value: unknown): ProjectRouteTableView | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    bindings: readArrayValue(record, "bindings").map(sanitizeProjectRouteBinding),
    domains: readArrayValue(record, "domains").map(sanitizeProjectRouteDomain),
    entrypoints: readArrayValue(record, "entrypoints").map(sanitizeProjectRouteEntrypoint),
    legacy: readBooleanValue(record, "legacy"),
    projectId: readStringValueAny(record, "project_id", "projectId"),
    tenantId: readStringValueAny(record, "tenant_id", "tenantId"),
  };
}

function readProjectRouteTableResponse(value: unknown): ProjectRouteTableResponse {
  const record = asRecord(value);

  return {
    routeTable: sanitizeProjectRouteTable(record?.routeTable ?? record?.route_table),
  };
}

function routeTableDraftValue(table: ProjectRouteTableView | null) {
  return JSON.stringify(
    {
      domains: table?.domains ?? [],
      entrypoints: table?.entrypoints ?? [],
    },
    null,
    2,
  );
}

function readRouteTableDraftPayload(
  value: unknown,
  t: Translator,
): { error: string; payload: null } | { error: null; payload: ProjectRouteTableDraftPayload } {
  const record = asRecord(value);

  if (!record) {
    return {
      error: t("Route table must be a JSON object."),
      payload: null,
    };
  }

  if (!Array.isArray(record.domains) || !Array.isArray(record.entrypoints)) {
    return {
      error: t("Route table JSON must include domains and entrypoints arrays."),
      payload: null,
    };
  }

  return {
    error: null,
    payload: {
      domains: record.domains,
      entrypoints: record.entrypoints,
    },
  };
}

function buildCurrentAvailability(
  label: string,
  hostname: string | null,
  publicUrl: string | null,
  baseDomain: string | null,
  pathPrefix: string | null,
) {
  if (!label && !hostname) {
    return null;
  }

  const resolvedHostname =
    hostname ?? (label && baseDomain ? `${label}.${baseDomain}` : label || null);
  const resolvedPathPrefix = normalizePathPrefix(pathPrefix);

  return {
    available: true,
    baseDomain,
    current: true,
    hostname: resolvedHostname,
    input: label || resolvedHostname,
    label: label || readRouteLabel(resolvedHostname, baseDomain),
    pathPrefix: resolvedPathPrefix,
    publicUrl: publicUrl ?? buildRoutePublicUrl(resolvedHostname, resolvedPathPrefix),
    reason: null,
    valid: true,
  } satisfies RouteAvailability;
}

function readRouteFieldHint(t: Translator = (key) => key) {
  return t("Use lowercase letters, numbers, and hyphens.");
}

function readRouteFieldState(options: {
  availability: RouteAvailability | null;
  availabilityError: string | null;
  availabilityState: AvailabilityState;
  draft: string;
  isDirty: boolean;
  t: Translator;
}) {
  const { availability, availabilityError, availabilityState, draft, isDirty, t } = options;
  const normalizedDraft = draft.trim();

  if (!normalizedDraft) {
    return null;
  }

  if (availabilityState === "checking") {
    return {
      label: t("Checking"),
      detail: t("Checking availability…"),
      variant: "info" as const,
    } satisfies RouteFieldState;
  }

  if (availabilityState === "error") {
    return {
      label: t("Check failed"),
      detail: availabilityError ?? t("Unable to check availability right now."),
      variant: "error" as const,
    } satisfies RouteFieldState;
  }

  if (!availability) {
    return null;
  }

  if (!availability.valid) {
    return {
      label: t("Invalid"),
      detail: availability.reason ?? t("This route is invalid."),
      variant: "error" as const,
    } satisfies RouteFieldState;
  }

  if (!availability.available) {
    return {
      label: t("Taken"),
      detail: availability.reason ?? t("This route is already in use."),
      variant: "error" as const,
    } satisfies RouteFieldState;
  }

  if (availability.current || !isDirty) {
    return {
      label: t("Ready"),
      detail: null,
      variant: "success" as const,
    } satisfies RouteFieldState;
  }

  return {
    label: t("Available"),
    detail: t("Save to switch the live route."),
    variant: "success" as const,
  } satisfies RouteFieldState;
}

export function AppRoutePanel({
  appId,
  appName,
  projectId,
  initialBaseDomain,
  initialHostname,
  initialPathPrefix,
  initialPublicUrl,
}: RoutePanelProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [checkToken, setCheckToken] = useState(0);
  const [draft, setDraft] = useState("");
  const [pathDraft, setPathDraft] = useState("/");
  const [baselineLabel, setBaselineLabel] = useState("");
  const [baselinePathPrefix, setBaselinePathPrefix] = useState("/");
  const [currentHostname, setCurrentHostname] = useState<string | null>(null);
  const [currentPathPrefix, setCurrentPathPrefix] = useState("/");
  const [currentPublicUrl, setCurrentPublicUrl] = useState<string | null>(null);
  const [baseDomain, setBaseDomain] = useState<string | null>(null);
  const [availability, setAvailability] = useState<RouteAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
  const [saving, setSaving] = useState(false);
  const [routeTable, setRouteTable] = useState<ProjectRouteTableView | null>(null);
  const [routeTableDraft, setRouteTableDraft] = useState("");
  const [routeTableError, setRouteTableError] = useState<string | null>(null);
  const [routeTableLoading, setRouteTableLoading] = useState(false);
  const [routeTableSaving, setRouteTableSaving] = useState(false);
  const [routeTableToken, setRouteTableToken] = useState(0);

  useEffect(() => {
    const nextHostname = resolveRouteHostname(initialHostname, initialPublicUrl) ?? "";
    const nextBaseDomain =
      normalizeHostname(initialBaseDomain) ?? readBaseDomainFromHostname(nextHostname);
    const nextLabel = readRouteLabel(nextHostname, nextBaseDomain);
    const nextPathPrefix = normalizePathPrefix(
      initialPathPrefix ?? readPathPrefixFromUrl(initialPublicUrl),
    );
    const nextPublicUrl =
      initialPublicUrl?.trim() || buildRoutePublicUrl(nextHostname, nextPathPrefix);
    const nextAvailability = buildCurrentAvailability(
      nextLabel,
      nextHostname || null,
      nextPublicUrl,
      nextBaseDomain,
      nextPathPrefix,
    );

    setDraft(nextLabel);
    setPathDraft(nextPathPrefix);
    setBaselineLabel(nextLabel);
    setBaselinePathPrefix(nextPathPrefix);
    setCurrentHostname(nextHostname || null);
    setCurrentPathPrefix(nextPathPrefix);
    setCurrentPublicUrl(nextPublicUrl);
    setBaseDomain(nextBaseDomain);
    setAvailability(nextAvailability);
    setAvailabilityError(null);
    setAvailabilityState(nextAvailability ? "ready" : "idle");
    setCheckToken(0);
  }, [appId, initialBaseDomain, initialHostname, initialPathPrefix, initialPublicUrl]);

  useEffect(() => {
    if (!projectId) {
      setRouteTable(null);
      setRouteTableDraft("");
      setRouteTableError(null);
      setRouteTableLoading(false);
      return;
    }

    const controller = new AbortController();
    setRouteTableLoading(true);
    setRouteTableError(null);

    void (async () => {
      try {
        const payload = readProjectRouteTableResponse(
          await requestJson(
            `/api/fugue/projects/${projectId}/routes`,
            {
              cache: "no-store",
              signal: controller.signal,
            },
            t,
          ),
        );
        setRouteTable(payload.routeTable);
        setRouteTableDraft(routeTableDraftValue(payload.routeTable));
      } catch (error) {
        if (!controller.signal.aborted) {
          setRouteTableError(readErrorMessage(error, t));
        }
      } finally {
        if (!controller.signal.aborted) {
          setRouteTableLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [projectId, routeTableToken, t]);

  const normalizedDraft = draft.trim().toLowerCase();
  const normalizedBaseline = baselineLabel.trim().toLowerCase();
  const normalizedPathDraft = normalizePathPrefix(pathDraft);
  const normalizedBaselinePathPrefix = normalizePathPrefix(baselinePathPrefix);
  const isDirty =
    normalizedDraft !== normalizedBaseline ||
    normalizedPathDraft !== normalizedBaselinePathPrefix;
  const noteId = `route-note-${appId}`;

  useEffect(() => {
    if (!normalizedDraft) {
      setAvailability(null);
      setAvailabilityError(null);
      setAvailabilityState("idle");
      return;
    }

    if (!isDirty) {
      setAvailability(
        buildCurrentAvailability(
          normalizedBaseline,
          currentHostname,
          currentPublicUrl,
          baseDomain,
          currentPathPrefix,
        ),
      );
      setAvailabilityError(null);
      setAvailabilityState(normalizedBaseline ? "ready" : "idle");
      return;
    }

    setAvailability(null);
    setAvailabilityError(null);
    setAvailabilityState("checking");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const payload = readRouteAvailabilityResponse(
            await requestJson(
              `/api/fugue/apps/${appId}/route/availability?hostname=${encodeURIComponent(normalizedDraft)}&path_prefix=${encodeURIComponent(normalizedPathDraft)}`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
              t,
            ),
          );

          if (!payload.availability) {
            throw new Error(t("Route availability response was malformed."));
          }

          setAvailability(payload.availability);
          setAvailabilityError(null);
          setAvailabilityState("ready");
          setBaseDomain((current) => payload.availability?.baseDomain ?? current);
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setAvailabilityError(readErrorMessage(error, t));
          setAvailabilityState("error");
        }
      })();
    }, 360);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    appId,
    baseDomain,
    checkToken,
    currentHostname,
    currentPublicUrl,
    currentPathPrefix,
    isDirty,
    normalizedBaseline,
    normalizedBaselinePathPrefix,
    normalizedDraft,
    normalizedPathDraft,
  ]);

  const fieldState = useMemo(
    () =>
      readRouteFieldState({
        availability,
        availabilityError,
        availabilityState,
        draft,
        isDirty,
        t,
      }),
    [availability, availabilityError, availabilityState, draft, isDirty, t],
  );
  const helperText = fieldState?.detail ?? readRouteFieldHint(t);

  const canSave =
    !saving &&
    isDirty &&
    availabilityState === "ready" &&
    Boolean(availability?.valid) &&
    Boolean(availability?.available) &&
    !availability?.current;
  const fieldInvalid =
    availabilityState === "error" ||
    (availabilityState === "ready" &&
      Boolean(availability && (!availability.valid || !availability.available)));

  function resetDraft() {
    setDraft(baselineLabel);
    setPathDraft(baselinePathPrefix);
    setAvailability(
      buildCurrentAvailability(
        baselineLabel,
        currentHostname,
        currentPublicUrl,
        baseDomain,
        currentPathPrefix,
      ),
    );
    setAvailabilityError(null);
    setAvailabilityState(baselineLabel ? "ready" : "idle");
  }

  async function saveRoute() {
    if (!canSave) {
      return;
    }

    setSaving(true);

    try {
      const response = readRoutePatchResponse(
        await requestJson(`/api/fugue/apps/${appId}/route`, {
          body: JSON.stringify({
            hostname: normalizedDraft,
            path_prefix: normalizedPathDraft,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        }, t),
      );
      const nextHostname = resolveRouteHostname(
        response.app?.route?.hostname ?? availability?.hostname,
        response.app?.route?.publicUrl ?? availability?.publicUrl,
      );
      const nextPathPrefix = normalizePathPrefix(
        response.app?.route?.pathPrefix ?? response.availability?.pathPrefix ?? normalizedPathDraft,
      );
      const nextBaseDomain =
        response.availability?.baseDomain ??
        baseDomain ??
        readBaseDomainFromHostname(nextHostname);
      const nextLabel = readRouteLabel(nextHostname, nextBaseDomain);
      const nextPublicUrl =
        response.app?.route?.publicUrl ??
        response.availability?.publicUrl ??
        buildRoutePublicUrl(nextHostname, nextPathPrefix);
      const nextAvailability = buildCurrentAvailability(
        nextLabel,
        nextHostname,
        nextPublicUrl,
        nextBaseDomain,
        nextPathPrefix,
      );

      setBaselineLabel(nextLabel);
      setBaselinePathPrefix(nextPathPrefix);
      setCurrentHostname(nextHostname);
      setCurrentPathPrefix(nextPathPrefix);
      setCurrentPublicUrl(nextPublicUrl);
      setBaseDomain(nextBaseDomain);
      setDraft(nextLabel);
      setPathDraft(nextPathPrefix);
      setAvailability(nextAvailability);
      setAvailabilityError(null);
      setAvailabilityState(nextAvailability ? "ready" : "idle");

      showToast({
        message: response.alreadyCurrent
          ? t("This route is already current.")
          : t("Route updated. The new address is live immediately, and the old address has been released."),
        variant: response.alreadyCurrent ? "info" : "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
      setCheckToken((value) => value + 1);
    } finally {
      setSaving(false);
    }
  }

  async function saveProjectRouteTable() {
    if (!projectId || routeTableSaving) {
      return;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(routeTableDraft);
    } catch {
      showToast({
        message: t("Route table JSON is invalid."),
        variant: "error",
      });
      return;
    }

    const { error, payload } = readRouteTableDraftPayload(parsed, t);

    if (error || !payload) {
      showToast({
        message: error ?? t("Route table JSON is invalid."),
        variant: "error",
      });
      return;
    }

    setRouteTableSaving(true);
    setRouteTableError(null);

    try {
      const response = readProjectRouteTableResponse(
        await requestJson(`/api/fugue/projects/${projectId}/routes`, {
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PUT",
        }, t),
      );
      setRouteTable(response.routeTable);
      setRouteTableDraft(routeTableDraftValue(response.routeTable));
      showToast({
        message: t("Project route table updated."),
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      const message = readErrorMessage(error, t);
      setRouteTableError(message);
      showToast({
        message,
        variant: "error",
      });
    } finally {
      setRouteTableSaving(false);
    }
  }

  const routeTableBindings = routeTable?.bindings ?? [];

  return (
    <div className="fg-workbench-section fg-route-panel">
      <div className="fg-workbench-section__copy fg-route-panel__copy">
        <HintInline
          ariaLabel={t("Domains")}
          hint={t("Keep one Fugue subdomain for {appName}, or attach a hostname you control.", {
            appName,
          })}
        >
          <p className="fg-label fg-panel__eyebrow">{t("Domains")}</p>
        </HintInline>
      </div>

      <section aria-label={t("Fugue subdomain")} className="fg-route-subsection fg-route-block">
        <div className="fg-route-panel__form">
          <div className="fg-field-stack fg-route-field">
            <span className="fg-field-label">
              <span className="fg-field-label__main">
                <label className="fg-field-label__text" htmlFor={`route-hostname-${appId}`}>
                  {t("Subdomain")}
                </label>
                {!fieldInvalid ? (
                  <HintTooltip ariaLabel={t("Subdomain")}>{helperText}</HintTooltip>
                ) : null}
              </span>
              {fieldState?.label ? (
                <span
                  className={cx(
                    "fg-route-field__status",
                    `is-${fieldState.variant}`,
                    availabilityState === "checking" && "is-pending",
                  )}
                >
                  {fieldState.label}
                </span>
              ) : null}
            </span>
            <span className={cx("fg-field-control", fieldInvalid && "is-invalid")}>
              <div className="fg-route-composer" data-invalid={fieldInvalid ? "true" : undefined}>
                <div className="fg-route-composer__shell">
                  <input
                    aria-describedby={fieldInvalid ? noteId : undefined}
                    aria-invalid={fieldInvalid ? true : undefined}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    className="fg-route-composer__field"
                    id={`route-hostname-${appId}`}
                    inputMode="text"
                    maxLength={63}
                    onChange={(event) => {
                      setDraft(sanitizeRouteLabelInput(event.target.value, baseDomain));
                    }}
                    placeholder={t("my-app")}
                    spellCheck={false}
                    value={draft}
                  />
                  {baseDomain ? (
                    <span className="fg-route-composer__suffix">.{baseDomain}</span>
                  ) : null}
                </div>
              </div>
            </span>
            {fieldInvalid ? (
              <span
                aria-live="assertive"
                className="fg-field-error fg-route-field__note"
                id={noteId}
                role="alert"
              >
                {helperText}
              </span>
            ) : null}
          </div>

          <div className="fg-field-stack fg-route-field">
            <span className="fg-field-label">
              <span className="fg-field-label__main">
                <label className="fg-field-label__text" htmlFor={`route-path-${appId}`}>
                  {t("Path prefix")}
                </label>
                {!fieldInvalid ? (
                  <HintTooltip ariaLabel={t("Path prefix")}>
                    {t("Use / for the root route, or /api for a path route.")}
                  </HintTooltip>
                ) : null}
              </span>
            </span>
            <span className={cx("fg-field-control", fieldInvalid && "is-invalid")}>
              <div className="fg-route-composer" data-invalid={fieldInvalid ? "true" : undefined}>
                <div className="fg-route-composer__shell">
                  <input
                    aria-describedby={fieldInvalid ? noteId : undefined}
                    aria-invalid={fieldInvalid ? true : undefined}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    className="fg-route-composer__field"
                    id={`route-path-${appId}`}
                    inputMode="text"
                    maxLength={120}
                    onChange={(event) => {
                      setPathDraft(sanitizePathPrefixInput(event.target.value));
                    }}
                    placeholder="/"
                    spellCheck={false}
                    value={pathDraft}
                  />
                </div>
              </div>
            </span>
          </div>

          {isDirty || saving ? (
            <div className="fg-route-panel__form-action">
              <Button
                disabled={!isDirty || saving}
                onClick={resetDraft}
                size="compact"
                type="button"
                variant="secondary"
              >
                {t("Reset")}
              </Button>
              <Button
                disabled={!canSave}
                loading={saving}
                loadingLabel={t("Saving…")}
                onClick={() => {
                  void saveRoute();
                }}
                size="compact"
                type="button"
                variant="primary"
              >
                {t("Save route")}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-label={t("Project route table")} className="fg-route-subsection fg-route-table">
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy">
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("Project route table")}
            </h3>
          </div>
          <span
            className={cx(
              "fg-route-field__status",
              routeTableError ? "is-error" : routeTableLoading ? "is-info" : "is-success",
              routeTableLoading && "is-pending",
            )}
          >
            {routeTableError
              ? t("Unavailable")
              : routeTableLoading
                ? t("Loading")
                : routeTable?.legacy
                  ? t("Legacy")
                  : t("Ready")}
          </span>
        </div>

        {routeTableError ? (
          <p className="fg-field-error fg-route-table__error">{routeTableError}</p>
        ) : null}

        {routeTableLoading && routeTableBindings.length === 0 ? (
          <p className="fg-route-table__empty" aria-live="polite">
            {t("Loading route table…")}
          </p>
        ) : routeTableError && routeTableBindings.length === 0 ? null : routeTableBindings.length > 0 ? (
          <div className="fg-route-table__scroll">
            <table className="fg-route-table__grid">
              <thead>
                <tr>
                  <th>{t("Host")}</th>
                  <th>{t("Path")}</th>
                  <th>{t("Service")}</th>
                  <th>{t("Entrypoint")}</th>
                </tr>
              </thead>
              <tbody>
                {routeTableBindings.map((binding, index) => (
                  <tr
                    key={`${binding.hostname ?? "host"}-${binding.pathPrefix ?? "path"}-${binding.appId ?? index}`}
                  >
                    <td>{binding.hostname ?? "-"}</td>
                    <td>{binding.pathPrefix ?? "/"}</td>
                    <td>{binding.service ?? binding.appName ?? "-"}</td>
                    <td>{binding.entrypointName ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="fg-route-table__empty">{t("No project routes.")}</p>
        )}

        <div className="fg-field-stack fg-route-table__editor-stack">
          <span className="fg-field-label">
            <span className="fg-field-label__main">
              <label className="fg-field-label__text" htmlFor={`route-table-${appId}`}>
                {t("Route table")}
              </label>
            </span>
          </span>
          <textarea
            className="fg-route-table__editor"
            id={`route-table-${appId}`}
            onChange={(event) => {
              setRouteTableDraft(event.target.value);
            }}
            spellCheck={false}
            value={routeTableDraft}
          />
        </div>

        <div className="fg-route-panel__form-action">
          <Button
            disabled={routeTableLoading || routeTableSaving}
            onClick={() => {
              setRouteTableToken((value) => value + 1);
            }}
            size="compact"
            type="button"
            variant="secondary"
          >
            {t("Refresh")}
          </Button>
          <Button
            disabled={!projectId || routeTableLoading || routeTableSaving || !routeTableDraft.trim()}
            loading={routeTableSaving}
            loadingLabel={t("Saving…")}
            onClick={() => {
              void saveProjectRouteTable();
            }}
            size="compact"
            type="button"
            variant="primary"
          >
            {t("Apply table")}
          </Button>
        </div>
      </section>

      <AppCustomDomainsPanel appId={appId} appName={appName} />
    </div>
  );
}
