"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/console/status-badge";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import type {
  ConsoleGalleryAppView,
  ConsoleImportRuntimeTargetView,
} from "@/lib/console/gallery-types";
import {
  readDefaultImportRuntimeId,
  readRuntimeTargetLabel,
} from "@/lib/console/runtime-targets";
import type { ConsoleTone } from "@/lib/console/types";
import { isDockerImageSourceType } from "@/lib/fugue/source-display";
import {
  isGitHubSourceType,
  isPrivateGitHubSourceType,
} from "@/lib/github/repository";
import { useGitHubConnection } from "@/lib/github/connection-client";

type ProjectPatchResponse = {
  project?: {
    id?: string;
    name?: string;
  } | null;
};

type RebuildResponse = {
  operation?: {
    id?: string | null;
  } | null;
};

type AppOperationResponse = {
  operation?: {
    id?: string | null;
  } | null;
};

type ContinuityResponse = {
  alreadyCurrent?: boolean;
};

type GitHubSyncState = {
  action: "disable" | "start" | null;
  actionLabel: string | null;
  description: string | null;
  label: string;
  tone: ConsoleTone;
};

type ManualRefreshState = {
  description: string | null;
  label: string;
  title: string;
  tone: ConsoleTone;
};

type ProjectNameEntry = {
  id: string;
  name: string;
};

const DEFAULT_WORKSPACE_MOUNT_PATH = "/workspace";

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function readDefaultWorkspaceMountPath(value?: string | null) {
  return normalizeText(value) || DEFAULT_WORKSPACE_MOUNT_PATH;
}

function readWorkspaceMountPathError(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "Mount path is required.";
  }

  if (!normalized.startsWith("/")) {
    return "Mount path must start with /.";
  }

  if (normalized === "/") {
    return "Mount path cannot be /.";
  }

  return null;
}

function slugifyLikeFugue(value: string) {
  const normalized = normalizeText(value).toLowerCase();
  let output = "";
  let lastDash = false;

  for (const char of normalized) {
    const isAlpha = char >= "a" && char <= "z";
    const isNumeric = char >= "0" && char <= "9";

    if (isAlpha || isNumeric) {
      output += char;
      lastDash = false;
      continue;
    }

    if (!lastDash && output.length > 0) {
      output += "-";
      lastDash = true;
    }
  }

  const trimmed = output.replace(/^-+/, "").replace(/-+$/, "");
  return trimmed || "item";
}

function isUploadSourceType(value?: string | null) {
  return value?.trim().toLowerCase() === "upload";
}

