"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/ui/cx";

type AppCustomDomainsPanelProps = {
  appId: string;
  appName: string;
};

type AvailabilityState = "checking" | "error" | "idle" | "ready";

type AppDomain = {
  appId: string | null;
  createdAt: string | null;
  hostname: string;
  lastCheckedAt: string | null;
  lastMessage: string | null;
  routeTarget: string | null;
  status: string | null;
  tenantId: string | null;
  tlsLastCheckedAt: string | null;
  tlsLastMessage: string | null;
  tlsReadyAt: string | null;
  tlsStatus: string | null;
  updatedAt: string | null;
  verificationTxtName: string | null;
  verificationTxtValue: string | null;
  verifiedAt: string | null;
};

type AppDomainAvailability = {
  available: boolean;
  current: boolean;
  hostname: string | null;
  input: string | null;
  reason: string | null;
  valid: boolean;
};

type AppDomainListResponse = {
  domains: AppDomain[];
};

type AppDomainAvailabilityResponse = {
  availability: AppDomainAvailability | null;
};

type AppDomainMutationResponse = {
  alreadyCurrent: boolean;
  availability: AppDomainAvailability | null;
  domain: AppDomain | null;
};

type DomainFieldState = {
  detail: string | null;
  label: string;
  variant: "error" | "info" | "neutral" | "success";
};

const DOMAIN_AUTO_REFRESH_INTERVAL_MS = 4_000;

function asRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringValueAny(record: Record<string, unknown> | null, keys: string[]) {
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

function readBooleanValueAny(record: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    if (typeof record?.[key] === "boolean") {
      return readBooleanValue(record, key);
    }
  }

  return false;
}

function normalizeHostname(value?: string | null) {
  const normalized = (value?.trim().toLowerCase() ?? "")
    .replace(/[。．｡]/g, ".")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");
  return normalized || null;
}

function extractDomainTarget(value?: string | null) {
  const message = value?.trim() ?? "";

  if (!message) {
    return null;
  }

  const match = message.match(/\bpointing to\s+([a-z0-9.-]+\.[a-z0-9-]+)\b/i);
  return normalizeHostname(match?.[1] ?? null);
}

function buildDNSGuidanceMessage(hostname?: string | null, target?: string | null) {
  const normalizedHostname = normalizeHostname(hostname);
  const normalizedTarget = normalizeHostname(target);

  if (!normalizedTarget) {
    return "Finish DNS setup and Fugue will verify this hostname automatically.";
  }

  if (!normalizedHostname) {
    return `Create a CNAME record pointing to ${normalizedTarget}. Fugue will verify it automatically once DNS resolves.`;
  }

  return `Create a CNAME record for ${normalizedHostname} pointing to ${normalizedTarget}. Fugue will verify it automatically once DNS resolves.`;
}

function sanitizeCustomDomainInput(value: string) {
  let normalized = value.trim().toLowerCase();
  normalized = normalized.replace(/[。．｡]/g, ".");
  normalized = normalized.replace(/^[a-z]+:\/\//, "");
  normalized = normalized.split("/")[0] ?? normalized;
  normalized = normalized.split("?")[0] ?? normalized;
  normalized = normalized.split("#")[0] ?? normalized;
  normalized = normalized.replace(/:\d+$/, "");
  normalized = normalized.replace(/^\.+/, "");
  return normalized;
}

function readAvailabilityReason(reason?: string | null) {
  const normalized = reason?.trim() ?? "";

  if (!normalized) {
    return null;
  }

  if (normalized === "platform-managed hostnames must be updated through the app route endpoint") {
    return "This platform hostname is reserved. Platform admins can attach the root domain directly, but regular workspaces cannot claim it.";
  }

  return normalized;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

async function readResponseError(response: Response) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return `Request failed with status ${response.status}.`;
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

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }

  return (await response.json().catch(() => null)) as T | null;
}

