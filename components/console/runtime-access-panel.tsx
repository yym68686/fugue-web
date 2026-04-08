"use client";

import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { Button, InlineButton } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import type { TranslationValues } from "@/lib/i18n/core";
import type { RuntimeOwnership, RuntimeSharingView } from "@/lib/runtimes/types";

type RuntimeSharingPayload = {
  sharing: RuntimeSharingView;
};

type RuntimePoolMode = "dedicated" | "internal-shared";

type Translator = (key: string, values?: TranslationValues) => string;

function readErrorMessage(error: unknown, t: Translator = (key) => key) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
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

function formatRelativeTime(
  value: string | null | undefined,
  formatter: (
    value?: string | number | Date | null,
    options?: {
      justNowText?: string;
      notYetText?: string;
    },
  ) => string,
) {
  if (!value) {
    return formatter(null, { notYetText: "Just now" });
  }
  return formatter(value, {
    justNowText: "Just now",
    notYetText: "Just now",
  });
}

function normalizePoolMode(value?: string | null): RuntimePoolMode {
  return value === "internal-shared" ? "internal-shared" : "dedicated";
}

function readPoolModeLabel(
  value: string | null | undefined,
  t: Translator = (key) => key,
) {
  return normalizePoolMode(value) === "internal-shared"
    ? t("Enabled")
    : t("Dedicated only");
}

function readAccessSummaryLabel({
  accessMode,
  grantCount,
  ownership,
  poolMode,
  t,
}: {
  accessMode: string | null;
  grantCount: number;
  ownership: RuntimeOwnership;
  poolMode: RuntimePoolMode;
  t: Translator;
}) {
  if (ownership === "internal-cluster") {
    return t("Cluster");
  }

  if (ownership === "shared") {
    return t("Granted");
  }

  if (accessMode === "platform-shared") {
    return t("Platform shared");
  }

  if (grantCount > 0 && poolMode === "internal-shared") {
    return t(
      grantCount === 1
        ? "{count} workspace + cluster"
        : "{count} workspaces + cluster",
      {
        count: grantCount,
      },
    );
  }

  if (grantCount > 0) {
    return t(
      grantCount === 1 ? "{count} workspace" : "{count} workspaces",
      {
        count: grantCount,
      },
    );
  }

  if (poolMode === "internal-shared") {
    return t("Cluster enabled");
  }

  return t("Private");
}

function readAccessMeta({
  ownerEmail,
  ownerLabel,
  ownership,
  t,
}: {
  ownerEmail: string | null;
  ownerLabel: string;
  ownership: RuntimeOwnership;
  t: Translator;
}) {
  if (ownership !== "shared") {
    return null;
  }

  return ownerEmail
    ? t("Shared by {label}", { label: ownerEmail })
    : t("Shared by {label}", { label: ownerLabel });
}

