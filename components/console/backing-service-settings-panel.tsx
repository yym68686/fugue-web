"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import type {
  ConsoleGalleryBackingServiceView,
  ConsoleImportRuntimeTargetView,
} from "@/lib/console/gallery-types";
import {
  readDefaultImportRuntimeId,
  readRuntimeTargetLabel,
} from "@/lib/console/runtime-targets";

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
  const continuityTargets = primaryRuntimeId
    ? runtimeTargets.filter((target) => target.id !== primaryRuntimeId)
    : runtimeTargets;

  if (
    configuredTargetRuntimeId &&
    continuityTargets.some((target) => target.id === configuredTargetRuntimeId)
  ) {
    return configuredTargetRuntimeId;
  }

  return readDefaultImportRuntimeId(continuityTargets);
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

export function BackingServiceSettingsPanel({
  ownerAppRuntimeId,
  runtimeTargetInventoryError,
  runtimeTargets,
  service,
}: {
  ownerAppRuntimeId: string | null;
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  service: ConsoleGalleryBackingServiceView;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const primaryRuntimeId = service.databaseRuntimeId ?? ownerAppRuntimeId;
  const continuityTargets = primaryRuntimeId
    ? runtimeTargets.filter((target) => target.id !== primaryRuntimeId)
    : runtimeTargets;
  const [targetRuntimeId, setTargetRuntimeId] = useState<string | null>(() =>
    readInitialDatabaseFailoverTargetRuntimeId(
      primaryRuntimeId,
      service.databaseFailoverTargetRuntimeId,
      runtimeTargets,
    ),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTargetRuntimeId(
      readInitialDatabaseFailoverTargetRuntimeId(
        service.databaseRuntimeId ?? ownerAppRuntimeId,
        service.databaseFailoverTargetRuntimeId,
        runtimeTargets,
      ),
    );
  }, [
    ownerAppRuntimeId,
    runtimeTargets,
    service.databaseFailoverTargetRuntimeId,
    service.databaseRuntimeId,
    service.id,
  ]);

  const selectedTargetRuntimeId =
    targetRuntimeId && targetRuntimeId !== primaryRuntimeId
      ? targetRuntimeId
      : null;
  const primaryRuntimeLabel = readRuntimeTargetLabel(
    runtimeTargets,
    primaryRuntimeId,
    "Primary runtime unavailable",
  );
  const configuredTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    service.databaseFailoverTargetRuntimeId,
    "Not configured",
  );
  const selectedTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    selectedTargetRuntimeId,
    "No standby selected",
  );
  const blockerMessage = !service.ownerAppId
    ? "This database is not attached to an application."
    : runtimeTargetInventoryError
      ? "Runtime list unavailable."
      : !primaryRuntimeId
        ? "Primary runtime unavailable."
        : continuityTargets.length === 0
          ? "Add another runtime before turning on database failover."
          : null;
  const canSave =
    !saving && !blockerMessage && Boolean(selectedTargetRuntimeId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!service.ownerAppId) {
      showToast({
        message: "This database cannot be configured from the console yet.",
        variant: "info",
      });
      return;
    }

    if (!selectedTargetRuntimeId) {
      showToast({
        message: blockerMessage ?? "Choose a standby runtime.",
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
              targetRuntimeId: selectedTargetRuntimeId,
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
          ? `Database failover already points to ${selectedTargetLabel}.`
          : `Database failover saved. Standby runtime: ${selectedTargetLabel}.`,
        variant: "success",
      });
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
    if (!service.ownerAppId || !service.databaseFailoverConfigured || saving) {
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

  return (
    <div className="fg-workbench-section fg-settings-panel">
      <div className="fg-workbench-section__copy fg-settings-panel__copy">
        <p className="fg-label fg-panel__eyebrow">Settings</p>
        <p className="fg-console-note">
          Keep this database on its primary runtime and choose a standby runtime
          for failover.
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
            tone={service.databaseFailoverConfigured ? "info" : "neutral"}
          >
            {service.databaseFailoverConfigured ? "Configured" : "Off"}
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
            <dd>
              {service.databaseFailoverConfigured
                ? configuredTargetLabel
                : "Not configured"}
            </dd>
          </div>
          <div>
            <dt>Topology</dt>
            <dd>{readDatabaseTopologyLabel(service)}</dd>
          </div>
        </dl>

        <form className="fg-settings-form" onSubmit={handleSubmit}>
          {blockerMessage ? (
            <InlineAlert variant="warning">{blockerMessage}</InlineAlert>
          ) : null}

          {continuityTargets.length > 0 ? (
            <FormField
              htmlFor={`database-failover-target-${service.id}`}
              label="Standby runtime"
            >
              <SelectField
                disabled={saving}
                id={`database-failover-target-${service.id}`}
                name="databaseFailoverTarget"
                onChange={(event) =>
                  setTargetRuntimeId(event.target.value || null)
                }
                value={selectedTargetRuntimeId ?? ""}
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
                disabled={saving}
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
    </div>
  );
}