function sanitizeAppDomain(value: unknown): AppDomain | null {
  const record = asRecord(value);
  const hostname = readStringValue(record, "hostname");

  if (!hostname) {
    return null;
  }

  return {
    appId: readStringValueAny(record, ["app_id", "appId"]),
    createdAt: readStringValueAny(record, ["created_at", "createdAt"]),
    hostname,
    lastCheckedAt: readStringValueAny(record, ["last_checked_at", "lastCheckedAt"]),
    lastMessage: readStringValueAny(record, ["last_message", "lastMessage"]),
    routeTarget: readStringValueAny(record, ["route_target", "routeTarget"]),
    status: readStringValue(record, "status"),
    tenantId: readStringValueAny(record, ["tenant_id", "tenantId"]),
    tlsLastCheckedAt: readStringValueAny(record, ["tls_last_checked_at", "tlsLastCheckedAt"]),
    tlsLastMessage: readStringValueAny(record, ["tls_last_message", "tlsLastMessage"]),
    tlsReadyAt: readStringValueAny(record, ["tls_ready_at", "tlsReadyAt"]),
    tlsStatus: readStringValueAny(record, ["tls_status", "tlsStatus"]),
    updatedAt: readStringValueAny(record, ["updated_at", "updatedAt"]),
    verificationTxtName: readStringValueAny(record, [
      "verification_txt_name",
      "verificationTxtName",
    ]),
    verificationTxtValue: readStringValueAny(record, [
      "verification_txt_value",
      "verificationTxtValue",
    ]),
    verifiedAt: readStringValueAny(record, ["verified_at", "verifiedAt"]),
  };
}

function sanitizeAppDomainAvailability(value: unknown): AppDomainAvailability | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    available: readBooleanValue(record, "available"),
    current: readBooleanValue(record, "current"),
    hostname: readStringValue(record, "hostname"),
    input: readStringValue(record, "input"),
    reason: readStringValue(record, "reason"),
    valid: readBooleanValue(record, "valid"),
  };
}

function readDomainListResponse(value: unknown): AppDomainListResponse {
  const record = asRecord(value);

  return {
    domains: (Array.isArray(record?.domains) ? record.domains : [])
      .map(sanitizeAppDomain)
      .filter((item): item is AppDomain => Boolean(item)),
  };
}

function readDomainAvailabilityResponse(value: unknown): AppDomainAvailabilityResponse {
  const record = asRecord(value);

  return {
    availability: sanitizeAppDomainAvailability(record?.availability),
  };
}

function readDomainMutationResponse(value: unknown): AppDomainMutationResponse {
  const record = asRecord(value);

  return {
    alreadyCurrent: readBooleanValueAny(record, ["already_current", "alreadyCurrent"]),
    availability: sanitizeAppDomainAvailability(record?.availability),
    domain: sanitizeAppDomain(record?.domain),
  };
}

function parseTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortDomains(domains: AppDomain[]) {
  return [...domains].sort((left, right) => {
    const createdDelta = parseTimestamp(left.createdAt) - parseTimestamp(right.createdAt);

    if (createdDelta !== 0) {
      return createdDelta;
    }

    return left.hostname.localeCompare(right.hostname);
  });
}

function upsertDomain(domains: AppDomain[], nextDomain: AppDomain) {
  const normalizedHostname = normalizeHostname(nextDomain.hostname);

  return sortDomains(
    domains
      .filter((domain) => normalizeHostname(domain.hostname) !== normalizedHostname)
      .concat(nextDomain),
  );
}

function removeDomain(domains: AppDomain[], hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);
  return domains.filter((domain) => normalizeHostname(domain.hostname) !== normalizedHostname);
}

function findDomain(domains: AppDomain[], hostname?: string | null) {
  const normalizedHostname = normalizeHostname(hostname);

  if (!normalizedHostname) {
    return null;
  }

  return domains.find((domain) => normalizeHostname(domain.hostname) === normalizedHostname) ?? null;
}