function isPausedApp(app: Pick<ConsoleGalleryAppView, "phase">) {
  const phase = normalizeText(app.phase).toLowerCase();
  return phase.includes("disabled") || phase.includes("paused");
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

function readGitHubSyncState(app: ConsoleGalleryAppView): GitHubSyncState {
  if (!isGitHubSourceType(app.sourceType)) {
    return {
      action: null,
      actionLabel: null,
      description: null,
      label: "Manual",
      tone: "neutral",
    };
  }

  if (app.serviceRole === "pending") {
    return {
      action: null,
      actionLabel: null,
      description: "Starts after first deploy.",
      label: "Pending",
      tone: "info",
    };
  }

  if (isPausedApp(app)) {
    return {
      action: "start",
      actionLabel: "Resume",
      description: "Resume to poll new commits.",
      label: "Off",
      tone: "warning",
    };
  }

  return {
    action: "disable",
    actionLabel: "Pause",
    description: null,
    label: "On",
    tone: "positive",
  };
}

function readBranchFieldHint(app: ConsoleGalleryAppView) {
  if (!isGitHubSourceType(app.sourceType)) {
    return null;
  }

  if (app.serviceRole === "pending") {
    return "Available after first deploy.";
  }

  if (isPausedApp(app)) {
    return "Resume first.";
  }

  return "Blank = default branch.";
}

function readRepositoryAccessHint(app: ConsoleGalleryAppView) {
  if (!isPrivateGitHubSourceType(app.sourceType)) {
    return null;
  }

  if (app.serviceRole === "pending") {
    return "Available after first deploy.";
  }

  if (isPausedApp(app)) {
    return "Resume first.";
  }

  return "Blank = keep current access.";
}

function readSourceKindLabel(app: ConsoleGalleryAppView) {
  if (isGitHubSourceType(app.sourceType)) {
    return "GitHub";
  }

  if (isDockerImageSourceType(app.sourceType)) {
    return "Docker image";
  }

  if (isUploadSourceType(app.sourceType)) {
    return "Local upload";
  }

  return "Fixed source";
}

function readSourceSectionTitle(app: ConsoleGalleryAppView) {
  if (isGitHubSourceType(app.sourceType)) {
    return "Repository";
  }

  if (isDockerImageSourceType(app.sourceType)) {
    return "Image";
  }

  if (isUploadSourceType(app.sourceType)) {
    return "Upload";
  }

  return "Source";
}

function readSourceSectionHint(app: ConsoleGalleryAppView) {
  return null;
}

function readSourceFieldLabel(app: ConsoleGalleryAppView) {
  if (isGitHubSourceType(app.sourceType)) {
    return "Tracked branch";
  }

  if (isDockerImageSourceType(app.sourceType)) {
    return "Image reference";
  }

  if (isUploadSourceType(app.sourceType)) {
    return "Source package";
  }

  return "Source";
}

function readManualRefreshState(
  app: ConsoleGalleryAppView,
): ManualRefreshState | null {
  if (isGitHubSourceType(app.sourceType)) {
    return null;
  }

  if (isDockerImageSourceType(app.sourceType)) {
    return {
      description: null,
      label: "Manual",
      title: "Refresh",
      tone: "neutral",
    };
  }

  if (isUploadSourceType(app.sourceType)) {
    return {
      description: null,
      label: "Manual",
      title: "Refresh",
      tone: "neutral",
    };
  }

  return {
    description: null,
    label: "Manual",
    title: "Refresh",
    tone: "neutral",
  };
}

function readInitialContinuityTargetRuntimeId(
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

function readTransferPreparationNote(app: ConsoleGalleryAppView) {
  const hasWorkspace = Boolean(normalizeText(app.workspaceMountPath));

  if (hasWorkspace && app.hasPostgresService) {
    return "Workspace sync runs before the move completes. Database stays where it is.";
  }

  if (hasWorkspace) {
    return "Workspace sync runs before the move completes.";
  }

  if (app.hasPostgresService) {
    return "Database stays where it is.";
  }

  return null;
}

function readTransferActionHint(app: ConsoleGalleryAppView) {
  if (app.serviceRole === "pending") {
    return "Wait for the current release to finish.";
  }

  if (isPausedApp(app)) {
    return "Start the service before moving it.";
  }

  return null;
}

function runtimeSupportsPersistentWorkspace(runtimeType?: string | null) {
  const normalized = normalizeText(runtimeType);
  return normalized === "managed-owned" || normalized === "managed-shared";
}

function readWorkspaceRuntimeGuidance(
  currentRuntimeId: string | null,
  runtimeTargets: ConsoleImportRuntimeTargetView[],
) {
  const eligibleTargets = runtimeTargets.filter(
    (target) =>
      runtimeSupportsPersistentWorkspace(target.runtimeType) &&
      target.id !== currentRuntimeId,
  );

  if (eligibleTargets.length === 0) {
    return null;
  }

  if (eligibleTargets.length === 1) {
    return `Move this service onto ${eligibleTargets[0].summaryLabel} to attach a persistent workspace.`;
  }

  return "Move this service onto an eligible managed runtime to attach a persistent workspace.";
}

function readWorkspaceSummaryNote(
  hasWorkspace: boolean,
  runtimeReadyForWorkspace: boolean | null,
  replicasReadyForWorkspace: boolean,
) {
  if (hasWorkspace) {
    return "Mounted storage survives restarts, managed transfers, and failover.";
  }

  if (!replicasReadyForWorkspace) {
    return "Persistent workspace needs 1 replica or fewer.";
  }

  if (runtimeReadyForWorkspace === false) {
    return "This service is not on a runtime that supports persistent workspace yet.";
  }

  if (runtimeReadyForWorkspace === null) {
    return "Workspace readiness is temporarily unavailable.";
  }

  return "Files still live in the running container until a workspace is attached.";
}

function buildWorkspaceSummaryItems(
  app: ConsoleGalleryAppView,
  hasWorkspace: boolean,
  currentRuntimeLabel: string,
  replicas: number | null,
) {
  if (hasWorkspace) {
    const items = [
      {
        label: "Mount path",
        value: readDefaultWorkspaceMountPath(app.workspaceMountPath),
      },
      {
        label: "Storage",
        value: app.workspaceStorageSize || "Platform default",
      },
    ];

    if (normalizeText(app.workspaceStorageClassName)) {
      items.push({
        label: "Storage class",
        value: app.workspaceStorageClassName || "Platform default",
      });
    }

    return items;
  }

  return [
    {
      label: "File storage",
      value: "Live container filesystem",
    },
    {
      label: "Current runtime",
      value: currentRuntimeLabel,
    },
    {
      label: "Replica plan",
      value: replicas === null ? "Unknown" : `${replicas}`,
    },
  ];
}

function AppPersistentWorkspaceSection({
  app,
  onOpenFiles,
  runtimeTargetInventoryError,
  runtimeTargets,
}: {
  app: ConsoleGalleryAppView;
  onOpenFiles?: (() => void) | null;
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const hasWorkspace = Boolean(normalizeText(app.workspaceMountPath));
  const currentRuntimeId = app.currentRuntimeId ?? app.runtimeId;
  const currentRuntimeTarget =
    runtimeTargets.find((target) => target.id === currentRuntimeId) ?? null;
  const currentRuntimeLabel =
    currentRuntimeTarget || !runtimeTargetInventoryError
      ? readRuntimeTargetLabel(
          runtimeTargets,
          currentRuntimeId,
          "Runtime unavailable",
        )
      : "Inventory unavailable";
  const replicas =
    typeof app.replicaCount === "number" && Number.isFinite(app.replicaCount)
      ? app.replicaCount
      : null;
  const runtimeReadyForWorkspace =
    currentRuntimeTarget
      ? runtimeSupportsPersistentWorkspace(currentRuntimeTarget.runtimeType)
      : runtimeTargetInventoryError
        ? null
        : false;
  const runtimeGuidance =
    runtimeReadyForWorkspace === false
      ? readWorkspaceRuntimeGuidance(
          currentRuntimeId,
          runtimeTargets,
        )
      : null;
  const replicasReadyForWorkspace = replicas === null || replicas <= 1;
  const summaryNote = readWorkspaceSummaryNote(
    hasWorkspace,
    runtimeReadyForWorkspace,
    replicasReadyForWorkspace,
  );
  const summaryItems = buildWorkspaceSummaryItems(
    app,
    hasWorkspace,
    currentRuntimeLabel,
    replicas,
  );
  const hasWorkspaceBlocker =
    !hasWorkspace &&
    (runtimeReadyForWorkspace === false || !replicasReadyForWorkspace);
  const statusTone: ConsoleTone = hasWorkspace
    ? "info"
    : hasWorkspaceBlocker
      ? "warning"
      : "neutral";
  const statusLabel = hasWorkspace
    ? "Attached"
    : hasWorkspaceBlocker
      ? "Unavailable"
      : runtimeReadyForWorkspace === null
        ? "Checking"
        : "Not attached";
  const workspaceCallout = hasWorkspace
    ? "Rebuild from source resets this workspace on the next rollout."
    : runtimeReadyForWorkspace === false
      ? runtimeGuidance ??
        "Persistent workspace currently requires a managed-shared or managed-owned runtime. This service is not on an eligible runtime yet."
      : !replicasReadyForWorkspace
        ? "Persistent workspace can only be attached while the app stays at one replica or fewer."
        : null;
  const filesActionLabel = hasWorkspace ? "Open Files" : "Browse Live Files";
  const availabilityHint =
    app.serviceRole === "pending"
      ? "Wait for the current release to finish before browsing files."
      : isPausedApp(app)
        ? "Start the service before opening Files."
        : null;
  const canAttachWorkspace =
    !hasWorkspace &&
    runtimeReadyForWorkspace === true &&
    replicasReadyForWorkspace;
  const attachActionHint =
    runtimeReadyForWorkspace === false
      ? workspaceCallout
      : runtimeReadyForWorkspace === null
        ? "Workspace readiness is temporarily unavailable."
        : !replicasReadyForWorkspace
          ? "Persistent workspace can only be attached while the app stays at one replica or fewer."
          : null;
  const [attachFormOpen, setAttachFormOpen] = useState(false);
  const [attachSaving, setAttachSaving] = useState(false);
  const [mountPathDraft, setMountPathDraft] = useState(() =>
    readDefaultWorkspaceMountPath(app.workspaceMountPath),
  );
  const [mountPathError, setMountPathError] = useState<string | null>(null);

  useEffect(() => {
    setAttachFormOpen(false);
    setAttachSaving(false);
    setMountPathDraft(readDefaultWorkspaceMountPath(app.workspaceMountPath));
    setMountPathError(null);
  }, [app.id, app.workspaceMountPath]);

  async function handleAttachSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canAttachWorkspace) {
      showToast({
        message: attachActionHint ?? "Persistent workspace is unavailable.",
        variant: "info",
      });
      return;
    }

    const normalizedMountPath = normalizeText(mountPathDraft);
    const nextMountPathError = readWorkspaceMountPathError(normalizedMountPath);
    if (nextMountPathError) {
      setMountPathError(nextMountPathError);
      return;
    }

    setAttachSaving(true);

    try {
      await requestJson<AppOperationResponse>(`/api/fugue/apps/${app.id}/deploy`, {
        body: JSON.stringify({
          mountPath: normalizedMountPath,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setMountPathError(null);
      showToast({
        message: `Workspace attach queued at ${normalizedMountPath}.`,
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
      setAttachSaving(false);
    }
  }

  function handleAttachCancel() {
    if (attachSaving) {
      return;
    }

    setAttachFormOpen(false);
    setMountPathDraft(readDefaultWorkspaceMountPath(app.workspaceMountPath));
    setMountPathError(null);
  }

  return (
    <section
      aria-label="Persistent workspace"
      className="fg-route-subsection fg-settings-section"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">Storage</p>
          <h3 className="fg-route-subsection__title fg-ui-heading">
            Persistent workspace
          </h3>
          <p className="fg-route-subsection__note">{summaryNote}</p>
        </div>

        <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
      </div>

      <dl className="fg-settings-meta">
        {summaryItems.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      {workspaceCallout ? (
        <InlineAlert variant={hasWorkspace ? "info" : "warning"}>
          {workspaceCallout}
        </InlineAlert>
      ) : null}

      {canAttachWorkspace && attachFormOpen ? (
        <form className="fg-settings-form" onSubmit={handleAttachSubmit}>
          <FormField
            error={mountPathError ?? undefined}
            hint="Use an absolute path inside the container. / is not allowed."
            htmlFor={`workspace-mount-path-${app.id}`}
            label="Mount Path"
          >
            <input
              autoComplete="off"
              className="fg-input"
              id={`workspace-mount-path-${app.id}`}
              name="mountPath"
              onChange={(event) => {
                setMountPathDraft(event.target.value);
                if (mountPathError) {
                  setMountPathError(null);
                }
              }}
              spellCheck={false}
              type="text"
              value={mountPathDraft}
            />
          </FormField>

          <div className="fg-settings-form__actions">
            <Button
              loading={attachSaving}
              loadingLabel="Attaching…"
              size="compact"
              type="submit"
              variant="primary"
            >
              Attach Workspace
            </Button>
            <Button
              disabled={attachSaving}
              onClick={handleAttachCancel}
              size="compact"
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={!onOpenFiles || attachSaving}
              onClick={onOpenFiles ?? undefined}
              size="compact"
              type="button"
              variant="ghost"
            >
              Browse Live Files
            </Button>
          </div>
        </form>
      ) : (
        <div className="fg-settings-form__actions">
          {canAttachWorkspace ? (
            <Button
              onClick={() => {
                setAttachFormOpen(true);
                setMountPathDraft(
                  readDefaultWorkspaceMountPath(app.workspaceMountPath),
                );
                setMountPathError(null);
              }}
              size="compact"
              type="button"
              variant="primary"
            >
              Attach Workspace
            </Button>
          ) : null}
          <Button
            disabled={!onOpenFiles}
            onClick={onOpenFiles ?? undefined}
            size="compact"
            type="button"
            variant={hasWorkspace ? "primary" : "secondary"}
          >
            {filesActionLabel}
          </Button>
        </div>
      )}

      {availabilityHint ? (
        <p className="fg-console-note">{availabilityHint}</p>
      ) : null}
    </section>
  );
}

function readInitialTransferTargetRuntimeId(
  app: ConsoleGalleryAppView,
  runtimeTargets: ConsoleImportRuntimeTargetView[],
) {
  const activeRuntimeId = app.currentRuntimeId ?? app.runtimeId;
  const manualRuntimeTargets = activeRuntimeId
    ? runtimeTargets.filter((target) => target.id !== activeRuntimeId)
    : runtimeTargets;

  if (
    app.failoverTargetRuntimeId &&
    manualRuntimeTargets.some(
      (target) => target.id === app.failoverTargetRuntimeId,
    )
  ) {
    return app.failoverTargetRuntimeId;
  }

  return readDefaultImportRuntimeId(manualRuntimeTargets);
}

function AppAutomaticFailoverSection({
  app,
  runtimeTargetInventoryError,
  runtimeTargets,
}: {
  app: ConsoleGalleryAppView;
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const primaryRuntimeId = app.runtimeId ?? app.currentRuntimeId;
  const activeRuntimeId = app.currentRuntimeId ?? app.runtimeId;
  const continuityTargets = primaryRuntimeId
    ? runtimeTargets.filter((target) => target.id !== primaryRuntimeId)
    : runtimeTargets;
  const [targetRuntimeId, setTargetRuntimeId] = useState<string | null>(() =>
    readInitialContinuityTargetRuntimeId(
      primaryRuntimeId,
      app.failoverTargetRuntimeId,
      runtimeTargets,
    ),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTargetRuntimeId(
      readInitialContinuityTargetRuntimeId(
        app.runtimeId ?? app.currentRuntimeId,
        app.failoverTargetRuntimeId,
        runtimeTargets,
      ),
    );
  }, [
    app.currentRuntimeId,
    app.failoverTargetRuntimeId,
    app.id,
    app.runtimeId,
    runtimeTargets,
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
  const activeRuntimeLabel = readRuntimeTargetLabel(
    runtimeTargets,
    activeRuntimeId,
    "Runtime unavailable",
  );
  const configuredTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    app.failoverTargetRuntimeId,
    "Not configured",
  );
  const selectedTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    selectedTargetRuntimeId,
    "No standby selected",
  );
  const blockerMessage = runtimeTargetInventoryError
    ? "Runtime list unavailable."
    : !primaryRuntimeId
      ? "Primary runtime unavailable."
      : continuityTargets.length === 0
        ? "Add another runtime before turning on automatic failover."
        : null;
  const canSave =
    !saving && !blockerMessage && Boolean(selectedTargetRuntimeId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
        `/api/fugue/apps/${app.id}/continuity`,
        {
          body: JSON.stringify({
            appFailover: {
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
          ? `Automatic failover already points to ${selectedTargetLabel}.`
          : `Automatic failover saved. Standby runtime: ${selectedTargetLabel}.`,
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
    if (!app.failoverConfigured || saving) {
      return;
    }

    setSaving(true);

    try {
      const result = await requestJson<ContinuityResponse>(
        `/api/fugue/apps/${app.id}/continuity`,
        {
          body: JSON.stringify({
            appFailover: {
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
          ? "Automatic failover is already off."
          : "Automatic failover disabled.",
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
    <section
      aria-label="Automatic failover"
      className="fg-route-subsection fg-settings-section"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">Continuity</p>
          <h3 className="fg-route-subsection__title fg-ui-heading">
            Automatic failover
          </h3>
          <p className="fg-route-subsection__note">
            Keep a standby runtime ready. Traffic only moves there if the
            primary runtime disappears.
          </p>
        </div>

        <StatusBadge tone={app.failoverConfigured ? "info" : "neutral"}>
          {app.failoverConfigured ? "Configured" : "Off"}
        </StatusBadge>
      </div>

      <dl className="fg-settings-meta">
        <div>
          <dt>Primary runtime</dt>
          <dd>{primaryRuntimeLabel}</dd>
        </div>
        {activeRuntimeId && activeRuntimeId !== primaryRuntimeId ? (
          <div>
            <dt>Serving now</dt>
            <dd>{activeRuntimeLabel}</dd>
          </div>
        ) : null}
        <div>
          <dt>Standby runtime</dt>
          <dd>
            {app.failoverConfigured ? configuredTargetLabel : "Not configured"}
          </dd>
        </div>
      </dl>

      <form className="fg-settings-form" onSubmit={handleSubmit}>
        {blockerMessage ? (
          <InlineAlert variant="warning">{blockerMessage}</InlineAlert>
        ) : null}

        {continuityTargets.length > 0 ? (
          <FormField
            htmlFor={`automatic-failover-target-${app.id}`}
            label="Standby runtime"
          >
            <SelectField
              disabled={saving}
              id={`automatic-failover-target-${app.id}`}
              name="automaticFailoverTarget"
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
          {app.failoverConfigured ? (
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
            {app.failoverConfigured ? "Save standby" : "Enable failover"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function AppTransferSection({
  app,
  runtimeTargetInventoryError,
  runtimeTargets,
}: {
  app: ConsoleGalleryAppView;
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const transferPreparationNote = readTransferPreparationNote(app);
  const activeRuntimeId = app.currentRuntimeId ?? app.runtimeId;
  const transferTargets = activeRuntimeId
    ? runtimeTargets.filter((target) => target.id !== activeRuntimeId)
    : runtimeTargets;
  const [targetRuntimeId, setTargetRuntimeId] = useState<string | null>(() =>
    readInitialTransferTargetRuntimeId(app, runtimeTargets),
  );
  const [transferSaving, setTransferSaving] = useState(false);

  useEffect(() => {
    setTargetRuntimeId(readInitialTransferTargetRuntimeId(app, runtimeTargets));
  }, [
    app.currentRuntimeId,
    app.failoverTargetRuntimeId,
    app.id,
    app.runtimeId,
    runtimeTargets,
  ]);

  const selectedTargetRuntimeId =
    targetRuntimeId && targetRuntimeId !== activeRuntimeId
      ? targetRuntimeId
      : null;
  const selectedTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    selectedTargetRuntimeId,
    "No target selected",
  );
  const liveRuntimeLabel = readRuntimeTargetLabel(
    runtimeTargets,
    activeRuntimeId,
    "Current runtime unavailable",
  );
  const actionHint = readTransferActionHint(app);
  const targetSelectionHint = runtimeTargetInventoryError
    ? "Runtime list unavailable."
    : transferTargets.length === 0
      ? "Add another runtime before moving this service."
      : null;
  const blockerMessage = actionHint ?? targetSelectionHint;
  const canTransfer =
    !transferSaving && !blockerMessage && Boolean(selectedTargetRuntimeId);

  async function handleTransferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (actionHint) {
      showToast({
        message: actionHint,
        variant: "info",
      });
      return;
    }

    if (!selectedTargetRuntimeId) {
      showToast({
        message: targetSelectionHint ?? "Choose a destination.",
        variant: "info",
      });
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Transfer Now",
      description: transferPreparationNote
        ? `${app.name} will move from ${liveRuntimeLabel} to ${selectedTargetLabel}. ${transferPreparationNote}`
        : `${app.name} will move from ${liveRuntimeLabel} to ${selectedTargetLabel}.`,
      eyebrow: "Runtime Move",
      title: "Transfer Service?",
      variant: "primary",
    });

    if (!confirmed) {
      return;
    }

    setTransferSaving(true);

    try {
      await requestJson<AppOperationResponse>(
        `/api/fugue/apps/${app.id}/failover`,
        {
          body: JSON.stringify({
            targetRuntimeId: selectedTargetRuntimeId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      showToast({
        message: `Transfer queued to ${selectedTargetLabel}.`,
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
      setTransferSaving(false);
    }
  }

  return (
    <section
      aria-label="One-Click Transfer"
      className="fg-route-subsection fg-settings-section"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">Runtime</p>
          <h3 className="fg-route-subsection__title fg-ui-heading">
            One-Click Transfer
          </h3>
          <p className="fg-route-subsection__note">
            Current: {liveRuntimeLabel}. Choose a destination and move this
            service now.
          </p>
        </div>
      </div>

      <form className="fg-settings-form" onSubmit={handleTransferSubmit}>
        {blockerMessage ? (
          <InlineAlert variant="warning">{blockerMessage}</InlineAlert>
        ) : null}

        {transferTargets.length > 0 ? (
          <FormField htmlFor={`transfer-target-${app.id}`} label="Destination">
            <SelectField
              disabled={transferSaving}
              id={`transfer-target-${app.id}`}
              name="transferTarget"
              onChange={(event) =>
                setTargetRuntimeId(event.target.value || null)
              }
              value={selectedTargetRuntimeId ?? ""}
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
  );
}

export function AppSettingsPanel({
  app,
  onOpenFiles,
  projectCatalog,
  projectId,
  projectManaged,
  projectName,
  runtimeTargetInventoryError,
  runtimeTargets,
  serviceCount,
}: {
  app: ConsoleGalleryAppView;
  onOpenFiles?: (() => void) | null;
  projectCatalog: ProjectNameEntry[];
  projectId: string;
  projectManaged: boolean;
  projectName: string;
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  serviceCount: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [projectNameDraft, setProjectNameDraft] = useState(projectName);
  const [projectBaseline, setProjectBaseline] = useState(projectName);
  const [projectSaving, setProjectSaving] = useState(false);
  const [branchDraft, setBranchDraft] = useState(app.sourceBranchName ?? "");
  const [branchBaseline, setBranchBaseline] = useState(
    app.sourceBranchName ?? "",
  );
  const [branchSaving, setBranchSaving] = useState(false);
  const [repoAuthTokenDraft, setRepoAuthTokenDraft] = useState("");
  const [repoAuthTokenSaving, setRepoAuthTokenSaving] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const {
    connectHref: githubConnectHref,
    connection: githubConnection,
    error: githubConnectionError,
    loading: githubConnectionLoading,
  } = useGitHubConnection({
    enabled: isPrivateGitHubSourceType(app.sourceType),
  });

  useEffect(() => {
    setProjectBaseline(projectName);
    setProjectNameDraft(projectName);
  }, [projectId, projectName]);

  useEffect(() => {
    const nextBranch = app.sourceBranchName ?? "";
    setBranchBaseline(nextBranch);
    setBranchDraft(nextBranch);
  }, [app.id, app.sourceBranchName]);

  useEffect(() => {
    setRepoAuthTokenDraft("");
  }, [app.id]);

  const currentProjectName = normalizeText(projectBaseline);
  const currentBranch = branchBaseline;
  const normalizedProjectName = normalizeText(projectNameDraft);
  const normalizedBranch = normalizeText(branchDraft);
  const normalizedRepoAuthToken = normalizeText(repoAuthTokenDraft);
  const isGitHubSource = isGitHubSourceType(app.sourceType);
  const isPrivateGitHubSource = isPrivateGitHubSourceType(app.sourceType);
  const isDockerImageSource = isDockerImageSourceType(app.sourceType);
  const isUploadSource = isUploadSourceType(app.sourceType);
  const canEditBranch =
    isGitHubSource && app.serviceRole === "running" && !isPausedApp(app);
  const canUpdateRepoAccess =
    isPrivateGitHubSource && app.serviceRole === "running" && !isPausedApp(app);
  const syncState = readGitHubSyncState(app);
  const sourceLabel = normalizeText(app.sourceLabel) || "Unlinked source";
  const sourceKindLabel = readSourceKindLabel(app);
  const sourceSectionTitle = readSourceSectionTitle(app);
  const sourceSectionHint = readSourceSectionHint(app);
  const sourceFieldLabel = readSourceFieldLabel(app);
  const manualRefreshState = readManualRefreshState(app);
  const branchFieldHint = readBranchFieldHint(app);
  const repositoryAccessHint = readRepositoryAccessHint(app);
  const hasWorkspace = Boolean(normalizeText(app.workspaceMountPath));
  const branchChanged = normalizedBranch !== normalizeText(currentBranch);
  const repoAuthTokenChanged = normalizedRepoAuthToken.length > 0;
  const hasSavedGitHubAccess = Boolean(githubConnection?.connected);
  const repoAccessActionsVisible =
    repoAuthTokenChanged || repoAuthTokenSaving || hasSavedGitHubAccess;
  const repoAccessSubmitLabel = normalizedRepoAuthToken
    ? "Update token and rebuild"
    : "Use saved access and rebuild";
  const projectChanged = normalizedProjectName !== currentProjectName;
  const projectSlug = slugifyLikeFugue(normalizedProjectName);
  const conflictingProject = projectCatalog.find(
    (entry) =>
      entry.id !== projectId && slugifyLikeFugue(entry.name) === projectSlug,
  );
  const projectNameError =
    projectManaged && projectChanged && !normalizedProjectName
      ? "Project name is required."
      : projectManaged && projectChanged && conflictingProject
        ? `Another project already uses “${conflictingProject.name}”.`
        : undefined;
  const canSaveProject =
    projectManaged && projectChanged && !projectSaving && !projectNameError;
  const workspaceSummaryAction = hasWorkspace
    ? "inspect the persistent workspace"
    : "review persistent workspace readiness";
  const settingsSummary = isPrivateGitHubSource
    ? `Rename the shared project shell, change the tracked branch, rotate saved GitHub access, ${workspaceSummaryAction}, set automatic failover, or move ${app.name} by hand.`
    : isGitHubSource
      ? `Rename the shared project shell, change which branch Fugue rebuilds from, ${workspaceSummaryAction}, set automatic failover, or move ${app.name} by hand.`
      : isDockerImageSource
        ? `Rename the shared project shell, review the saved Docker image reference, ${workspaceSummaryAction}, set automatic failover, or move ${app.name} by hand.`
        : isUploadSource
          ? `Rename the shared project shell, review the saved upload source, ${workspaceSummaryAction}, set automatic failover, or move ${app.name} by hand.`
          : `Rename the shared project shell, review the saved source definition, ${workspaceSummaryAction}, set automatic failover, or move ${app.name} by hand.`;
  const projectSectionNote = projectManaged
    ? `${serviceCount} service${serviceCount === 1 ? "" : "s"} share this project shell. Renaming it updates the whole group.`
    : "This service still lives in the Unassigned bucket, so the shared shell cannot be renamed yet.";

  async function handleProjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!projectManaged) {
      showToast({
        message: "Unassigned groups cannot be renamed yet.",
        variant: "info",
      });
      return;
    }

    if (!normalizedProjectName) {
      showToast({
        message: "Project name is required.",
        variant: "error",
      });
      return;
    }

    if (!projectChanged) {
      showToast({
        message: "No project name changes.",
        variant: "info",
      });
      return;
    }

    if (conflictingProject) {
      showToast({
        message: `Another project already uses “${conflictingProject.name}”. Project names must be unique within the workspace.`,
        variant: "error",
      });
      return;
    }

    setProjectSaving(true);

    try {
      await requestJson<ProjectPatchResponse>(
        `/api/fugue/projects/${projectId}`,
        {
          body: JSON.stringify({
            name: normalizedProjectName,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      setProjectBaseline(normalizedProjectName);
      setProjectNameDraft(normalizedProjectName);
      showToast({
        message: "Project name updated.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      const message = readErrorMessage(error);
      showToast({
        message:
          message.includes("resource conflict") ||
          message.includes("409 Conflict")
            ? "Another project already uses this name. Project names must be unique within the workspace."
            : message,
        variant: "error",
      });
    } finally {
      setProjectSaving(false);
    }
  }

  async function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isGitHubSource) {
      showToast({
        message: "Only GitHub-backed services can change the tracked branch.",
        variant: "info",
      });
      return;
    }

    if (!canEditBranch) {
      showToast({
        message: branchFieldHint ?? "Branch changes are unavailable.",
        variant: "info",
      });
      return;
    }

    if (!branchChanged) {
      showToast({
        message: "No source branch changes.",
        variant: "info",
      });
      return;
    }

    setBranchSaving(true);

    try {
      await requestJson<RebuildResponse>(`/api/fugue/apps/${app.id}/rebuild`, {
        body: JSON.stringify({
          branch: normalizedBranch,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setBranchBaseline(normalizedBranch);
      setBranchDraft(normalizedBranch);
      showToast({
        message: normalizedBranch
          ? `Rebuild queued from ${normalizedBranch}.`
          : "Rebuild queued from default branch.",
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
      setBranchSaving(false);
    }
  }

  async function handleGitHubSyncToggle() {
    if (!syncState.action || syncSaving) {
      return;
    }

    setSyncSaving(true);

    try {
      await requestJson<AppOperationResponse>(
        syncState.action === "disable"
          ? `/api/fugue/apps/${app.id}/disable`
          : `/api/fugue/apps/${app.id}/start`,
        {
          method: "POST",
        },
      );

      showToast({
        message:
          syncState.action === "disable" ? "Pause queued." : "Resume queued.",
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
      setSyncSaving(false);
    }
  }

  async function handleRepositoryAccessSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!isPrivateGitHubSource) {
      showToast({
        message:
          "Only private GitHub-backed services store a repository token.",
        variant: "info",
      });
      return;
    }

    if (!canUpdateRepoAccess) {
      showToast({
        message: repositoryAccessHint ?? "Token updates are unavailable.",
        variant: "info",
      });
      return;
    }

    if (!normalizedRepoAuthToken && !hasSavedGitHubAccess) {
      showToast({
        message: githubConnectionLoading
          ? "Still checking saved GitHub access. Try again in a moment or paste a token."
          : "Authorize GitHub or paste a new token first.",
        variant: "info",
      });
      return;
    }

    setRepoAuthTokenSaving(true);

    try {
      await requestJson<RebuildResponse>(`/api/fugue/apps/${app.id}/rebuild`, {
        body: JSON.stringify(
          normalizedRepoAuthToken
            ? {
                repoAuthToken: normalizedRepoAuthToken,
              }
            : {},
        ),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setRepoAuthTokenDraft("");
      showToast({
        message: normalizedRepoAuthToken
          ? "Repository token updated. Rebuild queued."
          : "Saved GitHub access applied. Rebuild queued.",
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
      setRepoAuthTokenSaving(false);
    }
  }

  return (
    <div className="fg-workbench-section fg-settings-panel">
      <div className="fg-workbench-section__copy fg-settings-panel__copy">
        <p className="fg-label fg-panel__eyebrow">Settings</p>
        <p className="fg-console-note">{settingsSummary}</p>
      </div>

      <section
        aria-label="Project shell"
        className="fg-route-subsection fg-settings-section"
      >
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy fg-settings-section__copy">
            <p className="fg-label fg-panel__eyebrow">Project</p>
            <h3 className="fg-route-subsection__title fg-ui-heading">
              Project shell
            </h3>
            <p className="fg-route-subsection__note">{projectSectionNote}</p>
          </div>

          <StatusBadge tone="neutral">
            {projectManaged ? `${serviceCount} services` : "Unassigned"}
          </StatusBadge>
        </div>

        {projectManaged ? (
          <form className="fg-settings-form" onSubmit={handleProjectSubmit}>
            <FormField
              error={projectNameError}
              hint="Must stay unique within this workspace."
              htmlFor={`project-name-${projectId}`}
              label="Project name"
            >
              <input
                autoComplete="off"
                className="fg-input"
                id={`project-name-${projectId}`}
                name="projectName"
                onChange={(event) => setProjectNameDraft(event.target.value)}
                placeholder="Project name"
                value={projectNameDraft}
              />
            </FormField>

            {projectChanged || projectSaving ? (
              <div className="fg-settings-form__actions">
                <Button
                  disabled={projectSaving}
                  onClick={() => setProjectNameDraft(projectBaseline)}
                  size="compact"
                  type="button"
                  variant="secondary"
                >
                  Reset
                </Button>
                <Button
                  disabled={!canSaveProject}
                  loading={projectSaving}
                  loadingLabel="Saving…"
                  size="compact"
                  type="submit"
                  variant="primary"
                >
                  Save name
                </Button>
              </div>
            ) : null}
          </form>
        ) : (
          <dl className="fg-settings-meta">
            <div>
              <dt>Current group</dt>
              <dd>{projectName}</dd>
            </div>
            <div>
              <dt>Save mode</dt>
              <dd>Unavailable</dd>
            </div>
          </dl>
        )}
      </section>

      <section
        aria-label={sourceSectionTitle}
        className="fg-route-subsection fg-settings-section"
      >
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy fg-settings-section__copy">
            <p className="fg-label fg-panel__eyebrow">Source</p>
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {sourceSectionTitle}
            </h3>
            {sourceSectionHint ? (
              <p className="fg-route-subsection__note">{sourceSectionHint}</p>
            ) : null}
          </div>

          <StatusBadge tone={isGitHubSource ? "info" : "neutral"}>
            {sourceKindLabel}
          </StatusBadge>
        </div>

        {isGitHubSource ? (
          <form
            className="fg-settings-form fg-settings-form--source"
            onSubmit={handleBranchSubmit}
          >
            <div className="fg-settings-source-toolbar">
              <div className="fg-settings-source-meta">
                <span className="fg-settings-source-meta__label">
                  Repository
                </span>
                <span className="fg-settings-source-meta__value">
                  {app.sourceHref ? (
                    <a
                      className="fg-text-link"
                      href={app.sourceHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {sourceLabel}
                    </a>
                  ) : (
                    sourceLabel
                  )}
                </span>
              </div>

              <div className="fg-settings-source-control">
                <div className="fg-settings-source-control__row">
                  <span className="fg-settings-source-control__label">
                    Auto sync
                  </span>
                  <StatusBadge
                    live={syncState.action === "disable"}
                    tone={syncState.tone}
                  >
                    {syncState.label}
                  </StatusBadge>
                  {syncState.actionLabel ? (
                    <Button
                      loading={syncSaving}
                      loadingLabel={
                        syncState.action === "disable"
                          ? "Pausing…"
                          : "Starting…"
                      }
                      onClick={handleGitHubSyncToggle}
                      size="compact"
                      type="button"
                      variant={
                        syncState.action === "disable" ? "secondary" : "primary"
                      }
                    >
                      {syncState.actionLabel}
                    </Button>
                  ) : null}
                </div>

                {syncState.description ? (
                  <p className="fg-settings-source-control__note">
                    {syncState.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="fg-settings-source-field">
              <FormField
                hint={branchFieldHint ?? undefined}
                htmlFor={`service-branch-${app.id}`}
                label="Tracked branch"
              >
                <input
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  className="fg-input"
                  disabled={!canEditBranch || branchSaving}
                  id={`service-branch-${app.id}`}
                  name="trackedBranch"
                  onChange={(event) => setBranchDraft(event.target.value)}
                  placeholder="main"
                  spellCheck={false}
                  value={branchDraft}
                />
              </FormField>

              {branchChanged || branchSaving ? (
                <div className="fg-settings-form__actions">
                  <Button
                    disabled={branchSaving}
                    onClick={() => setBranchDraft(currentBranch)}
                    size="compact"
                    type="button"
                    variant="secondary"
                  >
                    Reset
                  </Button>
                  <Button
                    disabled={!canEditBranch || !branchChanged || branchSaving}
                    loading={branchSaving}
                    loadingLabel="Queueing…"
                    size="compact"
                    type="submit"
                    variant="primary"
                  >
                    Save and rebuild
                  </Button>
                </div>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="fg-settings-form fg-settings-form--source">
            <div className="fg-settings-source-toolbar">
              <div className="fg-settings-source-meta">
                <span className="fg-settings-source-meta__label">
                  {sourceFieldLabel}
                </span>
                <span className="fg-settings-source-meta__value">
                  {sourceLabel}
                </span>
              </div>

              {manualRefreshState ? (
                <div className="fg-settings-source-control">
                  <div className="fg-settings-source-control__row">
                    <span className="fg-settings-source-control__label">
                      {manualRefreshState.title}
                    </span>
                    <StatusBadge tone={manualRefreshState.tone}>
                      {manualRefreshState.label}
                    </StatusBadge>
                  </div>

                  {manualRefreshState.description ? (
                    <p className="fg-settings-source-control__note">
                      {manualRefreshState.description}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {isPrivateGitHubSource ? (
        <section
          aria-label="Repository access"
          className="fg-route-subsection fg-settings-section"
        >
          <div className="fg-route-subsection__head">
            <div className="fg-route-subsection__copy fg-settings-section__copy">
              <p className="fg-label fg-panel__eyebrow">Source</p>
              <h3 className="fg-route-subsection__title fg-ui-heading">
                GitHub access
              </h3>
              {repositoryAccessHint ? (
                <p className="fg-route-subsection__note">
                  {repositoryAccessHint}
                </p>
              ) : null}
            </div>

            <StatusBadge tone="info">
              {hasSavedGitHubAccess ? "Saved access" : "Stored token"}
            </StatusBadge>
          </div>

          <form
            className="fg-settings-form"
            onSubmit={handleRepositoryAccessSubmit}
          >
            <div className="fg-settings-source-meta">
              <span className="fg-settings-source-meta__label">Repository</span>
              <span className="fg-settings-source-meta__value">
                {app.sourceHref ? (
                  <a
                    className="fg-text-link"
                    href={app.sourceHref}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {sourceLabel}
                  </a>
                ) : (
                  sourceLabel
                )}
              </span>
            </div>

            {githubConnectionLoading ? (
              <InlineAlert>Checking saved GitHub access…</InlineAlert>
            ) : githubConnectionError ? (
              <InlineAlert variant="warning">
                {githubConnectionError}
                {githubConnection?.authEnabled && githubConnectHref ? (
                  <>
                    {" "}
                    <ButtonAnchor href={githubConnectHref} size="compact" variant="secondary">
                      Reconnect GitHub
                    </ButtonAnchor>
                  </>
                ) : null}
              </InlineAlert>
            ) : hasSavedGitHubAccess ? (
              <InlineAlert variant="success">
                {githubConnection?.login
                  ? `Saved GitHub access is ready as @${githubConnection.login}.`
                  : "Saved GitHub access is ready."}
                {githubConnection?.authEnabled && githubConnectHref ? (
                  <>
                    {" "}
                    <ButtonAnchor href={githubConnectHref} size="compact" variant="secondary">
                      Reconnect GitHub
                    </ButtonAnchor>
                  </>
                ) : null}
              </InlineAlert>
            ) : githubConnection?.authEnabled && githubConnectHref ? (
              <InlineAlert>
                Authorize GitHub in the browser, or paste a replacement token below.
                {" "}
                <ButtonAnchor href={githubConnectHref} size="compact" variant="secondary">
                  Connect GitHub
                </ButtonAnchor>
              </InlineAlert>
            ) : null}

            <FormField
              hint={
                hasSavedGitHubAccess
                  ? "Leave blank to use saved GitHub access. Paste a token only to override it."
                  : "Needs GitHub repo read access."
              }
              htmlFor={`repo-auth-token-${app.id}`}
              label="Replace token"
            >
              <input
                autoCapitalize="none"
                autoComplete="new-password"
                className="fg-input"
                disabled={!canUpdateRepoAccess || repoAuthTokenSaving}
                id={`repo-auth-token-${app.id}`}
                name="repoAuthToken"
                onChange={(event) => setRepoAuthTokenDraft(event.target.value)}
                placeholder={
                  hasSavedGitHubAccess
                    ? "Paste a token to override saved GitHub access"
                    : "github_pat_..."
                }
                spellCheck={false}
                type="password"
                value={repoAuthTokenDraft}
              />
            </FormField>

            {repoAccessActionsVisible ? (
              <div className="fg-settings-form__actions">
                {repoAuthTokenChanged || repoAuthTokenSaving ? (
                  <Button
                    disabled={repoAuthTokenSaving}
                    onClick={() => setRepoAuthTokenDraft("")}
                    size="compact"
                    type="button"
                    variant="secondary"
                  >
                    Reset
                  </Button>
                ) : null}
                <Button
                  disabled={
                    !canUpdateRepoAccess ||
                    (!repoAuthTokenChanged && !hasSavedGitHubAccess) ||
                    repoAuthTokenSaving
                  }
                  loading={repoAuthTokenSaving}
                  loadingLabel="Queueing…"
                  size="compact"
                  type="submit"
                  variant="primary"
                >
                  {repoAccessSubmitLabel}
                </Button>
              </div>
            ) : null}
          </form>
        </section>
      ) : null}

      <AppPersistentWorkspaceSection
        app={app}
        onOpenFiles={onOpenFiles}
        runtimeTargetInventoryError={runtimeTargetInventoryError}
        runtimeTargets={runtimeTargets}
      />

      <AppAutomaticFailoverSection
        app={app}
        runtimeTargetInventoryError={runtimeTargetInventoryError}
        runtimeTargets={runtimeTargets}
      />

      <AppTransferSection
        app={app}
        runtimeTargetInventoryError={runtimeTargetInventoryError}
        runtimeTargets={runtimeTargets}
      />
    </div>
  );
}
