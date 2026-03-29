"use client";

import { useEffect, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/console/status-badge";
import { Button, InlineButton } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { ProofShellEmpty } from "@/components/ui/proof-shell";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/ui/clipboard";
import { cx } from "@/lib/ui/cx";

type AppCustomDomainsPanelProps = {
  appId: string;
  appName: string;
  customDomainTarget: string | null;
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

type AppDomainVerifyResponse = {
  domain: AppDomain | null;
  verified: boolean;
};

type DomainFieldState = {
  detail: string | null;
  label: string;
  variant: "error" | "info" | "neutral" | "success";
};

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

function sanitizeCustomDomainInput(value: string) {
  let normalized = value.trim().toLowerCase();
  normalized = normalized.replace(/^[a-z]+:\/\//, "");
  normalized = normalized.split("/")[0] ?? normalized;
  normalized = normalized.split("?")[0] ?? normalized;
  normalized = normalized.split("#")[0] ?? normalized;
  normalized = normalized.replace(/:\d+$/, "");
  normalized = normalized.replace(/^\.+/, "").replace(/\.+$/, "");
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
    appId: readStringValue(record, "app_id"),
    createdAt: readStringValue(record, "created_at"),
    hostname,
    lastCheckedAt: readStringValue(record, "last_checked_at"),
    lastMessage: readStringValue(record, "last_message"),
    routeTarget: readStringValue(record, "route_target"),
    status: readStringValue(record, "status"),
    tenantId: readStringValue(record, "tenant_id"),
    updatedAt: readStringValue(record, "updated_at"),
    verificationTxtName: readStringValue(record, "verification_txt_name"),
    verificationTxtValue: readStringValue(record, "verification_txt_value"),
    verifiedAt: readStringValue(record, "verified_at"),
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
    alreadyCurrent: readBooleanValue(record, "already_current"),
    availability: sanitizeAppDomainAvailability(record?.availability),
    domain: sanitizeAppDomain(record?.domain),
  };
}

function readDomainVerifyResponse(value: unknown): AppDomainVerifyResponse {
  const record = asRecord(value);

  return {
    domain: sanitizeAppDomain(record?.domain),
    verified: readBooleanValue(record, "verified"),
  };
}

function parseTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTimestamp(value?: string | null) {
  const timestamp = parseTimestamp(value);

  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
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

function domainHasUnresolvedIssue(domain: AppDomain) {
  return Boolean(domain.lastMessage?.trim()) || !isDomainVerified(domain);
}

function readDomainAttentionMessage(domain: AppDomain, customDomainTarget?: string | null) {
  return (
    domain.lastMessage ??
    (customDomainTarget
      ? `Point ${domain.hostname} at ${customDomainTarget}, wait for DNS to resolve, then retry verification.`
      : "Point this hostname at the Fugue target shown above, wait for DNS to resolve, then retry verification.")
  );
}

function readDefaultHint() {
  return "Enter a hostname you control, like app.example.com or example.com. We will show the DNS record after the hostname looks valid.";
}

function readFieldState(options: {
  availability: AppDomainAvailability | null;
  availabilityError: string | null;
  availabilityState: AvailabilityState;
  customDomainTarget: string | null;
  draft: string;
  existingDomain: AppDomain | null;
  submissionError: string | null;
}) {
  const {
    availability,
    availabilityError,
    availabilityState,
    customDomainTarget,
    draft,
    existingDomain,
    submissionError,
  } = options;

  if (!draft) {
    return null;
  }

  if (submissionError) {
    return {
      label: "Not ready",
      detail: submissionError,
      variant: "error" as const,
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
        detail: readDomainAttentionMessage(existingDomain, customDomainTarget),
        variant: "info" as const,
      } satisfies DomainFieldState;
    }

    if (isDomainVerified(existingDomain) || availability.current) {
      return {
        label: "Attached",
        detail: "This hostname is already serving this app.",
        variant: "neutral" as const,
      } satisfies DomainFieldState;
    }
  }

  if (availability.current) {
    return {
      label: "Attached",
      detail: "This hostname is already serving this app.",
      variant: "neutral" as const,
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
    label: "Ready",
    detail: customDomainTarget
      ? "Hostname looks good. Create the DNS record shown below, then add it here."
      : "Hostname looks good, but this app does not have a DNS target yet.",
    variant: "success" as const,
  } satisfies DomainFieldState;
}

function readDomainBadge(domain: AppDomain) {
  if (domain.lastMessage?.trim()) {
    return {
      label: "Needs check",
      tone: "warning" as const,
    };
  }

  if (isDomainVerified(domain)) {
    return {
      label: "Verified",
      tone: "positive" as const,
    };
  }

  return {
    label: "Pending",
    tone: "info" as const,
  };
}

function readDomainMeta(domain: AppDomain, customDomainTarget?: string | null) {
  if (domain.lastMessage) {
    return domain.lastMessage;
  }

  if (isDomainVerified(domain)) {
    return formatTimestamp(domain.verifiedAt)
      ? `Verified ${formatTimestamp(domain.verifiedAt)}`
      : "Verified and serving traffic.";
  }

  return formatTimestamp(domain.lastCheckedAt)
    ? `Last checked ${formatTimestamp(domain.lastCheckedAt)}`
    : customDomainTarget
      ? `Waiting for DNS to resolve to ${customDomainTarget}.`
      : "Waiting for DNS to resolve to the Fugue target.";
}

export function AppCustomDomainsPanel({
  appId,
  appName,
  customDomainTarget,
}: AppCustomDomainsPanelProps) {
  const { showToast } = useToast();
  const normalizedCustomDomainTarget = normalizeHostname(customDomainTarget);
  const noteId = `custom-domain-note-${appId}`;
  const [domains, setDomains] = useState<AppDomain[]>([]);
  const [domainsState, setDomainsState] = useState<"error" | "loading" | "ready">("loading");
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [availability, setAvailability] = useState<AppDomainAvailability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>("idle");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingHostname, setVerifyingHostname] = useState<string | null>(null);
  const [deletingHostname, setDeletingHostname] = useState<string | null>(null);

  const normalizedDraft = normalizeHostname(draft);
  const existingDomain = findDomain(domains, availability?.hostname ?? normalizedDraft);
  const actionableExistingDomain =
    existingDomain && domainHasUnresolvedIssue(existingDomain) ? existingDomain : null;
  const fieldState = readFieldState({
    availability,
    availabilityError,
    availabilityState,
    customDomainTarget: normalizedCustomDomainTarget,
    draft: normalizedDraft ?? "",
    existingDomain,
    submissionError,
  });
  const fieldInvalid =
    Boolean(submissionError) ||
    availabilityState === "error" ||
    (availabilityState === "ready" &&
      Boolean(availability && (!availability.valid || (!availability.available && !availability.current))));
  const helperText = fieldState?.detail ?? readDefaultHint();
  const canSubmit =
    Boolean(normalizedCustomDomainTarget) &&
    Boolean(normalizedDraft) &&
    !submitting &&
    availabilityState === "ready" &&
    Boolean(availability?.valid) &&
    Boolean(availability?.available) &&
    (!availability?.current || Boolean(actionableExistingDomain));
  const submitLabel = actionableExistingDomain ? "Retry verification" : "Add domain";
  const candidateHostname = availability?.hostname ?? normalizedDraft;
  const showSetupPanel =
    Boolean(normalizedCustomDomainTarget) &&
    availabilityState === "ready" &&
    Boolean(availability?.valid) &&
    Boolean(availability?.available || availability?.current);
  const showTargetUnavailableAlert =
    Boolean(normalizedDraft) &&
    availabilityState === "ready" &&
    Boolean(availability?.valid) &&
    !normalizedCustomDomainTarget;

  async function loadDomains() {
    setDomainsState("loading");
    setDomainsError(null);

    try {
      const payload = readDomainListResponse(
        await requestJson(`/api/fugue/apps/${appId}/domains`, {
          cache: "no-store",
        }),
      );

      setDomains(sortDomains(payload.domains));
      setDomainsError(null);
      setDomainsState("ready");
    } catch (error) {
      setDomainsError(readErrorMessage(error));
      setDomainsState("error");
    }
  }

  function resetDraft() {
    setDraft("");
    setAvailability(null);
    setAvailabilityError(null);
    setAvailabilityState("idle");
    setSubmissionError(null);
  }

  async function runDomainVerification(hostname: string) {
    const response = readDomainVerifyResponse(
      await requestJson(`/api/fugue/apps/${appId}/domains/verify`, {
        body: JSON.stringify({ hostname }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    );

    if (!response.domain) {
      throw new Error("Custom domain verification response was malformed.");
    }

    return {
      domain: response.domain,
      verified: response.verified,
    };
  }

  useEffect(() => {
    void loadDomains();
  }, [appId]);

  useEffect(() => {
    if (!normalizedDraft) {
      setAvailability(null);
      setAvailabilityError(null);
      setAvailabilityState("idle");
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
  }, [appId, normalizedDraft]);

  async function handleCopyTarget() {
    if (!normalizedCustomDomainTarget) {
      return;
    }

    const copied = await copyText(normalizedCustomDomainTarget);

    showToast({
      message: copied
        ? `Copied ${normalizedCustomDomainTarget}.`
        : "Unable to copy the current DNS target.",
      variant: copied ? "success" : "error",
    });
  }

  async function handleRetryVerification(hostname: string) {
    setVerifyingHostname(hostname);

    try {
      const response = await runDomainVerification(hostname);

      setDomains((current) => upsertDomain(current, response.domain));

      if (normalizeHostname(hostname) === normalizedDraft) {
        setSubmissionError(response.verified ? null : response.domain.lastMessage ?? null);
      }

      showToast({
        message: response.verified
          ? `${response.domain.hostname} is now verified.`
          : response.domain.lastMessage ?? `DNS for ${response.domain.hostname} is not ready yet.`,
        variant: response.verified ? "success" : "info",
      });
    } catch (error) {
      const message = readErrorMessage(error);

      if (normalizeHostname(hostname) === normalizedDraft) {
        setSubmissionError(message);
      }

      showToast({
        message,
        variant: "error",
      });
    } finally {
      setVerifyingHostname(null);
    }
  }

  async function handleDeleteDomain(hostname: string) {
    setDeletingHostname(hostname);

    try {
      const response = readDomainMutationResponse(
        await requestJson(
          `/api/fugue/apps/${appId}/domains?hostname=${encodeURIComponent(hostname)}`,
          {
            method: "DELETE",
          },
        ),
      );
      const removedHostname = response.domain?.hostname ?? hostname;

      setDomains((current) => removeDomain(current, removedHostname));

      if (normalizeHostname(removedHostname) === normalizedDraft) {
        resetDraft();
      }

      showToast({
        message: `${removedHostname} has been removed.`,
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setDeletingHostname(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || !normalizedDraft) {
      return;
    }

    setSubmitting(true);
    setSubmissionError(null);

    try {
      if (actionableExistingDomain) {
        const response = await runDomainVerification(actionableExistingDomain.hostname);

        setDomains((current) => upsertDomain(current, response.domain));

        if (response.verified) {
          resetDraft();
        } else {
          setSubmissionError(response.domain.lastMessage ?? null);
        }

        showToast({
          message: response.verified
            ? `${response.domain.hostname} is now verified.`
            : response.domain.lastMessage ?? `DNS for ${response.domain.hostname} is not ready yet.`,
          variant: response.verified ? "success" : "info",
        });

        return;
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
      resetDraft();

      showToast({
        message: response.alreadyCurrent
          ? `${domain.hostname} is already attached to ${appName}.`
          : `${domain.hostname} is verified and now serving ${appName}.`,
        variant: response.alreadyCurrent ? "info" : "success",
      });
    } catch (error) {
      const message = readErrorMessage(error);

      setSubmissionError(message);
      showToast({
        message,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fg-workbench-section fg-domain-panel">
      <div className="fg-workbench-section__head">
        <div className="fg-workbench-section__copy fg-domain-section__copy">
          <p className="fg-label fg-panel__eyebrow">Custom domains</p>
          <p className="fg-console-note">
            Attach a hostname you control. Subdomains and eligible root domains both work. Start with
            the hostname. After it looks valid, Fugue will show the DNS record you need.
          </p>
        </div>
      </div>

      <form className="fg-domain-panel__form" onSubmit={handleSubmit}>
        <label className="fg-field-stack fg-domain-field" htmlFor={`custom-domain-${appId}`}>
          <span className="fg-field-label">
            <span>Hostname</span>
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
            <input
              aria-describedby={noteId}
              aria-invalid={fieldInvalid ? true : undefined}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="fg-input fg-domain-input"
              disabled={submitting}
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
            aria-live={fieldInvalid ? "assertive" : "polite"}
            className={cx(
              fieldInvalid ? "fg-field-error" : "fg-field-hint",
              "fg-domain-field__note",
            )}
            id={noteId}
            role={fieldInvalid ? "alert" : "status"}
          >
            {helperText}
          </span>
        </label>

        {showTargetUnavailableAlert ? (
          <InlineAlert variant="error">
            This app does not have a custom-domain target yet. Check the deployment config, then retry.
          </InlineAlert>
        ) : null}

        {showSetupPanel ? (
          <div className="fg-domain-setup">
            <div className="fg-domain-setup__copy">
              <p className="fg-label fg-domain-setup__eyebrow">Next</p>
              <p className="fg-domain-setup__title">Create one DNS record for this hostname.</p>
              <p className="fg-domain-setup__note">
                Point <code>{candidateHostname}</code> to the Fugue target below. Subdomains usually use
                CNAME. Apex domains can use ALIAS, ANAME, or flattening if your DNS provider supports it.
              </p>
            </div>

            <div className="fg-domain-setup__record">
              <div className="fg-domain-setup__record-row">
                <span>Target</span>
                <code>{normalizedCustomDomainTarget}</code>
              </div>

              <div className="fg-domain-setup__actions">
                <Button
                  onClick={() => {
                    void handleCopyTarget();
                  }}
                  size="compact"
                  type="button"
                  variant="secondary"
                >
                  Copy target
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="fg-domain-panel__form-action">
          <Button
            disabled={!canSubmit}
            loading={submitting}
            loadingLabel={actionableExistingDomain ? "Rechecking…" : "Adding…"}
            type="submit"
            variant="primary"
          >
            {submitLabel}
          </Button>
        </div>
      </form>

      {domainsState === "error" ? (
        <InlineAlert variant="error">
          <span>{domainsError ?? "Unable to load custom domains right now."}</span>
          <Button
            onClick={() => {
              void loadDomains();
            }}
            size="compact"
            type="button"
            variant="secondary"
          >
            Retry
          </Button>
        </InlineAlert>
      ) : null}

      {domainsState === "loading" ? (
        <p className="fg-domain-panel__loading">Loading custom domains…</p>
      ) : null}

      {domainsState === "ready" && domains.length ? (
        <div className="fg-domain-list">
          {domains.map((domain) => {
            const badge = readDomainBadge(domain);
            const showVerifyAction = domainHasUnresolvedIssue(domain);

            return (
              <article className="fg-domain-row" key={domain.hostname}>
                <div className="fg-domain-row__copy">
                  <div className="fg-domain-row__title">
                    <strong className="fg-domain-row__hostname">{domain.hostname}</strong>
                    <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                  </div>
                  <span className="fg-domain-row__target">
                    Target {normalizeHostname(domain.routeTarget) ?? normalizedCustomDomainTarget ?? "Unavailable"}
                  </span>
                  <p className="fg-domain-row__meta">
                    {readDomainMeta(domain, normalizeHostname(domain.routeTarget) ?? normalizedCustomDomainTarget)}
                  </p>
                </div>

                <div className="fg-domain-row__actions">
                  {showVerifyAction ? (
                    <InlineButton
                      busy={verifyingHostname === domain.hostname}
                      busyLabel="Rechecking…"
                      disabled={Boolean(deletingHostname)}
                      label="Retry verification"
                      onClick={() => {
                        void handleRetryVerification(domain.hostname);
                      }}
                    />
                  ) : null}
                  <InlineButton
                    busy={deletingHostname === domain.hostname}
                    busyLabel="Removing…"
                    danger
                    disabled={Boolean(verifyingHostname)}
                    label="Remove"
                    onClick={() => {
                      void handleDeleteDomain(domain.hostname);
                    }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {domainsState === "ready" && !domains.length ? (
        <ProofShellEmpty
          className="fg-domain-panel__empty"
          description="Enter a hostname above to create the first binding."
          title="No custom domains yet"
        />
      ) : null}
    </div>
  );
}
