"use client";

import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { StatusBadge } from "@/components/console/status-badge";
import { Button, InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import type { RuntimeOwnership, RuntimeSharingView } from "@/lib/runtimes/types";

type RuntimeSharingPayload = {
  sharing: RuntimeSharingView;
};

type RuntimePoolMode = "dedicated" | "internal-shared";

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!data) {
    throw new Error("Empty response.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function formatRelativeTime(value?: string | null) {
  if (!value) {
    return "Just now";
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Just now";
  }

  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000);
  const units = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 7, unit: "day" as const },
    { amount: 4.34524, unit: "week" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  let valueForUnit = deltaSeconds;

  for (const { amount, unit } of units) {
    if (Math.abs(valueForUnit) < amount) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.trunc(valueForUnit),
        unit,
      );
    }

    valueForUnit /= amount;
  }

  return "Just now";
}

function normalizePoolMode(value?: string | null): RuntimePoolMode {
  return value === "internal-shared" ? "internal-shared" : "dedicated";
}

function readPoolModeLabel(value?: string | null) {
  return normalizePoolMode(value) === "internal-shared" ? "Enabled" : "Dedicated only";
}

function readAccessSummaryLabel({
  accessMode,
  grantCount,
  ownership,
  poolMode,
}: {
  accessMode: string | null;
  grantCount: number;
  ownership: RuntimeOwnership;
  poolMode: RuntimePoolMode;
}) {
  if (ownership === "internal-cluster") {
    return "Cluster";
  }

  if (ownership === "shared") {
    return "Granted";
  }

  if (accessMode === "platform-shared") {
    return "Platform shared";
  }

  if (grantCount > 0 && poolMode === "internal-shared") {
    return grantCount === 1 ? "1 workspace + cluster" : `${grantCount} workspaces + cluster`;
  }

  if (grantCount > 0) {
    return grantCount === 1 ? "1 workspace" : `${grantCount} workspaces`;
  }

  if (poolMode === "internal-shared") {
    return "Cluster enabled";
  }

  return "Private";
}

function readAccessMeta({
  ownerEmail,
  ownerLabel,
  ownership,
}: {
  ownerEmail: string | null;
  ownerLabel: string;
  ownership: RuntimeOwnership;
}) {
  if (ownership !== "shared") {
    return null;
  }

  return ownerEmail ? `Shared by ${ownerEmail}` : `Shared by ${ownerLabel}`;
}

function readClusterMeta({
  canManagePool,
  ownership,
  poolMode,
}: {
  canManagePool: boolean;
  ownership: RuntimeOwnership;
  poolMode: RuntimePoolMode;
}) {
  if (poolMode === "internal-shared") {
    return "System access · internal cluster can deploy here";
  }

  if (ownership !== "owned") {
    return "System access is not enabled";
  }

  if (canManagePool) {
    return "Allow the internal cluster to deploy here";
  }

  return "Only admins can allow the internal cluster to deploy here";
}

function readClusterTone(value: RuntimePoolMode) {
  return value === "internal-shared" ? "info" : "neutral";
}

function AccessRow({
  action,
  badge,
  meta,
  title,
}: {
  action?: ReactNode;
  badge?: {
    label: string;
    tone?: "danger" | "info" | "neutral" | "positive" | "warning";
  };
  meta?: string;
  title: string;
}) {
  return (
    <article className="fg-runtime-share-row">
      <div className="fg-runtime-share-row__copy">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>

      <div className="fg-runtime-share-row__actions">
        {badge ? <StatusBadge tone={badge.tone ?? "neutral"}>{badge.label}</StatusBadge> : null}
        {action}
      </div>
    </article>
  );
}

const POOL_MODE_OPTIONS = [
  {
    label: "Dedicated",
    value: "dedicated",
  },
  {
    label: "Internal",
    value: "internal-shared",
  },
] satisfies readonly SegmentedControlOption<RuntimePoolMode>[];