function isDomainVerified(domain: AppDomain) {
  return (domain.status?.trim().toLowerCase() ?? "") === "verified";
}

function readDomainSetupStatus(domain: AppDomain) {
  if (!isDomainVerified(domain)) {
    return "dns-pending" as const;
  }

  switch (domain.tlsStatus?.trim().toLowerCase() ?? "") {
    case "ready":
      return "ready" as const;
    case "error":
      return "error" as const;
    default:
      return "setting-up" as const;
  }
}

function domainHasUnresolvedIssue(domain: AppDomain) {
  return Boolean(domain.lastMessage?.trim()) || !isDomainVerified(domain);
}

function domainNeedsStatusRefresh(domain?: AppDomain | null) {
  if (!domain) {
    return false;
  }

  return domainHasUnresolvedIssue(domain) || readDomainSetupStatus(domain) !== "ready";
}

function readDomainAttentionMessage(domain: AppDomain) {
  const target = extractDomainTarget(domain.lastMessage) ?? domain.routeTarget;

  if (target) {
    return buildDNSGuidanceMessage(domain.hostname, target);
  }

  return domain.lastMessage ?? "Fugue is waiting for DNS to resolve for this hostname.";
}

function readDefaultHint() {
  return "Use a hostname you control, like app.example.com or example.com.";
}

function readFieldState(options: {
  availability: AppDomainAvailability | null;
  availabilityError: string | null;
  availabilityState: AvailabilityState;
  draft: string;
  existingDomain: AppDomain | null;
  hasAttachedDomain: boolean;
  submissionError: string | null;
}) {
  const {
    availability,
    availabilityError,
    availabilityState,
    draft,
    existingDomain,
    hasAttachedDomain,
    submissionError,
  } = options;

  if (!draft) {
    return null;
  }

  if (submissionError) {
    const targetFromSubmission = extractDomainTarget(submissionError);

    return {
      label: targetFromSubmission ? "DNS needed" : "Not ready",
      detail: targetFromSubmission
        ? buildDNSGuidanceMessage(draft, targetFromSubmission)
        : submissionError,
      variant: targetFromSubmission ? ("info" as const) : ("error" as const),
    } satisfies DomainFieldState;
  }

  if (availabilityState === "checking") {
    return {
      label: "Checking",
      detail: "Checking hostname availability…",
      variant: "info" as const,
    } satisfies DomainFieldState;
  }

  if (availabilityState === "error") {
    return {
      label: "Check failed",
      detail: availabilityError ?? "Unable to check hostname availability right now.",
      variant: "error" as const,
    } satisfies DomainFieldState;
  }

  if (!availability) {
    return null;
  }

  if (!availability.valid) {
    return {
      label: "Invalid",
      detail: readAvailabilityReason(availability.reason) ?? "This hostname is invalid.",
      variant: "error" as const,
    } satisfies DomainFieldState;
  }

  if (existingDomain) {
    if (domainHasUnresolvedIssue(existingDomain)) {
      return {
        label: "Pending",
        detail: readDomainAttentionMessage(existingDomain),
        variant: "info" as const,
      } satisfies DomainFieldState;
    }

    const setupStatus = readDomainSetupStatus(existingDomain);

    if (setupStatus === "setting-up") {
      return {
        label: "Setting up",
        detail: "This hostname is attached. Fugue is finishing setup now.",
        variant: "info" as const,
      } satisfies DomainFieldState;
    }

    if (setupStatus === "error") {
      return {
        label: "Needs attention",
        detail: "This hostname is attached, but setup hit a snag. Fugue will keep retrying in the background.",
        variant: "error" as const,
      } satisfies DomainFieldState;
    }

    if (isDomainVerified(existingDomain) || availability.current) {
      return {
        label: "Ready",
        detail: "This hostname is already serving this app.",
        variant: "success" as const,
      } satisfies DomainFieldState;
    }
  }

  if (availability.current) {
    return {
      label: "Ready",
      detail: "This hostname is already serving this app.",
      variant: "success" as const,
    } satisfies DomainFieldState;
  }

  if (!availability.available) {
    return {
      label: "In use",
      detail: readAvailabilityReason(availability.reason) ?? "This hostname is already in use.",
      variant: "error" as const,
    } satisfies DomainFieldState;
  }

  return {
    label: "Available",
    detail: hasAttachedDomain
      ? "Hostname looks good. Save to replace the current domain."
      : "Hostname looks good. Save to attach it.",
    variant: "success" as const,
  } satisfies DomainFieldState;
}

