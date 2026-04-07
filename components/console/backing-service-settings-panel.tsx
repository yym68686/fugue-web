"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
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

function readDatabaseTopologyLabel(service: ConsoleGalleryBackingServiceView) {
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
    return `${instances} instances / ${synchronousReplicas} sync replica${synchronousReplicas === 1 ? "" : "s"}`;
  }

  return `${instances} instance`;
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

function readPrimaryPlacementPendingMessage() {
  return "Primary placement stays as-is until a later maintenance window, rebuild, node drain, or explicit rebalance.";
}

function readDatabaseContinuityStandbyLabel(
  service: ConsoleGalleryBackingServiceView,
  configuredTargetLabel: string,
  pendingTargetLabel: string,
) {
  switch (service.databaseContinuity.state) {
    case "disable-queued":
    case "removing-standby":
      return service.databaseFailoverTargetRuntimeId
        ? `${configuredTargetLabel} (removing)`
        : "Removing standby";
    case "enable-queued":
    case "provisioning-standby":
    case "standby-update-queued":
    case "updating-standby":
      return service.databaseContinuity.pendingTargetRuntimeId
        ? `${pendingTargetLabel} (applying)`
        : pendingTargetLabel;
    case "configured":
      return service.databaseFailoverConfigured
        ? configuredTargetLabel
        : "Not configured";
    case "off":
    default:
      return "Not configured";
  }
}

