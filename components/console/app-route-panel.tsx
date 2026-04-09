"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppCustomDomainsPanel } from "@/components/console/app-custom-domains-panel";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/ui/cx";

type RouteAvailability = {
  available: boolean;
  baseDomain: string | null;
  current: boolean;
  hostname: string | null;
  input: string | null;
  label: string | null;
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
      publicUrl: string | null;
    } | null;
  } | null;
  availability: RouteAvailability | null;
};

type RoutePanelProps = {
  appId: string;
  appName: string;
  initialBaseDomain: string | null;
  initialHostname: string | null;
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

function readBooleanValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : false;
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
    baseDomain: readStringValue(record, "base_domain"),
    current: readBooleanValue(record, "current"),
    hostname: readStringValue(record, "hostname"),
    input: readStringValue(record, "input"),
    label: readStringValue(record, "label"),
    publicUrl: readStringValue(record, "public_url"),
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
    alreadyCurrent: readBooleanValue(record, "already_current"),
    app: app
      ? {
          route: route
            ? {
                hostname: readStringValue(route, "hostname"),
                publicUrl: readStringValue(route, "public_url"),
              }
            : null,
        }
      : null,
    availability: sanitizeRouteAvailability(record?.availability),
  };
}

function buildCurrentAvailability(
  label: string,
  hostname: string | null,
  publicUrl: string | null,
  baseDomain: string | null,
) {
  if (!label && !hostname) {
    return null;
  }

  const resolvedHostname =
    hostname ?? (label && baseDomain ? `${label}.${baseDomain}` : label || null);

  return {
    available: true,
    baseDomain,
    current: true,
    hostname: resolvedHostname,
    input: label || resolvedHostname,
    label: label || readRouteLabel(resolvedHostname, baseDomain),
    publicUrl: publicUrl ?? (resolvedHostname ? `https://${resolvedHostname}` : null),
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
  initialBaseDomain,
  initialHostname,
  initialPublicUrl,
}: RoutePanelProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [checkToken, setCheckToken] = useState(0);
  const [draft, setDraft] = useState("");
  const [baselineLabel, setBaselineLabel] = useState("");
  const [currentHostname, setCurrentHostname] = useState<string | null>(null);
  const [currentPublicUrl, setCurrentPublicUrl] = useState<string | null>(null);
  const [baseDomain, setBaseDomain] = useState<string | null>(null);
  const [availability, setAvailability] = useState<RouteAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextHostname = resolveRouteHostname(initialHostname, initialPublicUrl) ?? "";
    const nextBaseDomain =
      normalizeHostname(initialBaseDomain) ?? readBaseDomainFromHostname(nextHostname);
    const nextLabel = readRouteLabel(nextHostname, nextBaseDomain);
    const nextPublicUrl = initialPublicUrl?.trim() || (nextHostname ? `https://${nextHostname}` : null);
    const nextAvailability = buildCurrentAvailability(
      nextLabel,
      nextHostname || null,
      nextPublicUrl,
      nextBaseDomain,
    );

    setDraft(nextLabel);
    setBaselineLabel(nextLabel);
    setCurrentHostname(nextHostname || null);
    setCurrentPublicUrl(nextPublicUrl);
    setBaseDomain(nextBaseDomain);
    setAvailability(nextAvailability);
    setAvailabilityError(null);
    setAvailabilityState(nextAvailability ? "ready" : "idle");
    setCheckToken(0);
  }, [appId, initialBaseDomain, initialHostname, initialPublicUrl]);

  const normalizedDraft = draft.trim().toLowerCase();
  const normalizedBaseline = baselineLabel.trim().toLowerCase();
  const isDirty = normalizedDraft !== normalizedBaseline;
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
              `/api/fugue/apps/${appId}/route/availability?hostname=${encodeURIComponent(normalizedDraft)}`,
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
    isDirty,
    normalizedBaseline,
    normalizedDraft,
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
    setAvailability(
      buildCurrentAvailability(
        baselineLabel,
        currentHostname,
        currentPublicUrl,
        baseDomain,
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
      const nextBaseDomain =
        response.availability?.baseDomain ??
        baseDomain ??
        readBaseDomainFromHostname(nextHostname);
      const nextLabel = readRouteLabel(nextHostname, nextBaseDomain);
      const nextPublicUrl =
        response.app?.route?.publicUrl ??
        response.availability?.publicUrl ??
        (nextHostname ? `https://${nextHostname}` : null);
      const nextAvailability = buildCurrentAvailability(
        nextLabel,
        nextHostname,
        nextPublicUrl,
        nextBaseDomain,
      );

      setBaselineLabel(nextLabel);
      setCurrentHostname(nextHostname);
      setCurrentPublicUrl(nextPublicUrl);
      setBaseDomain(nextBaseDomain);
      setDraft(nextLabel);
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

  return (
    <div className="fg-workbench-section fg-route-panel">
      <div className="fg-workbench-section__copy fg-route-panel__copy">
        <p className="fg-label fg-panel__eyebrow">{t("Domains")}</p>
        <p className="fg-console-note">
          {t("Keep one Fugue subdomain for {appName}, or attach a hostname you control.", {
            appName,
          })}
        </p>
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

      <AppCustomDomainsPanel appId={appId} appName={appName} />
    </div>
  );
}
