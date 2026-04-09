"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { HintInline } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import type {
  ConsoleGalleryBackingServiceView,
  ConsoleImportRuntimeTargetView,
} from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import {
  readDefaultImportRuntimeId,
  readManagedRuntimeTargets,
  readRuntimeTargetLabel,
} from "@/lib/console/runtime-targets";

type AppOperationResponse = {
  operation?: {
    id?: string | null;
  } | null;
};

type ContinuityResponse = {
  alreadyCurrent?: boolean;
};

type Translator = (key: string, values?: Record<string, string | number>) => string;

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

function readInitialDatabaseFailoverTargetRuntimeId(
  primaryRuntimeId: string | null,
  configuredTargetRuntimeId: string | null,
  runtimeTargets: ConsoleImportRuntimeTargetView[],
) {
  const continuityTargets = readManagedRuntimeTargets(
    runtimeTargets,
    primaryRuntimeId,
  );

  if (
    configuredTargetRuntimeId &&
    continuityTargets.some((target) => target.id === configuredTargetRuntimeId)
  ) {
    return configuredTargetRuntimeId;
  }

  return readDefaultImportRuntimeId(continuityTargets);
}

function readInitialDatabaseTransferTargetRuntimeId(
  primaryRuntimeId: string | null,
  configuredTargetRuntimeId: string | null,
  runtimeTargets: ConsoleImportRuntimeTargetView[],
) {
  const transferTargets = readManagedRuntimeTargets(runtimeTargets, primaryRuntimeId);

  if (
    configuredTargetRuntimeId &&
    transferTargets.some((target) => target.id === configuredTargetRuntimeId)
  ) {
    return configuredTargetRuntimeId;
  }

  return readDefaultImportRuntimeId(transferTargets);
}

function readDatabaseTopologyLabel(
  service: ConsoleGalleryBackingServiceView,
  t: Translator = (key) => key,
) {
  const instances = Math.max(service.databaseInstances ?? 1, 1);
  const synchronousReplicas = Math.max(
    service.databaseSynchronousReplicas ?? 0,
    0,
  );

  if (
    service.databaseFailoverConfigured ||
    instances > 1 ||
    synchronousReplicas > 0
  ) {
    return t(
      synchronousReplicas === 1
        ? "{instances} instances / {replicas} sync replica"
        : "{instances} instances / {replicas} sync replicas",
      {
        instances,
        replicas: synchronousReplicas,
      },
    );
  }

  return t(instances === 1 ? "{count} instance" : "{count} instances", {
    count: instances,
  });
}