function readDomainConnectedToast(domain: AppDomain, appName: string, alreadyCurrent = false) {
  switch (readDomainSetupStatus(domain)) {
    case "dns-pending": {
      const guidance = buildDNSGuidanceMessage(domain.hostname, domain.routeTarget);
      return alreadyCurrent
        ? `${domain.hostname} is already attached to ${appName}. ${guidance}`
        : `${domain.hostname} is attached to ${appName}. ${guidance}`;
    }
    case "ready":
      return alreadyCurrent
        ? `${domain.hostname} is already serving ${appName}.`
        : `${domain.hostname} is ready and now serving ${appName}.`;
    case "error":
      return `${domain.hostname} is attached to ${appName}, but setup still needs attention.`;
    case "setting-up":
      return alreadyCurrent
        ? `${domain.hostname} is already attached to ${appName}. Fugue is finishing setup now.`
        : `${domain.hostname} is attached to ${appName}. Fugue is finishing setup now.`;
    default:
      return alreadyCurrent ? `${domain.hostname} is already attached to ${appName}.` : `${domain.hostname} is attached to ${appName}.`;
  }
}

function buildAttachedDomainAvailability(hostname?: string | null, current = false) {
  const normalizedHostname = normalizeHostname(hostname);

  if (!normalizedHostname) {
    return null;
  }

  return {
    available: true,
    current,
    hostname: normalizedHostname,
    input: normalizedHostname,
    reason: null,
    valid: true,
  } satisfies AppDomainAvailability;
}

function buildAvailabilityForDomain(domain?: AppDomain | null) {
  return buildAttachedDomainAvailability(domain?.hostname, Boolean(domain && isDomainVerified(domain)));
}