function readDatabaseContinuityMessage(
  service: ConsoleGalleryBackingServiceView,
  primaryRuntimeLabel: string,
  configuredTargetLabel: string,
  pendingTargetLabel: string,
) {
  const configuredStandbyLabel = service.databaseFailoverTargetRuntimeId
    ? configuredTargetLabel
    : "the current standby";
  const primaryPlacementPendingMessage =
    service.databaseContinuity.placementPendingRebalance
      ? ` ${readPrimaryPlacementPendingMessage()}`
      : "";

  switch (service.databaseContinuity.state) {
    case "disable-queued":
      return `Failover disable is queued. ${primaryRuntimeLabel} keeps serving writes while Fugue removes the standby.${primaryPlacementPendingMessage}`;
    case "enable-queued":
      return `Failover enable is queued. Fugue will prepare ${pendingTargetLabel} as the standby while ${primaryRuntimeLabel} keeps serving writes.${primaryPlacementPendingMessage}`;
    case "provisioning-standby":
      return `Fugue is provisioning ${pendingTargetLabel} as the standby. ${primaryRuntimeLabel} keeps serving writes throughout the change.${primaryPlacementPendingMessage}`;
    case "removing-standby":
      return `Fugue is removing the standby from ${configuredStandbyLabel}. ${primaryRuntimeLabel} keeps serving writes throughout the change.${primaryPlacementPendingMessage}`;
    case "standby-update-queued":
      return `Standby update is queued. Fugue will move failover to ${pendingTargetLabel} while ${primaryRuntimeLabel} keeps serving writes.${primaryPlacementPendingMessage}`;
    case "updating-standby":
      return `Fugue is moving the standby to ${pendingTargetLabel}. ${primaryRuntimeLabel} keeps serving writes throughout the change.${primaryPlacementPendingMessage}`;
    case "configured":
      return service.databaseContinuity.placementPendingRebalance
        ? `Standby is ready. ${readPrimaryPlacementPendingMessage()}`
        : null;
    case "off":
    default:
      return service.databaseContinuity.placementPendingRebalance
        ? `Failover is off and the standby is gone. ${readPrimaryPlacementPendingMessage()}`
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
  const selectedTransferTargetRuntimeId =
    transferTargetRuntimeId && transferTargetRuntimeId !== primaryRuntimeId
      ? transferTargetRuntimeId
      : null;
  const primaryRuntimeLabel = readRuntimeTargetLabel(
    runtimeTargets,
    primaryRuntimeId,
    "Primary runtime unavailable",
  );
  const configuredFailoverTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    service.databaseFailoverTargetRuntimeId,
    "Not configured",
  );
  const pendingFailoverTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    service.databaseContinuity.pendingTargetRuntimeId,
    "Pending standby unavailable",
  );
  const selectedFailoverTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    selectedFailoverTargetRuntimeId,
    "No standby selected",
  );
  const activeTransferTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    service.databaseTransferTargetRuntimeId,
    "Destination unavailable",
  );
  const selectedTransferTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    selectedTransferTargetRuntimeId,
    "No destination selected",
  );
  const databaseContinuityBusy = service.databaseContinuity.live;
  const databaseContinuityMessage = readDatabaseContinuityMessage(
    service,
    primaryRuntimeLabel,
    configuredFailoverTargetLabel,
    pendingFailoverTargetLabel,
  );
  const standbyRuntimeLabel = readDatabaseContinuityStandbyLabel(
    service,
    configuredFailoverTargetLabel,
    pendingFailoverTargetLabel,
  );
  const databaseTransferInProgress = Boolean(
    service.databaseTransferTargetRuntimeId,
  );
  const continuityTransitionMessage = databaseContinuityBusy
    ? "Database failover is already changing."
    : null;
  const transferInProgressMessage = databaseTransferInProgress
    ? `A database transfer to ${activeTransferTargetLabel} is already in progress.`
    : null;
  const continuityBlockerMessage = !service.ownerAppId
    ? "This database is not attached to an application."
    : transferInProgressMessage
      ? transferInProgressMessage
      : runtimeTargetInventoryError
        ? "Runtime list unavailable."
        : !primaryRuntimeId
          ? "Primary runtime unavailable."
          : continuityTargets.length === 0
            ? "Add another managed runtime before turning on database failover."
            : null;
  const transferBlockerMessage = !service.ownerAppId
    ? "This database is not attached to an application."
    : continuityTransitionMessage
      ? continuityTransitionMessage
    : transferInProgressMessage
      ? transferInProgressMessage
      : runtimeTargetInventoryError
        ? "Runtime list unavailable."
        : !primaryRuntimeId
          ? "Primary runtime unavailable."
          : transferTargets.length === 0
            ? "Add another managed runtime before moving this database."
          : null;
  const canSave =
    !saving &&
    !databaseContinuityBusy &&
    !continuityBlockerMessage &&
    Boolean(selectedFailoverTargetRuntimeId);
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
          ? "This database cannot be configured from the console yet."
          : "Database failover is already changing. Wait for the current step to finish.",
        variant: "info",
      });
      return;
    }

    if (!selectedFailoverTargetRuntimeId) {
      showToast({
        message: continuityBlockerMessage ?? "Choose a standby runtime.",
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
      );

      showToast({
        message: result?.alreadyCurrent
          ? `Database failover already points to ${selectedFailoverTargetLabel}.`
          : `Database failover saved. Standby runtime: ${selectedFailoverTargetLabel}.`,
        variant: "success",
      });
      onRefreshRequested?.();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
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
      );

      showToast({
        message: result?.alreadyCurrent
          ? "Database failover is already off."
          : "Database failover disabled.",
        variant: "success",
      });
      onRefreshRequested?.();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
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
          ? "This database cannot be transferred from the console yet."
          : "Database failover is already changing. Wait for the current step to finish.",
        variant: "info",
      });
      return;
    }

    if (!selectedTransferTargetRuntimeId) {
      showToast({
        message: transferBlockerMessage ?? "Choose a destination.",
        variant: "info",
      });
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Transfer Now",
      description: `Fugue keeps ${primaryRuntimeLabel} serving writes while it prepares ${selectedTransferTargetLabel}, then promotes the new primary and keeps ${primaryRuntimeLabel} as the standby.`,
      eyebrow: "Database Move",
      title: "Transfer Database Primary?",
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
      );

      showToast({
        message: `Database transfer queued to ${selectedTransferTargetLabel}.`,
        variant: "success",
      });
      onRefreshRequested?.();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setTransferSaving(false);
    }
  }

  return (
    <div className="fg-workbench-section fg-settings-panel">
      <div className="fg-workbench-section__copy fg-settings-panel__copy">
        <p className="fg-label fg-panel__eyebrow">Settings</p>
        <p className="fg-console-note">
          Keep this database on its current primary runtime, choose a standby
          runtime for failover, or actively move the primary now.
        </p>
      </div>

      <section
        aria-label="Database failover"
        className="fg-route-subsection fg-settings-section"
      >
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy fg-settings-section__copy">
            <p className="fg-label fg-panel__eyebrow">Continuity</p>
            <h3 className="fg-route-subsection__title fg-ui-heading">
              Database failover
            </h3>
            <p className="fg-route-subsection__note">
              The database stays on its primary runtime. The standby runtime
              only takes over if the primary disappears.
            </p>
          </div>

          <StatusBadge
            live={service.databaseContinuity.live}
            tone={service.databaseContinuity.tone}
          >
            {service.databaseContinuity.label}
          </StatusBadge>
        </div>

        <dl className="fg-settings-meta">
          <div>
            <dt>Attached app</dt>
            <dd>{service.ownerAppLabel}</dd>
          </div>
          <div>
            <dt>Primary runtime</dt>
            <dd>{primaryRuntimeLabel}</dd>
          </div>
          <div>
            <dt>Standby runtime</dt>
            <dd>{standbyRuntimeLabel}</dd>
          </div>
          <div>
            <dt>Topology</dt>
            <dd>{readDatabaseTopologyLabel(service)}</dd>
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
              label="Standby runtime"
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
                  Select a standby runtime…
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
                Disable
              </Button>
            ) : null}
            <Button
              disabled={!canSave}
              loading={saving}
              loadingLabel="Saving…"
              size="compact"
              type="submit"
              variant="primary"
            >
              {service.databaseFailoverConfigured
                ? "Save standby"
                : "Enable failover"}
            </Button>
          </div>
        </form>
      </section>

      <section
        aria-label="Database one-click transfer"
        className="fg-route-subsection fg-settings-section"
      >
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy fg-settings-section__copy">
            <p className="fg-label fg-panel__eyebrow">Runtime</p>
            <h3 className="fg-route-subsection__title fg-ui-heading">
              Database one-click transfer
            </h3>
            <p className="fg-route-subsection__note">
              {databaseTransferInProgress
                ? `Current primary: ${primaryRuntimeLabel}. Destination: ${activeTransferTargetLabel}. Fugue promotes the new primary automatically once it is ready.`
                : `Current primary: ${primaryRuntimeLabel}. Choose a destination and Fugue will prepare the new primary before switching over.`}
            </p>
          </div>

          <StatusBadge tone={databaseTransferInProgress ? "info" : "neutral"}>
            {databaseTransferInProgress
              ? service.serviceRole === "pending"
                ? service.status
                : "In progress"
              : "Off"}
          </StatusBadge>
        </div>

        <dl className="fg-settings-meta">
          <div>
            <dt>Attached app</dt>
            <dd>{service.ownerAppLabel}</dd>
          </div>
          <div>
            <dt>Current primary</dt>
            <dd>{primaryRuntimeLabel}</dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd>
              {databaseTransferInProgress
                ? activeTransferTargetLabel
                : "Not queued"}
            </dd>
          </div>
          <div>
            <dt>After switchover</dt>
            <dd>Old primary becomes the standby runtime.</dd>
          </div>
        </dl>

        <form className="fg-settings-form" onSubmit={handleTransferSubmit}>
          {transferBlockerMessage ? (
            <InlineAlert variant="warning">{transferBlockerMessage}</InlineAlert>
          ) : null}

          {transferTargets.length > 0 ? (
            <FormField
              htmlFor={`database-transfer-target-${service.id}`}
              label="Destination"
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
                  Select a destination…
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
              loadingLabel="Queueing…"
              size="compact"
              type="submit"
              variant="primary"
            >
              Transfer Now
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