function readClusterMeta({
  canManagePool,
  ownership,
  poolMode,
  t,
}: {
  canManagePool: boolean;
  ownership: RuntimeOwnership;
  poolMode: RuntimePoolMode;
  t: Translator;
}) {
  if (poolMode === "internal-shared") {
    return t("System access · internal cluster can deploy here");
  }

  if (ownership !== "owned") {
    return t("System access is not enabled");
  }

  if (canManagePool) {
    return t("Allow the internal cluster to deploy here");
  }

  return t("Only admins can allow the internal cluster to deploy here");
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
  const { formatRelativeTime: formatRelativeTimeValue, t } = useI18n();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const poolModeOptions = [
    {
      label: t("Dedicated"),
      value: "dedicated",
    },
    {
      label: t("Internal"),
      value: "internal-shared",
    },
  ] satisfies readonly SegmentedControlOption<RuntimePoolMode>[];
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
    t,
  });
  const accessMeta = readAccessMeta({
    ownerEmail,
    ownerLabel,
    ownership,
    t,
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

        setSharingError(readErrorMessage(error, t));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSharing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canManageSharing, runtimeId, t]);

  async function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!runtimeId || busyAction) {
      return;
    }

    const nextEmail = shareEmail.trim();

    if (!nextEmail) {
      setShareEmailError(t("Enter an email address."));
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
        message: t("{email} can now deploy to this server.", {
          email: nextEmail,
        }),
        variant: "success",
      });
    } catch (error) {
      setShareEmailError(readErrorMessage(error, t));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRevoke(tenantId: string, label: string) {
    if (!runtimeId || busyAction) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: t("Remove access"),
      description: t(
        "{label} will no longer be able to deploy to this server.",
        {
          label,
        },
      ),
      title: t("Remove workspace access?"),
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
        message: t("{label} no longer has deploy access.", {
          label,
        }),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
              ? t("Internal cluster can now deploy to this server.")
              : t(
                  "Internal cluster access is enabled. Node reconciliation will follow when the server is reachable.",
                )
            : data.nodeReconciled
              ? t("Internal cluster access removed.")
              : t(
                  "Internal cluster access removed. Node reconciliation will follow when the server is reachable.",
                ),
        variant: "success",
      });
    } catch (error) {
      setCurrentPoolMode(previousValue);
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  if (!runtimeId) {
    return (
      <InlineAlert variant="info">
        {t("Access controls become available after the runtime finishes reporting.")}
      </InlineAlert>
    );
  }

  return (
    <div className="fg-runtime-access">
      <div className="fg-cluster-node-card__section-head fg-runtime-access__head">
        <div className="fg-runtime-access__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Access")}</p>
        </div>

        <div className="fg-runtime-access__meta">
          {accessMeta ? <span className="fg-runtime-access__meta-note">{accessMeta}</span> : null}
          <StatusBadge
            tone={
              summaryLabel === t("Private")
                ? "neutral"
                : summaryLabel === t("Cluster")
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
              <span>{t("Workspace email")}</span>
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
                  loadingLabel={t("Adding...")}
                  type="submit"
                  variant="primary"
                >
                  {t("Add workspace")}
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
                t(
                  "The recipient needs to sign in to Fugue and finish workspace setup first.",
                )}
            </span>
          </div>
        </form>
      ) : null}

      {sharingError ? (
        <InlineAlert variant="error">{sharingError}</InlineAlert>
      ) : null}

      {loadingSharing ? (
        <InlineAlert variant="info">{t("Loading access roster…")}</InlineAlert>
      ) : null}

      <div className="fg-runtime-share-list">
        {showClusterRow ? (
          <AccessRow
            action={
              canManagePool && ownership === "owned" ? (
                <SegmentedControl
                  ariaLabel={t("Internal cluster access")}
                  className="fg-runtime-share-row__segmented"
                  controlClassName="fg-console-nav"
                  itemClassName="fg-console-nav__link"
                  labelClassName="fg-console-nav__title"
                  onChange={handlePoolModeChange}
                  options={poolModeOptions.map((option) => ({
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
                    label: readPoolModeLabel(currentPoolMode, t),
                    tone: readClusterTone(currentPoolMode),
                  }
                : undefined
            }
            meta={readClusterMeta({
              canManagePool,
              ownership,
              poolMode: currentPoolMode,
              t,
            })}
            title={t("Internal cluster")}
          />
        ) : null}

        {ownership === "internal-cluster" ? (
          <AccessRow
            badge={{ label: t("System"), tone: "info" }}
            meta={t("Shared capacity · managed centrally")}
            title={t("Internal cluster")}
          />
        ) : null}

        {showShareForm && !loadingSharing && sharing && sharing.grants.length > 0
          ? sharing.grants.map((grant) => (
              <AccessRow
                action={
                  <InlineButton
                    busy={busyAction === `revoke:${grant.tenantId}`}
                    busyLabel={t("Removing...")}
                    danger
                    disabled={busyAction !== null && busyAction !== `revoke:${grant.tenantId}`}
                    label={t("Remove")}
                    onClick={() => handleRevoke(grant.tenantId, grant.label)}
                  />
                }
                badge={{ label: t("Workspace") }}
                key={grant.tenantId}
                meta={
                  grant.updatedAt
                    ? t("Workspace access · updated {time}", {
                        time: formatRelativeTime(
                          grant.updatedAt,
                          formatRelativeTimeValue,
                        ),
                      })
                    : grant.createdAt
                      ? t("Workspace access · granted {time}", {
                          time: formatRelativeTime(
                            grant.createdAt,
                            formatRelativeTimeValue,
                          ),
                        })
                      : t("Workspace access")
                }
                title={grant.label}
              />
            ))
          : null}
      </div>

      {showShareForm && !loadingSharing && !sharingError && sharing && sharing.grants.length === 0 ? (
        <p className="fg-runtime-access-empty">
          {t("No additional workspace access yet.")}
        </p>
      ) : null}
    </div>
  );
}