export function AppCustomDomainsPanel({
  appId,
  appName,
}: AppCustomDomainsPanelProps) {
  const { showToast } = useToast();
  const noteId = `custom-domain-note-${appId}`;
  const [domains, setDomains] = useState<AppDomain[]>([]);
  const [domainsState, setDomainsState] = useState<"error" | "loading" | "ready">("loading");
  const [draft, setDraft] = useState("");
  const [baselineHostname, setBaselineHostname] = useState("");
  const [availability, setAvailability] = useState<AppDomainAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const domainsRefreshAbortRef = useRef<AbortController | null>(null);
  const domainsRefreshPendingRef = useRef(false);

  const normalizedDraft = normalizeHostname(draft);
  const normalizedBaseline = normalizeHostname(baselineHostname);
  const isDirty = normalizedDraft !== normalizedBaseline;
  const submissionTarget = extractDomainTarget(submissionError);
  const loadErrorMessage =
    domainsState === "error"
      ? availabilityError ?? "Unable to load the current custom domain right now."
      : null;
  const existingDomain = findDomain(domains, availability?.hostname ?? normalizedDraft);
  const fieldState = readFieldState({
    availability,
    availabilityError,
    availabilityState,
    draft: normalizedDraft ?? "",
    existingDomain,
    hasAttachedDomain: Boolean(normalizedBaseline),
    submissionError,
  });
  const fieldInvalid =
    Boolean(submissionError && !submissionTarget) ||
    availabilityState === "error" ||
    (availabilityState === "ready" &&
      Boolean(
        availability && (!availability.valid || (!availability.available && !availability.current)),
      ));
  const helperText = fieldState?.detail ?? loadErrorMessage ?? readDefaultHint();
  const canSave =
    domainsState === "ready" &&
    Boolean(normalizedDraft) &&
    !submitting &&
    isDirty &&
    availabilityState === "ready" &&
    Boolean(availability?.valid) &&
    Boolean(availability?.available) &&
    !availability?.current;
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const refreshDomains = useEffectEvent(
    async (options?: { silent?: boolean; syncDraft?: boolean }) => {
      if (domainsRefreshPendingRef.current) {
        return false;
      }

      const silent = options?.silent ?? false;
      const syncDraft = options?.syncDraft ?? false;

      if (!silent) {
        setDomainsState("loading");
      }

      domainsRefreshPendingRef.current = true;
      const controller = new AbortController();
      domainsRefreshAbortRef.current = controller;

      try {
        const payload = readDomainListResponse(
          await requestJson(`/api/fugue/apps/${appId}/domains`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        );

        if (controller.signal.aborted) {
          return false;
        }

        const nextDomains = sortDomains(payload.domains);
        const nextDomain = nextDomains[0] ?? null;
        const nextHostname = nextDomain?.hostname ?? "";

        startTransition(() => {
          setDomains(nextDomains);
          setBaselineHostname(nextHostname);
          if (syncDraft) {
            setDraft(nextHostname);
          }
          if (syncDraft || !isDirtyRef.current) {
            setAvailability(buildAvailabilityForDomain(nextDomain));
            setAvailabilityError(null);
            setAvailabilityState(nextHostname ? "ready" : "idle");
          }
          if (syncDraft) {
            setSubmissionError(null);
          }
          setDomainsState("ready");
        });

        return true;
      } catch (error) {
        if (controller.signal.aborted) {
          return false;
        }

        if (!silent) {
          setAvailabilityError(readErrorMessage(error));
          setDomainsState("error");
        }

        return false;
      } finally {
        if (domainsRefreshAbortRef.current === controller) {
          domainsRefreshAbortRef.current = null;
        }

        domainsRefreshPendingRef.current = false;
      }
    },
  );

  function resetDraft() {
    const baselineDomain = findDomain(domains, baselineHostname);

    setDraft(baselineHostname);
    setAvailability(buildAvailabilityForDomain(baselineDomain));
    setAvailabilityError(null);
    setAvailabilityState(normalizedBaseline ? "ready" : "idle");
    setSubmissionError(null);
  }

  useEffect(() => {
    domainsRefreshAbortRef.current?.abort();
    domainsRefreshAbortRef.current = null;
    domainsRefreshPendingRef.current = false;

    void refreshDomains({ syncDraft: true });
  }, [appId, refreshDomains]);

  useEffect(() => {
    return () => {
      domainsRefreshAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (domainsState !== "ready") {
      setAvailability(null);
      setAvailabilityState("idle");
      return;
    }

    if (!normalizedDraft) {
      setAvailability(null);
      setAvailabilityError(null);
      setAvailabilityState("idle");
      return;
    }

    if (!isDirty) {
      setAvailability(buildAvailabilityForDomain(findDomain(domains, normalizedBaseline)));
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
          const payload = readDomainAvailabilityResponse(
            await requestJson(
              `/api/fugue/apps/${appId}/domains/availability?hostname=${encodeURIComponent(normalizedDraft)}`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
          );

          if (!payload.availability) {
            throw new Error("Custom domain availability response was malformed.");
          }

          setAvailability(payload.availability);
          setAvailabilityError(null);
          setAvailabilityState("ready");
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }

          setAvailabilityError(readErrorMessage(error));
          setAvailabilityState("error");
        }
      })();
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [appId, domains, domainsState, isDirty, normalizedBaseline, normalizedDraft]);

  useEffect(() => {
    const baselineDomain = findDomain(domains, normalizedBaseline);

    if (
      domainsState !== "ready" ||
      !normalizedBaseline ||
      isDirty ||
      submitting ||
      !domainNeedsStatusRefresh(baselineDomain)
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshDomains({ silent: true });
    }, DOMAIN_AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    domains,
    domainsState,
    isDirty,
    normalizedBaseline,
    refreshDomains,
    submitting,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSave || !normalizedDraft) {
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    try {
      if (normalizedBaseline) {
        await requestJson(
          `/api/fugue/apps/${appId}/domains?hostname=${encodeURIComponent(normalizedBaseline)}`,
          {
            method: "DELETE",
          },
        );

        setDomains((current) => removeDomain(current, normalizedBaseline));
        setBaselineHostname("");
      }

      const response = readDomainMutationResponse(
        await requestJson(`/api/fugue/apps/${appId}/domains`, {
          body: JSON.stringify({
            hostname: normalizedDraft,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );

      if (!response.domain) {
        throw new Error("Custom domain response was malformed.");
      }

      const domain = response.domain;

      setDomains((current) => upsertDomain(current, domain));
      setBaselineHostname(domain.hostname);
      setDraft(domain.hostname);
      setAvailability(response.availability ?? buildAvailabilityForDomain(domain));
      setAvailabilityError(null);
      setAvailabilityState("ready");
      setSubmissionError(null);

      showToast({
        message: readDomainConnectedToast(domain, appName, response.alreadyCurrent),
        variant: response.alreadyCurrent ? "info" : "success",
      });
    } catch (error) {
      const message = readErrorMessage(error);
      const target = extractDomainTarget(message);
      setSubmissionError(message);
      showToast({
        message: target ? buildDNSGuidanceMessage(normalizedDraft, target) : message,
        variant: target ? "info" : "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="Custom domains" className="fg-route-subsection fg-domain-panel">
      <form className="fg-domain-panel__form" onSubmit={handleSubmit}>
        <label className="fg-field-stack fg-domain-field" htmlFor={`custom-domain-${appId}`}>
          <span className="fg-field-label">
            <span>Custom domain</span>
            {domainsState === "loading" && !normalizedDraft ? (
              <span className="fg-route-field__status is-neutral">Loading</span>
            ) : loadErrorMessage ? (
              <span className="fg-route-field__status is-error">Unavailable</span>
            ) : fieldState?.label ? (
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
            <input
              aria-describedby={noteId}
              aria-invalid={fieldInvalid ? true : undefined}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="fg-input fg-domain-input"
              disabled={submitting || domainsState === "loading"}
              id={`custom-domain-${appId}`}
              inputMode="url"
              maxLength={253}
              onChange={(event) => {
                setDraft(sanitizeCustomDomainInput(event.target.value));
                setSubmissionError(null);
              }}
              placeholder="app.example.com or example.com"
              spellCheck={false}
              value={draft}
            />
          </span>

          <span
            aria-live={fieldInvalid || loadErrorMessage ? "assertive" : "polite"}
            className={cx(
              fieldInvalid || loadErrorMessage ? "fg-field-error" : "fg-field-hint",
              "fg-domain-field__note",
            )}
            id={noteId}
            role={fieldInvalid || loadErrorMessage ? "alert" : "status"}
          >
            {helperText}
          </span>
        </label>

        {isDirty || submitting ? (
          <div className="fg-route-panel__form-action">
            <Button
              disabled={!isDirty || submitting}
              onClick={resetDraft}
              size="compact"
              type="button"
              variant="secondary"
            >
              Reset
            </Button>
            <Button
              disabled={!canSave}
              loading={submitting}
              loadingLabel="Saving…"
              size="compact"
              type="submit"
              variant="primary"
            >
              Save
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