export function RuntimeAccessPanel({
  accessMode,
  canManagePool = false,
  canManageSharing = false,
  ownerEmail,
  ownerLabel,
  ownership,
  poolMode,
  runtimeId,
  runtimeType,
}: {
  accessMode: string | null;
  canManagePool?: boolean;
  canManageSharing?: boolean;
  ownerEmail: string | null;
  ownerLabel: string;
  ownership: RuntimeOwnership;
  poolMode: string | null;
  runtimeId: string | null;
  runtimeType: string | null;
}) {
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [sharing, setSharing] = useState<RuntimeSharingView | null>(null);
  const [sharingError, setSharingError] = useState<string | null>(null);
  const [loadingSharing, setLoadingSharing] = useState(() => canManageSharing);
  const [shareEmail, setShareEmail] = useState("");
  const [shareEmailError, setShareEmailError] = useState<string | undefined>();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [currentPoolMode, setCurrentPoolMode] = useState<RuntimePoolMode>(
    () => normalizePoolMode(poolMode),
  );
  const emailFieldId = runtimeId ? `${runtimeId}-share-email` : "runtime-share-email";
  const emailNoteId = `${emailFieldId}-note`;
  const grantCount = sharing?.grants.length ?? 0;
  const summaryLabel = readAccessSummaryLabel({
    accessMode,
    grantCount,
    ownership,
    poolMode: currentPoolMode,
  });
  const accessMeta = readAccessMeta({
    ownerEmail,
    ownerLabel,
    ownership,
  });
  const showShareForm = ownership === "owned" && canManageSharing;
  const showClusterRow =
    runtimeType?.trim().toLowerCase() === "managed-owned" &&
    (ownership === "owned" || currentPoolMode === "internal-shared");

  useEffect(() => {
    setCurrentPoolMode(normalizePoolMode(poolMode));
  }, [poolMode, runtimeId]);

  useEffect(() => {
    if (!runtimeId || !canManageSharing) {
      return;
    }

    let cancelled = false;
    setLoadingSharing(true);
    setSharingError(null);

    requestJson<RuntimeSharingPayload>(
      `/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/sharing`,
      {
        cache: "no-store",
      },
    )
      .then((data) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSharing(data.sharing);
          setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSharingError(readErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSharing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManageSharing, runtimeId]);

  async function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!runtimeId || busyAction) {
      return;
    }

    const nextEmail = shareEmail.trim();

    if (!nextEmail) {
      setShareEmailError("Enter an email address.");
      return;
    }

    setBusyAction("grant");
    setShareEmailError(undefined);

    try {
      const data = await requestJson<RuntimeSharingPayload>(
        `/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/sharing/grants`,
        {
          body: JSON.stringify({ email: nextEmail }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      startTransition(() => {
        setSharing(data.sharing);
        setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
        setShareEmail("");
      });
      setSharingError(null);
      showToast({
        message: `${nextEmail} can now deploy to this server.`,
        variant: "success",
      });
    } catch (error) {
      setShareEmailError(readErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRevoke(tenantId: string, label: string) {
    if (!runtimeId || busyAction) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Remove access",
      description: `${label} will no longer be able to deploy to this server.`,
      title: "Remove workspace access?",
    });

    if (!confirmed) {
      return;
    }

    setBusyAction(`revoke:${tenantId}`);

    try {
      const data = await requestJson<RuntimeSharingPayload>(
        `/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/sharing/grants/${encodeURIComponent(tenantId)}`,
        {
          method: "DELETE",
        },
      );

      startTransition(() => {
        setSharing(data.sharing);
        setCurrentPoolMode(normalizePoolMode(data.sharing.poolMode));
      });
      setSharingError(null);
      showToast({
        message: `${label} no longer has deploy access.`,
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePoolModeChange(nextValue: RuntimePoolMode) {
    if (!runtimeId || busyAction || nextValue === currentPoolMode) {
      return;
    }

    const previousValue = currentPoolMode;
    setCurrentPoolMode(nextValue);
    setBusyAction("pool-mode");

    try {
      const data = await requestJson<{
        nodeReconciled: boolean;
        runtime: {
          poolMode: string | null;
        } | null;
      }>(`/api/fugue/runtimes/${encodeURIComponent(runtimeId)}/pool-mode`, {
        body: JSON.stringify({ pool_mode: nextValue }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const reconciledMode = normalizePoolMode(data.runtime?.poolMode);

      startTransition(() => {
        setCurrentPoolMode(reconciledMode);
        setSharing((current) =>
          current
            ? {
                ...current,
                poolMode: data.runtime?.poolMode ?? reconciledMode,
              }
            : current,
        );
      });
      showToast({
        message:
          reconciledMode === "internal-shared"
            ? data.nodeReconciled
              ? "Internal cluster can now deploy to this server."
              : "Internal cluster access is enabled. Node reconciliation will follow when the server is reachable."
            : data.nodeReconciled
              ? "Internal cluster access removed."
              : "Internal cluster access removed. Node reconciliation will follow when the server is reachable.",
        variant: "success",
      });
    } catch (error) {
      setCurrentPoolMode(previousValue);
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (!runtimeId) {
    return (
      <InlineAlert variant="info">
        Access controls become available after the runtime finishes reporting.
      </InlineAlert>
    );
  }

  return (
    <div className="fg-runtime-access">
      <div className="fg-cluster-node-card__section-head fg-runtime-access__head">
        <div className="fg-runtime-access__copy">
          <p className="fg-label fg-panel__eyebrow">Access</p>
        </div>

        <div className="fg-runtime-access__meta">
          {accessMeta ? <span className="fg-runtime-access__meta-note">{accessMeta}</span> : null}
          <StatusBadge
            tone={
              summaryLabel === "Private"
                ? "neutral"
                : summaryLabel === "Cluster"
                  ? "info"
                  : "info"
            }
          >
            {summaryLabel}
          </StatusBadge>
        </div>
      </div>

      {showShareForm ? (
        <form className="fg-runtime-access-form" onSubmit={handleGrant}>
          <div className="fg-runtime-access-form__field">
            <label className="fg-field-label fg-runtime-access-form__label" htmlFor={emailFieldId}>
              <span>Workspace email</span>
            </label>

            <div className="fg-runtime-access-form__controls">
              <span className={`fg-field-control${shareEmailError ? " is-invalid" : ""}`}>
                <input
                  aria-describedby={emailNoteId}
                  aria-invalid={shareEmailError ? true : undefined}
                  autoCapitalize="none"
                  autoComplete="email"
                  className="fg-input"
                  disabled={busyAction !== null}
                  id={emailFieldId}
                  inputMode="email"
                  onChange={(event) => {
                    setShareEmail(event.target.value);
                    if (shareEmailError) {
                      setShareEmailError(undefined);
                    }
                  }}
                  placeholder="name@company.com"
                  type="email"
                  value={shareEmail}
                />
              </span>

              <div className="fg-runtime-access-form__action">
                <Button
                  disabled={busyAction !== null}
                  loading={busyAction === "grant"}
                  loadingLabel="Adding..."
                  type="submit"
                  variant="primary"
                >
                  Add workspace
                </Button>
              </div>
            </div>

            <span
              aria-live={shareEmailError ? "assertive" : "polite"}
              className={
                shareEmailError
                  ? "fg-field-error fg-runtime-access-form__message"
                  : "fg-field-hint fg-runtime-access-form__message"
              }
              id={emailNoteId}
              role={shareEmailError ? "alert" : undefined}
            >
              {shareEmailError ??
                "The recipient needs to sign in to Fugue and finish workspace setup first."}
            </span>
          </div>
        </form>
      ) : null}

      {sharingError ? (
        <InlineAlert variant="error">{sharingError}</InlineAlert>
      ) : null}

      {loadingSharing ? (
        <InlineAlert variant="info">Loading access roster…</InlineAlert>
      ) : null}

      <div className="fg-runtime-share-list">
        {showClusterRow ? (
          <AccessRow
            action={
              canManagePool && ownership === "owned" ? (
                <SegmentedControl
                  ariaLabel="Internal cluster access"
                  className="fg-runtime-share-row__segmented"
                  controlClassName="fg-console-nav"
                  itemClassName="fg-console-nav__link"
                  labelClassName="fg-console-nav__title"
                  onChange={handlePoolModeChange}
                  options={POOL_MODE_OPTIONS.map((option) => ({
                    ...option,
                    disabled: busyAction !== null,
                  }))}
                  value={currentPoolMode}
                  variant="pill"
                />
              ) : null
            }
            badge={
              !canManagePool || ownership !== "owned"
                ? {
                    label: readPoolModeLabel(currentPoolMode),
                    tone: readClusterTone(currentPoolMode),
                  }
                : undefined
            }
            meta={readClusterMeta({
              canManagePool,
              ownership,
              poolMode: currentPoolMode,
            })}
            title="Internal cluster"
          />
        ) : null}

        {ownership === "internal-cluster" ? (
          <AccessRow
            badge={{ label: "System", tone: "info" }}
            meta="Shared capacity · managed centrally"
            title="Internal cluster"
          />
        ) : null}

        {showShareForm && !loadingSharing && sharing && sharing.grants.length > 0
          ? sharing.grants.map((grant) => (
              <AccessRow
                action={
                  <InlineButton
                    busy={busyAction === `revoke:${grant.tenantId}`}
                    busyLabel="Removing..."
                    danger
                    disabled={busyAction !== null && busyAction !== `revoke:${grant.tenantId}`}
                    label="Remove"
                    onClick={() => handleRevoke(grant.tenantId, grant.label)}
                  />
                }
                badge={{ label: "Workspace" }}
                key={grant.tenantId}
                meta={
                  grant.updatedAt
                    ? `Workspace access · updated ${formatRelativeTime(grant.updatedAt)}`
                    : grant.createdAt
                      ? `Workspace access · granted ${formatRelativeTime(grant.createdAt)}`
                      : "Workspace access"
                }
                title={grant.label}
              />
            ))
          : null}
      </div>

      {showShareForm && !loadingSharing && !sharingError && sharing && sharing.grants.length === 0 ? (
        <p className="fg-runtime-access-empty">No additional workspace access yet.</p>
      ) : null}
    </div>
  );
}