function readInlineAlertVariantForTone(tone: ConsoleTone) {
  switch (tone) {
    case "danger":
      return "error";
    case "positive":
      return "success";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

function readPrimaryPlacementPendingMessage(t: Translator = (key) => key) {
  return t(
    "Primary placement stays as-is until a later maintenance window, rebuild, node drain, or explicit rebalance.",
  );
}

function readDatabaseContinuityStandbyLabel(
  service: ConsoleGalleryBackingServiceView,
  configuredTargetLabel: string,
  pendingTargetLabel: string,
  t: Translator = (key) => key,
) {
  switch (service.databaseContinuity.state) {
    case "disable-queued":
    case "removing-standby":
      return service.databaseFailoverTargetRuntimeId
        ? t("{target} (removing)", { target: configuredTargetLabel })
        : t("Removing standby");
    case "enable-queued":
    case "provisioning-standby":
    case "standby-update-queued":
    case "updating-standby":
      return service.databaseContinuity.pendingTargetRuntimeId
        ? t("{target} (applying)", { target: pendingTargetLabel })
        : pendingTargetLabel;
    case "configured":
      return service.databaseFailoverConfigured
        ? configuredTargetLabel
        : t("Not configured");
    case "off":
    default:
      return t("Not configured");
  }
}

function readDatabaseContinuityMessage(
  service: ConsoleGalleryBackingServiceView,
  primaryRuntimeLabel: string,
  configuredTargetLabel: string,
  pendingTargetLabel: string,
  t: Translator = (key) => key,
) {
  const configuredStandbyLabel = service.databaseFailoverTargetRuntimeId
    ? configuredTargetLabel
    : t("the current standby");
  const primaryPlacementPendingMessage =
    service.databaseContinuity.placementPendingRebalance
      ? ` ${readPrimaryPlacementPendingMessage(t)}`
      : "";

  switch (service.databaseContinuity.state) {
    case "disable-queued":
      return t(
        "Failover disable is queued. {primaryRuntimeLabel} keeps serving writes while Fugue removes the standby.{suffix}",
        {
          primaryRuntimeLabel,
          suffix: primaryPlacementPendingMessage,
        },
      );
    case "enable-queued":
      return t(
        "Failover enable is queued. Fugue will prepare {pendingTargetLabel} as the standby while {primaryRuntimeLabel} keeps serving writes.{suffix}",
        {
          pendingTargetLabel,
          primaryRuntimeLabel,
          suffix: primaryPlacementPendingMessage,
        },
      );
    case "provisioning-standby":
      return t(
        "Fugue is provisioning {pendingTargetLabel} as the standby. {primaryRuntimeLabel} keeps serving writes throughout the change.{suffix}",
        {
          pendingTargetLabel,
          primaryRuntimeLabel,
          suffix: primaryPlacementPendingMessage,
        },
      );
    case "removing-standby":
      return t(
        "Fugue is removing the standby from {configuredStandbyLabel}. {primaryRuntimeLabel} keeps serving writes throughout the change.{suffix}",
        {
          configuredStandbyLabel,
          primaryRuntimeLabel,
          suffix: primaryPlacementPendingMessage,
        },
      );
    case "standby-update-queued":
      return t(
        "Standby update is queued. Fugue will move failover to {pendingTargetLabel} while {primaryRuntimeLabel} keeps serving writes.{suffix}",
        {
          pendingTargetLabel,
          primaryRuntimeLabel,
          suffix: primaryPlacementPendingMessage,
        },
      );
    case "updating-standby":
      return t(
        "Fugue is moving the standby to {pendingTargetLabel}. {primaryRuntimeLabel} keeps serving writes throughout the change.{suffix}",
        {
          pendingTargetLabel,
          primaryRuntimeLabel,
          suffix: primaryPlacementPendingMessage,
        },
      );
    case "configured":
      return service.databaseContinuity.placementPendingRebalance
        ? t("Standby is ready. {message}", {
            message: readPrimaryPlacementPendingMessage(t),
          })
        : null;
    case "off":
    default:
      return service.databaseContinuity.placementPendingRebalance
        ? t("Failover is off and the standby is gone. {message}", {
            message: readPrimaryPlacementPendingMessage(t),
          })
        : null;
  }
}

export function BackingServiceSettingsPanel({
  onRefreshRequested,
  ownerAppRuntimeId,
  runtimeTargetInventoryError,
  runtimeTargets,
  service,
}: {
  onRefreshRequested?: () => void;
  ownerAppRuntimeId: string | null;
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  service: ConsoleGalleryBackingServiceView;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const primaryRuntimeId = service.databaseRuntimeId ?? ownerAppRuntimeId;
  const continuityTargets = readManagedRuntimeTargets(
    runtimeTargets,
    primaryRuntimeId,
  );
  const transferTargets = continuityTargets;
  const [failoverTargetRuntimeId, setFailoverTargetRuntimeId] = useState<
    string | null
  >(() =>
    readInitialDatabaseFailoverTargetRuntimeId(
      primaryRuntimeId,
      service.databaseContinuity.pendingTargetRuntimeId ??
        service.databaseFailoverTargetRuntimeId,
      runtimeTargets,
    ),
  );
  const [transferTargetRuntimeId, setTransferTargetRuntimeId] = useState<
    string | null
  >(() =>
    readInitialDatabaseTransferTargetRuntimeId(
      primaryRuntimeId,
      service.databaseTransferTargetRuntimeId,
      runtimeTargets,
    ),
  );
  const [saving, setSaving] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);

  useEffect(() => {
    setFailoverTargetRuntimeId(
      readInitialDatabaseFailoverTargetRuntimeId(
        service.databaseRuntimeId ?? ownerAppRuntimeId,
        service.databaseContinuity.pendingTargetRuntimeId ??
          service.databaseFailoverTargetRuntimeId,
        runtimeTargets,
      ),
    );
    setTransferTargetRuntimeId(
      readInitialDatabaseTransferTargetRuntimeId(
        service.databaseRuntimeId ?? ownerAppRuntimeId,
        service.databaseTransferTargetRuntimeId,
        runtimeTargets,
      ),
    );
  }, [
    ownerAppRuntimeId,
    runtimeTargets,
    service.databaseContinuity.pendingTargetRuntimeId,
    service.databaseFailoverTargetRuntimeId,
    service.databaseTransferTargetRuntimeId,
    service.databaseRuntimeId,
    service.id,
  ]);

  const selectedFailoverTargetRuntimeId =
    failoverTargetRuntimeId && failoverTargetRuntimeId !== primaryRuntimeId
      ? failoverTargetRuntimeId
      : null;
  const appliedFailoverTargetRuntimeId =
    (service.databaseContinuity.pendingTargetRuntimeId ??
      service.databaseFailoverTargetRuntimeId) !== primaryRuntimeId
      ? (service.databaseContinuity.pendingTargetRuntimeId ??
          service.databaseFailoverTargetRuntimeId)
      : null;
  const selectedTransferTargetRuntimeId =
    transferTargetRuntimeId && transferTargetRuntimeId !== primaryRuntimeId
      ? transferTargetRuntimeId
      : null;
  const primaryRuntimeLabel = readRuntimeTargetLabel(
    runtimeTargets,
    primaryRuntimeId,
    locale,
    t("Primary runtime unavailable"),
  );
  const configuredFailoverTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    service.databaseFailoverTargetRuntimeId,
    locale,
    t("Not configured"),
  );
  const pendingFailoverTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    service.databaseContinuity.pendingTargetRuntimeId,
    locale,
    t("Pending standby unavailable"),
  );
  const selectedFailoverTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    selectedFailoverTargetRuntimeId,
    locale,
    t("No standby selected"),
  );
  const activeTransferTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    service.databaseTransferTargetRuntimeId,
    locale,
    t("Destination unavailable"),
  );
  const selectedTransferTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    selectedTransferTargetRuntimeId,
    locale,
    t("No destination selected"),
  );
  const databaseContinuityBusy = service.databaseContinuity.live;
  const databaseContinuityMessage = readDatabaseContinuityMessage(
    service,
    primaryRuntimeLabel,
    configuredFailoverTargetLabel,
    pendingFailoverTargetLabel,
    t,
  );
  const standbyRuntimeLabel = readDatabaseContinuityStandbyLabel(
    service,
    configuredFailoverTargetLabel,
    pendingFailoverTargetLabel,
    t,
  );
  const databaseTransferInProgress = Boolean(
    service.databaseTransferTargetRuntimeId,
  );
  const continuityTransitionMessage = databaseContinuityBusy
    ? t("Database failover is already changing.")
    : null;
  const transferInProgressMessage = databaseTransferInProgress
    ? t("A database transfer to {target} is already in progress.", {
        target: activeTransferTargetLabel,
      })
    : null;
  const continuityBlockerMessage = !service.ownerAppId
    ? t("This database is not attached to an application.")
    : transferInProgressMessage
      ? transferInProgressMessage
      : runtimeTargetInventoryError
        ? t("Runtime list unavailable.")
        : !primaryRuntimeId
          ? t("Primary runtime unavailable.")
          : continuityTargets.length === 0
            ? t("Add another managed runtime before turning on database failover.")
            : null;
  const transferBlockerMessage = !service.ownerAppId
    ? t("This database is not attached to an application.")
    : continuityTransitionMessage
      ? continuityTransitionMessage
    : transferInProgressMessage
      ? transferInProgressMessage
      : runtimeTargetInventoryError
        ? t("Runtime list unavailable.")
        : !primaryRuntimeId
          ? t("Primary runtime unavailable.")
          : transferTargets.length === 0
            ? t("Add another managed runtime before moving this database.")
          : null;
  const canSave =
    !saving &&
    !databaseContinuityBusy &&
    !continuityBlockerMessage &&
    Boolean(selectedFailoverTargetRuntimeId);
  const failoverTargetChanged =
    selectedFailoverTargetRuntimeId !== appliedFailoverTargetRuntimeId;
  const showSaveFailoverButton =
    !service.databaseFailoverConfigured || failoverTargetChanged || saving;
  const canTransfer =
    !transferSaving &&
    !databaseContinuityBusy &&
    !transferBlockerMessage &&
    Boolean(selectedTransferTargetRuntimeId);

  async function handleFailoverSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!service.ownerAppId || databaseContinuityBusy) {
      showToast({
        message: !service.ownerAppId
          ? t("This database cannot be configured from the console yet.")
          : t("Database failover is already changing. Wait for the current step to finish."),
        variant: "info",
      });
      return;
    }

    if (!selectedFailoverTargetRuntimeId) {
      showToast({
        message: continuityBlockerMessage ?? t("Choose a standby runtime."),
        variant: "info",
      });
      return;
    }

    setSaving(true);

    try {
      const result = await requestJson<ContinuityResponse>(
        `/api/fugue/apps/${service.ownerAppId}/continuity`,
        {
          body: JSON.stringify({
            databaseFailover: {
              enabled: true,
              targetRuntimeId: selectedFailoverTargetRuntimeId,
            },
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
        t,
      );

      showToast({
        message: result?.alreadyCurrent
          ? t("Database failover already points to {target}.", {
              target: selectedFailoverTargetLabel,
            })
          : t("Database failover saved. Standby runtime: {target}.", {
              target: selectedFailoverTargetLabel,
            }),
        variant: "success",
      });
      onRefreshRequested?.();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    if (
      !service.ownerAppId ||
      !service.databaseFailoverConfigured ||
      databaseContinuityBusy ||
      saving ||
      databaseTransferInProgress
    ) {
      return;
    }

    setSaving(true);

    try {
      const result = await requestJson<ContinuityResponse>(
        `/api/fugue/apps/${service.ownerAppId}/continuity`,
        {
          body: JSON.stringify({
            databaseFailover: {
              enabled: false,
            },
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
        t,
      );

      showToast({
        message: result?.alreadyCurrent
          ? t("Database failover is already off.")
          : t("Database failover disabled."),
        variant: "success",
      });
      onRefreshRequested?.();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTransferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!service.ownerAppId || databaseContinuityBusy) {
      showToast({
        message: !service.ownerAppId
          ? t("This database cannot be transferred from the console yet.")
          : t("Database failover is already changing. Wait for the current step to finish."),
        variant: "info",
      });
      return;
    }

    if (!selectedTransferTargetRuntimeId) {
      showToast({
        message: transferBlockerMessage ?? t("Choose a destination."),
        variant: "info",
      });
      return;
    }

    const confirmed = await confirm({
      confirmLabel: t("Transfer Now"),
      description: t(
        "Fugue keeps {primaryRuntimeLabel} serving writes while it prepares {selectedTransferTargetLabel}, then promotes the new primary and keeps {primaryRuntimeLabel} as the standby.",
        {
          primaryRuntimeLabel,
          selectedTransferTargetLabel,
        },
      ),
      eyebrow: t("Database Move"),
      title: t("Transfer Database Primary?"),
      variant: "primary",
    });

    if (!confirmed) {
      return;
    }

    setTransferSaving(true);

    try {
      await requestJson<AppOperationResponse>(
        `/api/fugue/apps/${service.ownerAppId}/database/switchover`,
        {
          body: JSON.stringify({
            targetRuntimeId: selectedTransferTargetRuntimeId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        t,
      );

      showToast({
        message: t("Database transfer queued to {target}.", {
          target: selectedTransferTargetLabel,
        }),
        variant: "success",
      });
      onRefreshRequested?.();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setTransferSaving(false);
    }
  }

  return (
    <div className="fg-workbench-section fg-settings-panel">
      <div className="fg-workbench-section__copy fg-settings-panel__copy">
        <HintInline
          ariaLabel={t("Settings")}
          hint={t(
            "Keep this database on its current primary runtime, choose a standby runtime for failover, or actively move the primary now.",
          )}
        >
          <p className="fg-label fg-panel__eyebrow">{t("Settings")}</p>
        </HintInline>
      </div>

      <section
        aria-label={t("Database failover")}
        className="fg-route-subsection fg-settings-section"
      >
        <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Continuity")}</p>
          <HintInline
            ariaLabel={t("Database failover")}
            hint={t(
              "The database stays on its primary runtime. The standby runtime only takes over if the primary disappears.",
            )}
          >
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("Database failover")}
            </h3>
          </HintInline>
        </div>

          <StatusBadge
            live={service.databaseContinuity.live}
            tone={service.databaseContinuity.tone}
          >
            {t(service.databaseContinuity.label)}
          </StatusBadge>
        </div>

        <dl className="fg-settings-meta">
          <div>
            <dt>{t("Attached app")}</dt>
            <dd>{service.ownerAppLabel}</dd>
          </div>
          <div>
            <dt>{t("Primary runtime")}</dt>
            <dd>{primaryRuntimeLabel}</dd>
          </div>
          <div>
            <dt>{t("Standby runtime")}</dt>
            <dd>{standbyRuntimeLabel}</dd>
          </div>
          <div>
            <dt>{t("Topology")}</dt>
            <dd>{readDatabaseTopologyLabel(service, t)}</dd>
          </div>
        </dl>

        <form className="fg-settings-form" onSubmit={handleFailoverSubmit}>
          {databaseContinuityMessage ? (
            <InlineAlert
              variant={readInlineAlertVariantForTone(
                service.databaseContinuity.tone,
              )}
            >
              {databaseContinuityMessage}
            </InlineAlert>
          ) : null}

          {continuityBlockerMessage ? (
            <InlineAlert variant="warning">{continuityBlockerMessage}</InlineAlert>
          ) : null}

          {continuityTargets.length > 0 ? (
            <FormField
              htmlFor={`database-failover-target-${service.id}`}
              label={t("Standby runtime")}
            >
              <SelectField
                disabled={
                  saving || databaseContinuityBusy || databaseTransferInProgress
                }
                id={`database-failover-target-${service.id}`}
                name="databaseFailoverTarget"
                onChange={(event) =>
                  setFailoverTargetRuntimeId(event.target.value || null)
                }
                value={selectedFailoverTargetRuntimeId ?? ""}
              >
                <option disabled value="">
                  {t("Select a standby runtime…")}
                </option>
                {continuityTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.summaryLabel}
                  </option>
                ))}
              </SelectField>
            </FormField>
          ) : null}

          <div className="fg-settings-form__actions">
            {service.databaseFailoverConfigured ? (
              <Button
                disabled={
                  saving || databaseContinuityBusy || databaseTransferInProgress
                }
                onClick={handleDisable}
                size="compact"
                type="button"
                variant="secondary"
              >
                {t("Disable")}
              </Button>
            ) : null}
            {showSaveFailoverButton ? (
              <Button
                disabled={!canSave}
                loading={saving}
                loadingLabel={t("Saving…")}
                size="compact"
                type="submit"
                variant="primary"
              >
                {service.databaseFailoverConfigured
                  ? t("Save standby")
                  : t("Enable failover")}
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section
        aria-label={t("Database one-click transfer")}
        className="fg-route-subsection fg-settings-section"
      >
        <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Runtime")}</p>
          <HintInline
            ariaLabel={t("Database one-click transfer")}
            hint={
              databaseTransferInProgress
                ? t(
                    "Current primary: {primaryRuntimeLabel}. Destination: {activeTransferTargetLabel}. Fugue promotes the new primary automatically once it is ready.",
                    {
                      activeTransferTargetLabel,
                      primaryRuntimeLabel,
                    },
                  )
                : t(
                    "Current primary: {primaryRuntimeLabel}. Choose a destination and Fugue will prepare the new primary before switching over.",
                    {
                      primaryRuntimeLabel,
                    },
                  )
            }
          >
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("Database one-click transfer")}
            </h3>
          </HintInline>
        </div>

          <StatusBadge tone={databaseTransferInProgress ? "info" : "neutral"}>
            {databaseTransferInProgress
              ? service.serviceRole === "pending"
                ? t(service.status)
                : t("In progress")
              : t("Off")}
          </StatusBadge>
        </div>

        <dl className="fg-settings-meta">
          <div>
            <dt>{t("Attached app")}</dt>
            <dd>{service.ownerAppLabel}</dd>
          </div>
          <div>
            <dt>{t("Current primary")}</dt>
            <dd>{primaryRuntimeLabel}</dd>
          </div>
          <div>
            <dt>{t("Destination")}</dt>
            <dd>
              {databaseTransferInProgress
                ? activeTransferTargetLabel
                : t("Not queued")}
            </dd>
          </div>
          <div>
            <dt>{t("After switchover")}</dt>
            <dd>{t("Old primary becomes the standby runtime.")}</dd>
          </div>
        </dl>

        <form className="fg-settings-form" onSubmit={handleTransferSubmit}>
          {transferBlockerMessage ? (
            <InlineAlert variant="warning">{transferBlockerMessage}</InlineAlert>
          ) : null}

          {transferTargets.length > 0 ? (
            <FormField
              htmlFor={`database-transfer-target-${service.id}`}
              label={t("Destination")}
            >
              <SelectField
                disabled={
                  transferSaving ||
                  databaseContinuityBusy ||
                  databaseTransferInProgress
                }
                id={`database-transfer-target-${service.id}`}
                name="databaseTransferTarget"
                onChange={(event) =>
                  setTransferTargetRuntimeId(event.target.value || null)
                }
                value={selectedTransferTargetRuntimeId ?? ""}
              >
                <option disabled value="">
                  {t("Select a destination…")}
                </option>
                {transferTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.summaryLabel}
                  </option>
                ))}
              </SelectField>
            </FormField>
          ) : null}

          <div className="fg-settings-form__actions">
            <Button
              disabled={!canTransfer}
              loading={transferSaving}
              loadingLabel={t("Queueing…")}
              size="compact"
              type="submit"
              variant="primary"
            >
              {t("Transfer Now")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
