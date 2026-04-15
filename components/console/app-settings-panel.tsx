"use client";

import {
  startTransition,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { ConsoleDisclosureSection } from "@/components/console/console-disclosure-section";
import { useI18n } from "@/components/providers/i18n-provider";
import { PersistentStorageEditor } from "@/components/console/persistent-storage-editor";
import { StatusBadge } from "@/components/console/status-badge";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { HintInline } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import type {
  ConsoleGalleryAppView,
  ConsoleImportRuntimeTargetView,
} from "@/lib/console/gallery-types";
import {
  readDefaultImportRuntimeId,
  readManagedRuntimeTargets,
  readRuntimeTargetLabel,
} from "@/lib/console/runtime-targets";
import type { ConsoleTone } from "@/lib/console/types";
import { isDockerImageSourceType } from "@/lib/fugue/source-display";
import {
  persistentStorageDraftEqual,
  readPersistentStorageDraft,
  serializePersistentStorageDraft,
  summarizePersistentStorageDraft,
  validatePersistentStorageDraft,
} from "@/lib/fugue/persistent-storage";
import {
  isGitHubSourceType,
  isPrivateGitHubSourceType,
} from "@/lib/github/repository";
import { useGitHubConnection } from "@/lib/github/connection-client";

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

type AppPatchResponse = {
  alreadyCurrent?: boolean;
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

type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const DEFAULT_IMAGE_MIRROR_LIMIT = 1;

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function readImageMirrorLimit(value?: number | null) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }

  return DEFAULT_IMAGE_MIRROR_LIMIT;
}

function readImageMirrorLimitError(
  value: string,
  t: Translator = (key) => key,
) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return t("Saved image limit is required.");
  }

  if (!/^\d+$/.test(normalized)) {
    return t("Use a whole number.");
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return t("Use 1 or more.");
  }

  return null;
}

function isUploadSourceType(value?: string | null) {
  return value?.trim().toLowerCase() === "upload";
}

function isPausedApp(app: Pick<ConsoleGalleryAppView, "phase">) {
  const phase = normalizeText(app.phase).toLowerCase();
  return phase.includes("disabled") || phase.includes("paused");
}

function readErrorMessage(error: unknown, t: Translator = (key) => key) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
}

async function readResponseError(
  response: Response,
  t: Translator = (key) => key,
) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return t("Request failed with status {status}.", {
      status: response.status,
    });
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

async function requestJson<T>(
  input: RequestInfo,
  init?: RequestInit,
  t: Translator = (key) => key,
) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readResponseError(response, t));
  }

  return (await response.json().catch(() => null)) as T | null;
}

function readGitHubSyncState(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
): GitHubSyncState {
  if (!isGitHubSourceType(app.sourceType)) {
    return {
      action: null,
      actionLabel: null,
      description: null,
      label: t("Manual"),
      tone: "neutral",
    };
  }

  if (app.serviceRole === "pending") {
    return {
      action: null,
      actionLabel: null,
      description: t("Starts after first deploy."),
      label: t("Pending"),
      tone: "info",
    };
  }

  if (isPausedApp(app)) {
    return {
      action: "start",
      actionLabel: t("Resume"),
      description: t("Resume to poll new commits."),
      label: t("Off"),
      tone: "warning",
    };
  }

  return {
    action: "disable",
    actionLabel: t("Pause"),
    description: null,
    label: t("On"),
    tone: "positive",
  };
}

function readBranchFieldHint(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
) {
  if (!isGitHubSourceType(app.sourceType)) {
    return null;
  }

  if (app.serviceRole === "pending") {
    return t("Available after first deploy.");
  }

  if (isPausedApp(app)) {
    return t("Resume first.");
  }

  return t("Blank = default branch.");
}

function readRepositoryAccessHint(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
) {
  if (!isPrivateGitHubSourceType(app.sourceType)) {
    return null;
  }

  if (app.serviceRole === "pending") {
    return t("Available after first deploy.");
  }

  if (isPausedApp(app)) {
    return t("Resume first.");
  }

  return t("Blank = keep current access.");
}

function readSourceKindLabel(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
) {
  if (isGitHubSourceType(app.sourceType)) {
    return t("GitHub");
  }

  if (isDockerImageSourceType(app.sourceType)) {
    return t("Docker image");
  }

  if (isUploadSourceType(app.sourceType)) {
    return t("Local upload");
  }

  return t("Fixed source");
}

function readSourceSectionTitle(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
) {
  if (isGitHubSourceType(app.sourceType)) {
    return t("Repository");
  }

  if (isDockerImageSourceType(app.sourceType)) {
    return t("Image");
  }

  if (isUploadSourceType(app.sourceType)) {
    return t("Upload");
  }

  return t("Source");
}

function readSourceSectionHint(app: ConsoleGalleryAppView) {
  return null;
}

function readSourceFieldLabel(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
) {
  if (isGitHubSourceType(app.sourceType)) {
    return t("Tracked branch");
  }

  if (isDockerImageSourceType(app.sourceType)) {
    return t("Image reference");
  }

  if (isUploadSourceType(app.sourceType)) {
    return t("Source package");
  }

  return t("Source");
}

function readManualRefreshState(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
): ManualRefreshState | null {
  if (isGitHubSourceType(app.sourceType)) {
    return null;
  }

  if (isDockerImageSourceType(app.sourceType)) {
    return {
      description: null,
      label: t("Manual"),
      title: t("Refresh"),
      tone: "neutral",
    };
  }

  if (isUploadSourceType(app.sourceType)) {
    return {
      description: null,
      label: t("Manual"),
      title: t("Refresh"),
      tone: "neutral",
    };
  }

  return {
    description: null,
    label: t("Manual"),
    title: t("Refresh"),
    tone: "neutral",
  };
}

function SettingsSummaryList({ children }: { children: ReactNode }) {
  return <dl className="fg-settings-summary-list">{children}</dl>;
}

function SettingsSummaryRow({
  label,
  note,
  side,
  value,
}: {
  label: string;
  note?: ReactNode;
  side?: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="fg-settings-summary-row">
      <dt className="fg-settings-summary-row__copy">
        <HintInline
          ariaLabel={label}
          as="span"
          className="fg-settings-summary-row__label-row"
          hint={note}
        >
          <span className="fg-settings-summary-row__label">{label}</span>
        </HintInline>
        <span className="fg-settings-summary-row__value">{value}</span>
      </dt>
      {side ? <dd className="fg-settings-summary-row__side">{side}</dd> : null}
    </div>
  );
}

function readInitialContinuityTargetRuntimeId(
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

function hasStatefulMigrationBlockers(app: ConsoleGalleryAppView) {
  const hasPersistentStorage =
    app.persistentStorageMounts.length > 0 ||
    Boolean(
      app.persistentStorageStorageClassName || app.persistentStorageStorageSize,
    );

  return app.hasPersistentWorkspace || hasPersistentStorage;
}

function readTransferRequestMode(app: ConsoleGalleryAppView) {
  return hasStatefulMigrationBlockers(app) ? "failover" : "migrate";
}

function readTransferTargets(
  app: ConsoleGalleryAppView,
  runtimeTargets: ConsoleImportRuntimeTargetView[],
) {
  const activeRuntimeId = app.currentRuntimeId ?? app.runtimeId;
  return readTransferRequestMode(app) === "failover" ||
    app.hasManagedPostgresService
    ? readManagedRuntimeTargets(runtimeTargets, activeRuntimeId)
    : runtimeTargets.filter((target) => target.id !== activeRuntimeId);
}

function readTransferPreparationNote(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
) {
  const hasPersistentStorage =
    app.persistentStorageMounts.length > 0 ||
    Boolean(
      app.persistentStorageStorageClassName || app.persistentStorageStorageSize,
    );

  if (hasPersistentStorage && app.hasPostgresService) {
    return t(
      "Persistent storage sync runs before the move completes. Database stays where it is.",
    );
  }

  if (hasPersistentStorage) {
    return t("Persistent storage sync runs before the move completes.");
  }

  if (app.hasPostgresService) {
    return t("Database stays where it is.");
  }

  return null;
}

function readTransferActionHint(
  app: ConsoleGalleryAppView,
  t: Translator = (key) => key,
) {
  if (app.serviceRole === "pending") {
    return t("Wait for the current release to finish.");
  }

  if (isPausedApp(app)) {
    return t("Start the service before moving it.");
  }

  return null;
}

function readTransferConfirmationDescription(
  app: ConsoleGalleryAppView,
  liveRuntimeLabel: string,
  selectedTargetLabel: string,
  t: Translator = (key) => key,
) {
  const transferPreparationNote = readTransferPreparationNote(app, t);

  if (readTransferRequestMode(app) === "migrate") {
    return transferPreparationNote
      ? t(
          "{appName} stays live on {liveRuntimeLabel} while Fugue prepares {selectedTargetLabel}, then cuts over automatically. {transferPreparationNote}",
          {
            appName: app.name,
            liveRuntimeLabel,
            selectedTargetLabel,
            transferPreparationNote,
          },
        )
      : t(
          "{appName} stays live on {liveRuntimeLabel} while Fugue prepares {selectedTargetLabel}, then cuts over automatically.",
          {
            appName: app.name,
            liveRuntimeLabel,
            selectedTargetLabel,
          },
        );
  }

  return transferPreparationNote
    ? t(
        "{appName} will move from {liveRuntimeLabel} to {selectedTargetLabel}. {transferPreparationNote}",
        {
          appName: app.name,
          liveRuntimeLabel,
          selectedTargetLabel,
          transferPreparationNote,
        },
      )
    : t(
        "{appName} will move from {liveRuntimeLabel} to {selectedTargetLabel}.",
        {
          appName: app.name,
          liveRuntimeLabel,
          selectedTargetLabel,
        },
      );
}

function readPersistentStorageSummaryNote(
  hasPersistentStorage: boolean,
  t: Translator = (key) => key,
) {
  if (hasPersistentStorage) {
    return t(
      "Mounted storage survives restarts, rebuilds, managed transfers, and failover.",
    );
  }

  return t(
    "Files still live in the running container until persistent storage is configured.",
  );
}

function buildPersistentStorageSummaryItems(
  app: ConsoleGalleryAppView,
  hasPersistentStorage: boolean,
  currentRuntimeLabel: string,
  replicas: number | null,
  t: Translator = (key) => key,
) {
  if (hasPersistentStorage) {
    const items = [
      {
        label: t("Mounted items"),
        value: `${app.persistentStorageMounts.length}`,
      },
      {
        label: t("Storage"),
        value: app.persistentStorageStorageSize || t("Platform default"),
      },
      {
        label: t("Current runtime"),
        value: currentRuntimeLabel,
      },
    ];

    if (normalizeText(app.persistentStorageStorageClassName)) {
      items.push({
        label: t("Storage class"),
        value: app.persistentStorageStorageClassName || t("Platform default"),
      });
    }

    return items;
  }

  return [
    {
      label: t("File storage"),
      value: t("Live container filesystem"),
    },
    {
      label: t("Current runtime"),
      value: currentRuntimeLabel,
    },
    {
      label: t("Replica plan"),
      value: replicas === null ? t("Unknown") : `${replicas}`,
    },
  ];
}

function buildPersistentStorageMountItems(
  mounts: ConsoleGalleryAppView["persistentStorageMounts"],
  t: Translator = (key) => key,
) {
  return mounts.map((mount, index) => {
    const kindLabel =
      mount.kind === "file"
        ? t("File")
        : mount.kind === "directory"
          ? t("Directory")
          : t("Mount");
    const suffix = mounts.length > 1 ? ` ${index + 1}` : ` ${t("mount")}`;

    return {
      label: `${kindLabel}${suffix}`,
      value: mount.path,
    };
  });
}

function readStartupCommandSummary(
  value?: string | null,
  t: Translator = (key) => key,
) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return t("Image default");
  }

  if (normalized.length <= 48) {
    return normalized;
  }

  return `${normalized.slice(0, 45)}…`;
}

function AppStartupCommandSection({ app }: { app: ConsoleGalleryAppView }) {
  const router = useRouter();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [draftStartupCommand, setDraftStartupCommand] = useState(
    app.startupCommand ?? "",
  );
  const [baselineStartupCommand, setBaselineStartupCommand] = useState(
    app.startupCommand ?? "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextStartupCommand = app.startupCommand ?? "";
    setBaselineStartupCommand(nextStartupCommand);
    setDraftStartupCommand(nextStartupCommand);
  }, [app.id, app.startupCommand]);

  const normalizedBaselineCommand = normalizeText(baselineStartupCommand);
  const normalizedDraftCommand = normalizeText(draftStartupCommand);
  const startupCommandChanged =
    normalizedDraftCommand !== normalizedBaselineCommand;
  const canSaveStartupCommand = startupCommandChanged && !saving;
  const savedStartupCommandLabel = readStartupCommandSummary(
    baselineStartupCommand,
    t,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!startupCommandChanged) {
      showToast({
        message: normalizedDraftCommand
          ? t("Startup command already matches the current release.")
          : t("Startup command already uses the image default."),
        variant: "info",
      });
      return;
    }

    setSaving(true);

    try {
      const result = await requestJson<AppPatchResponse>(
        `/api/fugue/apps/${app.id}`,
        {
          body: JSON.stringify({
            startupCommand: draftStartupCommand,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
        t,
      );

      setBaselineStartupCommand(normalizedDraftCommand);
      setDraftStartupCommand(normalizedDraftCommand);
      showToast({
        message: result?.alreadyCurrent
          ? normalizedDraftCommand
            ? t("Startup command already matches the current release.")
            : t("Startup command already uses the image default.")
          : normalizedDraftCommand
            ? t("Startup command saved. Deploy queued.")
            : t("Startup command cleared. Deploy queued."),
        variant: "success",
      });
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

  return (
    <section
      aria-label={t("Startup command")}
      className="fg-route-subsection fg-settings-section"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Runtime")}</p>
          <HintInline
            ariaLabel={t("Startup command")}
            hint={t(
              "Override the image default entrypoint only when this service needs a custom shell command.",
            )}
          >
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("Startup command")}
            </h3>
          </HintInline>
        </div>
      </div>

      <ConsoleDisclosureSection
        className="fg-settings-disclosure"
        defaultOpen={startupCommandChanged || saving}
        description={t(
          "Runs as `sh -lc <command>`. Leave blank to use the image default entrypoint.",
        )}
        summary={t("Startup command · {value}", {
          value: savedStartupCommandLabel,
        })}
      >
        <form className="fg-settings-form" onSubmit={handleSubmit}>
          <FormField
            hint={t("Queued changes roll out in the next deploy operation.")}
            htmlFor={`startup-command-${app.id}`}
            label={t("Startup command")}
            optionalLabel={t("Optional")}
          >
            <input
              autoCapitalize="none"
              autoComplete="off"
              className="fg-input"
              id={`startup-command-${app.id}`}
              name="startupCommand"
              onChange={(event) => setDraftStartupCommand(event.target.value)}
              placeholder={t("npm run serve")}
              spellCheck={false}
              value={draftStartupCommand}
            />
          </FormField>

          {startupCommandChanged || saving ? (
            <div className="fg-settings-form__actions">
              <Button
                disabled={saving}
                onClick={() => setDraftStartupCommand(baselineStartupCommand)}
                size="compact"
                type="button"
                variant="secondary"
              >
                {t("Reset")}
              </Button>
              <Button
                disabled={!canSaveStartupCommand}
                loading={saving}
                loadingLabel={t("Queueing…")}
                size="compact"
                type="submit"
                variant="primary"
              >
                {t("Save command")}
              </Button>
            </div>
          ) : null}
        </form>
      </ConsoleDisclosureSection>
    </section>
  );
}

function AppImageMirrorLimitSection({ app }: { app: ConsoleGalleryAppView }) {
  const router = useRouter();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [baselineLimit, setBaselineLimit] = useState(() =>
    readImageMirrorLimit(app.imageMirrorLimit),
  );
  const [draftLimit, setDraftLimit] = useState(
    () => `${readImageMirrorLimit(app.imageMirrorLimit)}`,
  );
  const [saving, setSaving] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);

  useEffect(() => {
    const nextLimit = readImageMirrorLimit(app.imageMirrorLimit);

    setBaselineLimit(nextLimit);
    setDraftLimit(`${nextLimit}`);
    setSaving(false);
    setLimitError(null);
  }, [app.id, app.imageMirrorLimit]);

  const normalizedDraftLimit = normalizeText(draftLimit);
  const draftLimitError = readImageMirrorLimitError(draftLimit, t);
  const parsedDraftLimit = draftLimitError
    ? null
    : Number.parseInt(normalizedDraftLimit, 10);
  const limitChanged =
    parsedDraftLimit !== null
      ? parsedDraftLimit !== baselineLimit
      : normalizedDraftLimit !== `${baselineLimit}`;
  const canSaveLimit =
    !saving && limitChanged && !draftLimitError && parsedDraftLimit !== null;
  const savedImageLimitLabel =
    baselineLimit === 1
      ? t("{count} saved image", { count: baselineLimit })
      : t("{count} saved images", { count: baselineLimit });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextLimitError = readImageMirrorLimitError(draftLimit, t);
    if (nextLimitError) {
      setLimitError(nextLimitError);
      return;
    }

    const nextLimit = Number.parseInt(normalizeText(draftLimit), 10);
    if (!Number.isSafeInteger(nextLimit) || nextLimit < 1) {
      setLimitError(t("Use 1 or more."));
      return;
    }

    if (nextLimit === baselineLimit) {
      showToast({
        message: t("Mirrored image limit is already {count}.", {
          count: baselineLimit,
        }),
        variant: "info",
      });
      return;
    }

    setSaving(true);

    try {
      const result = await requestJson<AppPatchResponse>(
        `/api/fugue/apps/${app.id}`,
        {
          body: JSON.stringify({
            imageMirrorLimit: nextLimit,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
        t,
      );

      setBaselineLimit(nextLimit);
      setDraftLimit(`${nextLimit}`);
      setLimitError(null);
      showToast({
        message: result?.alreadyCurrent
          ? t("Mirrored image limit is already {count}.", {
              count: nextLimit,
            })
          : t("Mirrored image limit updated."),
        variant: "success",
      });
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

  return (
    <section
      aria-label={t("Mirrored image limit")}
      className="fg-route-subsection fg-settings-section"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Images")}</p>
          <HintInline
            ariaLabel={t("Image retention")}
            hint={t("Older mirrored images are pruned automatically.")}
          >
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("Image retention")}
            </h3>
          </HintInline>
        </div>
      </div>

      <ConsoleDisclosureSection
        className="fg-settings-disclosure"
        defaultOpen={limitChanged || saving}
        description={t(
          "Default is {count} saved images. The current release counts toward this limit.",
          {
            count: DEFAULT_IMAGE_MIRROR_LIMIT,
          },
        )}
        summary={t("Saved image limit · {value}", {
          value: savedImageLimitLabel,
        })}
      >
        <form className="fg-settings-form" onSubmit={handleSubmit}>
          <FormField
            error={
              limitError ?? (limitChanged ? draftLimitError : null) ?? undefined
            }
            hint={t("Use 1 or more.")}
            htmlFor={`mirrored-image-limit-${app.id}`}
            label={t("Saved image limit")}
          >
            <input
              className="fg-input"
              id={`mirrored-image-limit-${app.id}`}
              inputMode="numeric"
              min={1}
              name="imageMirrorLimit"
              onChange={(event) => {
                setDraftLimit(event.target.value);
                if (limitError) {
                  setLimitError(null);
                }
              }}
              step={1}
              type="number"
              value={draftLimit}
            />
          </FormField>

          {limitChanged || saving ? (
            <div className="fg-settings-form__actions">
              <Button
                disabled={saving}
                onClick={() => {
                  setDraftLimit(`${baselineLimit}`);
                  setLimitError(null);
                }}
                size="compact"
                type="button"
                variant="secondary"
              >
                {t("Reset")}
              </Button>
              <Button
                disabled={!canSaveLimit}
                loading={saving}
                loadingLabel={t("Saving…")}
                size="compact"
                type="submit"
                variant="primary"
              >
                {t("Save limit")}
              </Button>
            </div>
          ) : null}
        </form>
      </ConsoleDisclosureSection>
    </section>
  );
}

function AppPersistentStorageSection({
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
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const hasPersistentStorage = app.persistentStorageMounts.length > 0;
  const currentRuntimeId = app.currentRuntimeId ?? app.runtimeId;
  const currentRuntimeTarget =
    runtimeTargets.find((target) => target.id === currentRuntimeId) ?? null;
  const currentRuntimeLabel =
    currentRuntimeTarget || !runtimeTargetInventoryError
      ? readRuntimeTargetLabel(
          runtimeTargets,
          currentRuntimeId,
          locale,
          t("Runtime unavailable"),
        )
      : t("Inventory unavailable");
  const replicas =
    typeof app.replicaCount === "number" && Number.isFinite(app.replicaCount)
      ? app.replicaCount
      : null;
  const summaryNote = readPersistentStorageSummaryNote(hasPersistentStorage, t);
  const summaryItems = buildPersistentStorageSummaryItems(
    app,
    hasPersistentStorage,
    currentRuntimeLabel,
    replicas,
    t,
  );
  const mountItems = buildPersistentStorageMountItems(
    app.persistentStorageMounts,
    t,
  );
  const statusTone: ConsoleTone = hasPersistentStorage ? "info" : "neutral";
  const statusLabel = hasPersistentStorage
    ? t("Attached")
    : t("Not configured");
  const filesActionLabel = hasPersistentStorage
    ? t("Open Files")
    : t("Browse Live Files");
  const availabilityHint =
    app.serviceRole === "pending"
      ? t("Wait for the current release to finish before browsing files.")
      : isPausedApp(app)
        ? t("Start the service before opening Files.")
        : null;
  const [baselinePersistentStorage, setBaselinePersistentStorage] = useState(
    () =>
      readPersistentStorageDraft({
        mounts: app.persistentStorageMounts,
      }),
  );
  const [draftPersistentStorage, setDraftPersistentStorage] = useState(() =>
    readPersistentStorageDraft({
      mounts: app.persistentStorageMounts,
    }),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextPersistentStorage = readPersistentStorageDraft({
      mounts: app.persistentStorageMounts,
    });

    setBaselinePersistentStorage(nextPersistentStorage);
    setDraftPersistentStorage(nextPersistentStorage);
    setSaving(false);
  }, [app.id, app.persistentStorageMounts]);

  const persistentStorageChanged = !persistentStorageDraftEqual(
    baselinePersistentStorage,
    draftPersistentStorage,
  );
  const persistentStorageError = persistentStorageChanged
    ? validatePersistentStorageDraft(draftPersistentStorage)
    : null;
  const canSavePersistentStorage =
    !saving && persistentStorageChanged && !persistentStorageError;
  const savedPersistentStorageLabel =
    summarizePersistentStorageDraft(baselinePersistentStorage) ??
    t("No mounts attached");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!persistentStorageChanged) {
      showToast({
        message: hasPersistentStorage
          ? t("Persistent storage already matches the current release.")
          : t("Persistent storage is not configured yet."),
        variant: "info",
      });
      return;
    }

    const nextPersistentStorageError = validatePersistentStorageDraft(
      draftPersistentStorage,
    );

    if (nextPersistentStorageError) {
      showToast({
        message: nextPersistentStorageError,
        variant: "error",
      });
      return;
    }

    const nextPersistentStorage = serializePersistentStorageDraft(
      draftPersistentStorage,
      { preserveEmpty: true },
    );

    setSaving(true);

    try {
      const result = await requestJson<AppPatchResponse>(
        `/api/fugue/apps/${app.id}`,
        {
          body: JSON.stringify({
            persistentStorage: nextPersistentStorage ?? { mounts: [] },
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
        t,
      );

      const savedPersistentStorage = readPersistentStorageDraft(
        nextPersistentStorage,
      );

      setBaselinePersistentStorage(savedPersistentStorage);
      setDraftPersistentStorage(savedPersistentStorage);
      showToast({
        message: result?.alreadyCurrent
          ? savedPersistentStorage.length > 0
            ? t("Persistent storage already matches the current release.")
            : t("Persistent storage is already cleared.")
          : savedPersistentStorage.length > 0
            ? t("Persistent storage saved. Deploy queued.")
            : t("Persistent storage cleared. Deploy queued."),
        variant: "success",
      });
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

  return (
    <section
      aria-label={t("Persistent storage")}
      className="fg-route-subsection fg-settings-section"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Storage")}</p>
          <HintInline ariaLabel={t("Persistent storage")} hint={summaryNote}>
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("Persistent storage")}
            </h3>
          </HintInline>
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

      {mountItems.length > 0 ? (
        <dl className="fg-settings-meta">
          {mountItems.map((item) => (
            <div key={`${item.label}:${item.value}`}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ConsoleDisclosureSection
        className="fg-settings-disclosure"
        defaultOpen={persistentStorageChanged || saving}
        description={t(
          "Changes queue a deploy. File contents are only used when Fugue needs to create that file for the first time.",
        )}
        summary={t("Persistent storage · {value}", {
          value: savedPersistentStorageLabel,
        })}
      >
        <form className="fg-settings-form" onSubmit={handleSubmit}>
          {persistentStorageError ? (
            <InlineAlert variant="warning">
              {persistentStorageError}
            </InlineAlert>
          ) : null}

          <PersistentStorageEditor
            disabled={saving}
            idPrefix={`persistent-storage-${app.id}`}
            onChange={setDraftPersistentStorage}
            surface="console"
            value={draftPersistentStorage}
          />

          {persistentStorageChanged || saving ? (
            <div className="fg-settings-form__actions">
              <Button
                disabled={saving}
                onClick={() =>
                  setDraftPersistentStorage(baselinePersistentStorage)
                }
                size="compact"
                type="button"
                variant="secondary"
              >
                {t("Reset")}
              </Button>
              <Button
                disabled={!canSavePersistentStorage}
                loading={saving}
                loadingLabel={t("Queueing…")}
                size="compact"
                type="submit"
                variant="primary"
              >
                {t("Save storage")}
              </Button>
            </div>
          ) : null}
        </form>
      </ConsoleDisclosureSection>

      <div className="fg-settings-form__actions">
        <HintInline
          ariaLabel={filesActionLabel}
          hint={availabilityHint ?? undefined}
        >
          <Button
            disabled={!onOpenFiles}
            onClick={onOpenFiles ?? undefined}
            size="compact"
            type="button"
            variant={hasPersistentStorage ? "primary" : "secondary"}
          >
            {filesActionLabel}
          </Button>
        </HintInline>
      </div>
    </section>
  );
}

function readInitialTransferTargetRuntimeId(
  app: ConsoleGalleryAppView,
  runtimeTargets: ConsoleImportRuntimeTargetView[],
) {
  const manualRuntimeTargets = readTransferTargets(app, runtimeTargets);

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
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const primaryRuntimeId = app.runtimeId ?? app.currentRuntimeId;
  const activeRuntimeId = app.currentRuntimeId ?? app.runtimeId;
  const continuityTargets = readManagedRuntimeTargets(
    runtimeTargets,
    primaryRuntimeId,
  );
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
  const configuredTargetRuntimeId =
    app.failoverTargetRuntimeId &&
    app.failoverTargetRuntimeId !== primaryRuntimeId
      ? app.failoverTargetRuntimeId
      : null;
  const primaryRuntimeLabel = readRuntimeTargetLabel(
    runtimeTargets,
    primaryRuntimeId,
    locale,
    t("Primary runtime unavailable"),
  );
  const activeRuntimeLabel = readRuntimeTargetLabel(
    runtimeTargets,
    activeRuntimeId,
    locale,
    t("Runtime unavailable"),
  );
  const configuredTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    app.failoverTargetRuntimeId,
    locale,
    t("Not configured"),
  );
  const selectedTargetLabel = readRuntimeTargetLabel(
    runtimeTargets,
    selectedTargetRuntimeId,
    locale,
    t("No standby selected"),
  );
  const blockerMessage = runtimeTargetInventoryError
    ? t("Runtime list unavailable.")
    : !primaryRuntimeId
      ? t("Primary runtime unavailable.")
      : continuityTargets.length === 0
        ? t("Add another managed runtime before turning on automatic failover.")
        : null;
  const failoverStateLabel =
    app.failoverState === "configured"
      ? t("Configured")
      : app.failoverState === "unprotected"
        ? t("Protection missing")
        : t("Off");
  const failoverMessage =
    app.failoverState === "unprotected"
      ? t(
          "Failover already moved this app to {primaryRuntimeLabel}. No standby runtime is protecting it now. Choose a new standby to restore protection.",
          {
            primaryRuntimeLabel,
          },
        )
      : null;
  const saveButtonLabel = app.failoverConfigured
    ? t("Save standby")
    : app.failoverState === "unprotected"
      ? t("Restore protection")
      : t("Enable failover");
  const canSave =
    !saving && !blockerMessage && Boolean(selectedTargetRuntimeId);
  const failoverTargetChanged =
    selectedTargetRuntimeId !== configuredTargetRuntimeId;
  const showSaveButton =
    !app.failoverConfigured || failoverTargetChanged || saving;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTargetRuntimeId) {
      showToast({
        message: blockerMessage ?? t("Choose a standby runtime."),
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
        t,
      );

      showToast({
        message: result?.alreadyCurrent
          ? t("Automatic failover already points to {target}.", {
              target: selectedTargetLabel,
            })
          : app.failoverState === "unprotected"
            ? t("Protection restored. New standby runtime: {target}.", {
                target: selectedTargetLabel,
              })
            : t("Automatic failover saved. Standby runtime: {target}.", {
                target: selectedTargetLabel,
              }),
        variant: "success",
      });
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
    if (!app.failoverConfigured || saving) {
      return;
    }

    const disablesDatabaseReplica = app.hasManagedPostgresService;
    setSaving(true);

    try {
      const result = await requestJson<ContinuityResponse>(
        `/api/fugue/apps/${app.id}/continuity`,
        {
          body: JSON.stringify({
            appFailover: {
              enabled: false,
            },
            ...(disablesDatabaseReplica
              ? {
                  databaseFailover: {
                    enabled: false,
                  },
                }
              : {}),
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
          ? t("Automatic failover is already off.")
          : disablesDatabaseReplica
            ? t(
                "Automatic failover disabled. Standby database replica removed.",
              )
            : t("Automatic failover disabled."),
        variant: "success",
      });
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

  return (
    <section
      aria-label={t("Automatic failover")}
      className="fg-route-subsection fg-settings-section"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Continuity")}</p>
          <HintInline
            ariaLabel={t("Automatic failover")}
            hint={t(
              "Keep a standby runtime ready. Traffic only moves there if the primary runtime disappears. After a failover, choose a new standby to restore protection.",
            )}
          >
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("Automatic failover")}
            </h3>
          </HintInline>
        </div>

        <StatusBadge tone={app.failoverStateTone}>
          {failoverStateLabel}
        </StatusBadge>
      </div>

      <dl className="fg-settings-meta">
        <div>
          <dt>{t("Primary runtime")}</dt>
          <dd>{primaryRuntimeLabel}</dd>
        </div>
        {activeRuntimeId && activeRuntimeId !== primaryRuntimeId ? (
          <div>
            <dt>{t("Serving now")}</dt>
            <dd>{activeRuntimeLabel}</dd>
          </div>
        ) : null}
        <div>
          <dt>{t("Standby runtime")}</dt>
          <dd>
            {app.failoverConfigured
              ? configuredTargetLabel
              : t("Not configured")}
          </dd>
        </div>
      </dl>

      <form className="fg-settings-form" onSubmit={handleSubmit}>
        {failoverMessage ? (
          <InlineAlert variant="warning">{failoverMessage}</InlineAlert>
        ) : null}
        {blockerMessage ? (
          <InlineAlert variant="warning">{blockerMessage}</InlineAlert>
        ) : null}

        {continuityTargets.length > 0 ? (
          <FormField
            htmlFor={`automatic-failover-target-${app.id}`}
            label={t("Standby runtime")}
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
          {app.failoverConfigured ? (
            <Button
              disabled={saving}
              onClick={handleDisable}
              size="compact"
              type="button"
              variant="secondary"
            >
              {t("Disable")}
            </Button>
          ) : null}
          {showSaveButton ? (
            <Button
              disabled={!canSave}
              loading={saving}
              loadingLabel={t("Saving…")}
              size="compact"
              type="submit"
              variant="primary"
            >
              {saveButtonLabel}
            </Button>
          ) : null}
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
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const transferMode = readTransferRequestMode(app);
  const activeRuntimeId = app.currentRuntimeId ?? app.runtimeId;
  const transferTargets = readTransferTargets(app, runtimeTargets);
  const [targetRuntimeId, setTargetRuntimeId] = useState<string | null>(() =>
    readInitialTransferTargetRuntimeId(app, runtimeTargets),
  );
  const [transferSaving, setTransferSaving] = useState(false);

  useEffect(() => {
    setTargetRuntimeId(readInitialTransferTargetRuntimeId(app, runtimeTargets));
  }, [
    app.currentRuntimeId,
    app.failoverTargetRuntimeId,
    app.hasManagedPostgresService,
    app.hasPersistentWorkspace,
    app.id,
    app.persistentStorageMounts.length,
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
    locale,
    t("No target selected"),
  );
  const liveRuntimeLabel = readRuntimeTargetLabel(
    runtimeTargets,
    activeRuntimeId,
    locale,
    t("Current runtime unavailable"),
  );
  const actionHint = readTransferActionHint(app, t);
  const targetSelectionHint = runtimeTargetInventoryError
    ? t("Runtime list unavailable.")
    : transferTargets.length === 0
      ? transferMode === "failover" || app.hasManagedPostgresService
        ? t("Add another managed runtime before moving this service.")
        : t("Add another runtime before moving this service.")
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
        message: targetSelectionHint ?? t("Choose a destination."),
        variant: "info",
      });
      return;
    }

    const confirmed = await confirm({
      confirmLabel: t("Transfer Now"),
      description: readTransferConfirmationDescription(
        app,
        liveRuntimeLabel,
        selectedTargetLabel,
        t,
      ),
      eyebrow: t("Runtime Move"),
      title: t("Transfer Service?"),
      variant: "primary",
    });

    if (!confirmed) {
      return;
    }

    setTransferSaving(true);

    try {
      await requestJson<AppOperationResponse>(
        `/api/fugue/apps/${app.id}/${transferMode}`,
        {
          body: JSON.stringify({
            targetRuntimeId: selectedTargetRuntimeId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        t,
      );

      showToast({
        message: t("Transfer queued to {target}.", {
          target: selectedTargetLabel,
        }),
        variant: "success",
      });
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
    <section
      aria-label={t("One-Click Transfer")}
      className="fg-route-subsection fg-settings-section"
    >
      <div className="fg-route-subsection__head">
        <div className="fg-route-subsection__copy fg-settings-section__copy">
          <p className="fg-label fg-panel__eyebrow">{t("Runtime")}</p>
          <HintInline
            ariaLabel={t("One-Click Transfer")}
            hint={
              transferMode === "migrate"
                ? t(
                    "Current: {liveRuntimeLabel}. Fugue keeps the current runtime serving until the destination is ready.",
                    {
                      liveRuntimeLabel,
                    },
                  )
                : t(
                    "Current: {liveRuntimeLabel}. Choose a destination and move this service now.",
                    {
                      liveRuntimeLabel,
                    },
                  )
            }
          >
            <h3 className="fg-route-subsection__title fg-ui-heading">
              {t("One-Click Transfer")}
            </h3>
          </HintInline>
        </div>
      </div>

      <form className="fg-settings-form" onSubmit={handleTransferSubmit}>
        {blockerMessage ? (
          <InlineAlert variant="warning">{blockerMessage}</InlineAlert>
        ) : null}

        {transferTargets.length > 0 ? (
          <FormField
            htmlFor={`transfer-target-${app.id}`}
            label={t("Destination")}
          >
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
  );
}

export function AppSettingsPanel({
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
  const { t } = useI18n();
  const { showToast } = useToast();
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
    const nextBranch = app.sourceBranchName ?? "";
    setBranchBaseline(nextBranch);
    setBranchDraft(nextBranch);
  }, [app.id, app.sourceBranchName]);

  useEffect(() => {
    setRepoAuthTokenDraft("");
  }, [app.id]);

  const currentBranch = branchBaseline;
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
  const syncState = readGitHubSyncState(app, t);
  const sourceLabel = normalizeText(app.sourceLabel) || t("Unlinked source");
  const sourceKindLabel = readSourceKindLabel(app, t);
  const sourceSectionTitle = readSourceSectionTitle(app, t);
  const sourceSectionHint = readSourceSectionHint(app);
  const sourceFieldLabel = readSourceFieldLabel(app, t);
  const manualRefreshState = readManualRefreshState(app, t);
  const branchFieldHint = readBranchFieldHint(app, t);
  const repositoryAccessHint = readRepositoryAccessHint(app, t);
  const hasPersistentStorage = app.persistentStorageMounts.length > 0;
  const branchChanged = normalizedBranch !== normalizeText(currentBranch);
  const repoAuthTokenChanged = normalizedRepoAuthToken.length > 0;
  const hasSavedGitHubAccess = Boolean(githubConnection?.connected);
  const repoAccessActionsVisible =
    repoAuthTokenChanged || repoAuthTokenSaving || hasSavedGitHubAccess;
  const repoAccessSubmitLabel = normalizedRepoAuthToken
    ? t("Update token and rebuild")
    : t("Use saved access and rebuild");
  const workspaceSummaryAction = hasPersistentStorage
    ? t("inspect persistent storage")
    : t("review persistent storage configuration");
  const settingsSummary = isPrivateGitHubSource
    ? t(
        "Manage repository sync and GitHub access, set a startup command, tune image retention, {workspaceSummaryAction}, set automatic failover, or move {appName} by hand. Project naming and deletion live in project settings.",
        {
          appName: app.name,
          workspaceSummaryAction,
        },
      )
    : isGitHubSource
      ? t(
          "Manage repository sync, set a startup command, tune image retention, {workspaceSummaryAction}, set automatic failover, or move {appName} by hand. Project naming and deletion live in project settings.",
          {
            appName: app.name,
            workspaceSummaryAction,
          },
        )
      : isDockerImageSource
        ? t(
            "Review the saved Docker image reference, set a startup command, tune image retention, {workspaceSummaryAction}, set automatic failover, or move {appName} by hand. Project naming and deletion live in project settings.",
            {
              appName: app.name,
              workspaceSummaryAction,
            },
          )
        : isUploadSource
          ? t(
              "Review the saved upload source, set a startup command, tune image retention, {workspaceSummaryAction}, set automatic failover, or move {appName} by hand. Project naming and deletion live in project settings.",
              {
                appName: app.name,
                workspaceSummaryAction,
              },
            )
          : t(
              "Review the saved source definition, set a startup command, tune image retention, {workspaceSummaryAction}, set automatic failover, or move {appName} by hand. Project naming and deletion live in project settings.",
              {
                appName: app.name,
                workspaceSummaryAction,
              },
            );
  const syncSummaryValue =
    syncState.action === "disable"
      ? t("Polling for new commits")
      : syncState.action === "start"
        ? t("Updates paused")
        : t("Starts after first deploy");
  const branchSummaryValue = currentBranch || t("Default branch");
  const branchDisclosureDescription = !canEditBranch
    ? (branchFieldHint ?? t("Branch changes are unavailable."))
    : currentBranch
      ? t("Change the branch used for rebuilds.")
      : t("Leave it blank to follow the repository default branch.");
  const manualRefreshValue =
    manualRefreshState?.label === t("Manual")
      ? t("Refresh on demand")
      : (manualRefreshState?.label ?? t("Manual refresh"));

  async function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isGitHubSource) {
      showToast({
        message: t(
          "Only GitHub-backed services can change the tracked branch.",
        ),
        variant: "info",
      });
      return;
    }

    if (!canEditBranch) {
      showToast({
        message: branchFieldHint ?? t("Branch changes are unavailable."),
        variant: "info",
      });
      return;
    }

    if (!branchChanged) {
      showToast({
        message: t("No source branch changes."),
        variant: "info",
      });
      return;
    }

    setBranchSaving(true);

    try {
      await requestJson<RebuildResponse>(
        `/api/fugue/apps/${app.id}/rebuild`,
        {
          body: JSON.stringify({
            branch: normalizedBranch,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
        t,
      );

      setBranchBaseline(normalizedBranch);
      setBranchDraft(normalizedBranch);
      showToast({
        message: normalizedBranch
          ? t("Rebuild queued from {branch}.", {
              branch: normalizedBranch,
            })
          : t("Rebuild queued from default branch."),
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
        t,
      );

      showToast({
        message:
          syncState.action === "disable"
            ? t("Pause queued.")
            : t("Resume queued."),
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
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
        message: t(
          "Only private GitHub-backed services store a repository token.",
        ),
        variant: "info",
      });
      return;
    }

    if (!canUpdateRepoAccess) {
      showToast({
        message: repositoryAccessHint ?? t("Token updates are unavailable."),
        variant: "info",
      });
      return;
    }

    if (!normalizedRepoAuthToken && !hasSavedGitHubAccess) {
      showToast({
        message: githubConnectionLoading
          ? t(
              "Still checking saved GitHub access. Try again in a moment or paste a token.",
            )
          : t("Authorize GitHub or paste a new token first."),
        variant: "info",
      });
      return;
    }

    setRepoAuthTokenSaving(true);

    try {
      await requestJson<RebuildResponse>(
        `/api/fugue/apps/${app.id}/rebuild`,
        {
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
        },
        t,
      );

      setRepoAuthTokenDraft("");
      showToast({
        message: normalizedRepoAuthToken
          ? t("Repository token updated. Rebuild queued.")
          : t("Saved GitHub access applied. Rebuild queued."),
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setRepoAuthTokenSaving(false);
    }
  }

  return (
    <div className="fg-workbench-section fg-settings-panel">
      <div className="fg-workbench-section__copy fg-settings-panel__copy">
        <HintInline ariaLabel={t("Settings")} hint={settingsSummary}>
          <p className="fg-label fg-panel__eyebrow">{t("Settings")}</p>
        </HintInline>
      </div>

      <section
        aria-label={sourceSectionTitle}
        className="fg-route-subsection fg-settings-section"
      >
        <div className="fg-route-subsection__head">
          <div className="fg-route-subsection__copy fg-settings-section__copy">
            <p className="fg-label fg-panel__eyebrow">{t("Source")}</p>
            <HintInline
              ariaLabel={sourceSectionTitle}
              hint={sourceSectionHint ?? undefined}
            >
              <h3 className="fg-route-subsection__title fg-ui-heading">
                {sourceSectionTitle}
              </h3>
            </HintInline>
          </div>

          <StatusBadge tone={isGitHubSource ? "info" : "neutral"}>
            {sourceKindLabel}
          </StatusBadge>
        </div>

        {isGitHubSource ? (
          <>
            <SettingsSummaryList>
              <SettingsSummaryRow
                label={t("Repository")}
                value={
                  app.sourceHref ? (
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
                  )
                }
              />
              <SettingsSummaryRow
                label={t("Auto sync")}
                side={
                  <div className="fg-settings-summary-row__actions">
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
                            ? t("Pausing…")
                            : t("Starting…")
                        }
                        onClick={handleGitHubSyncToggle}
                        size="compact"
                        type="button"
                        variant={
                          syncState.action === "disable"
                            ? "secondary"
                            : "primary"
                        }
                      >
                        {syncState.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                }
                value={syncSummaryValue}
              />
            </SettingsSummaryList>

            {canEditBranch ? (
              <ConsoleDisclosureSection
                className="fg-settings-disclosure"
                defaultOpen={branchChanged || branchSaving}
                description={branchDisclosureDescription}
                summary={t("Tracked branch · {value}", {
                  value: branchSummaryValue,
                })}
              >
                <form
                  className="fg-settings-form"
                  onSubmit={handleBranchSubmit}
                >
                  <FormField
                    hint={branchFieldHint ?? undefined}
                    htmlFor={`service-branch-${app.id}`}
                    label={t("Tracked branch")}
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
                      placeholder={t("main")}
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
                        {t("Reset")}
                      </Button>
                      <Button
                        disabled={
                          !canEditBranch || !branchChanged || branchSaving
                        }
                        loading={branchSaving}
                        loadingLabel={t("Queueing…")}
                        size="compact"
                        type="submit"
                        variant="primary"
                      >
                        {t("Save and rebuild")}
                      </Button>
                    </div>
                  ) : null}
                </form>
              </ConsoleDisclosureSection>
            ) : (
              <SettingsSummaryList>
                <SettingsSummaryRow
                  label={t("Tracked branch")}
                  note={branchFieldHint ?? undefined}
                  value={branchSummaryValue}
                />
              </SettingsSummaryList>
            )}
          </>
        ) : (
          <SettingsSummaryList>
            <SettingsSummaryRow label={sourceFieldLabel} value={sourceLabel} />
            {manualRefreshState ? (
              <SettingsSummaryRow
                label={manualRefreshState.title}
                side={
                  <div className="fg-settings-summary-row__actions">
                    <StatusBadge tone={manualRefreshState.tone}>
                      {manualRefreshState.label}
                    </StatusBadge>
                  </div>
                }
                value={manualRefreshValue}
              />
            ) : null}
          </SettingsSummaryList>
        )}
      </section>

      {isPrivateGitHubSource ? (
        <section
          aria-label={t("Repository access")}
          className="fg-route-subsection fg-settings-section"
        >
          <div className="fg-route-subsection__head">
            <div className="fg-route-subsection__copy fg-settings-section__copy">
              <p className="fg-label fg-panel__eyebrow">{t("Source")}</p>
              <HintInline
                ariaLabel={t("GitHub access")}
                hint={repositoryAccessHint ?? undefined}
              >
                <h3 className="fg-route-subsection__title fg-ui-heading">
                  {t("GitHub access")}
                </h3>
              </HintInline>
            </div>

            <StatusBadge tone="info">
              {hasSavedGitHubAccess ? t("Saved access") : t("Stored token")}
            </StatusBadge>
          </div>

          <form
            className="fg-settings-form"
            onSubmit={handleRepositoryAccessSubmit}
          >
            <div className="fg-settings-source-meta">
              <span className="fg-settings-source-meta__label">
                {t("Repository")}
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

            {githubConnectionLoading ? (
              <InlineAlert>{t("Checking saved GitHub access…")}</InlineAlert>
            ) : githubConnectionError ? (
              <InlineAlert variant="warning">
                {githubConnectionError}
                {githubConnection?.authEnabled && githubConnectHref ? (
                  <>
                    {" "}
                    <ButtonAnchor
                      href={githubConnectHref}
                      size="compact"
                      variant="secondary"
                    >
                      {t("Reconnect GitHub")}
                    </ButtonAnchor>
                  </>
                ) : null}
              </InlineAlert>
            ) : hasSavedGitHubAccess ? (
              <InlineAlert variant="success">
                {githubConnection?.login
                  ? t("Saved GitHub access is ready as @{login}.", {
                      login: githubConnection.login,
                    })
                  : t("Saved GitHub access is ready.")}
                {githubConnection?.authEnabled && githubConnectHref ? (
                  <>
                    {" "}
                    <ButtonAnchor
                      href={githubConnectHref}
                      size="compact"
                      variant="secondary"
                    >
                      {t("Reconnect GitHub")}
                    </ButtonAnchor>
                  </>
                ) : null}
              </InlineAlert>
            ) : githubConnection?.authEnabled && githubConnectHref ? (
              <InlineAlert>
                {t(
                  "Authorize GitHub in the browser, or paste a replacement token below.",
                )}{" "}
                <ButtonAnchor
                  href={githubConnectHref}
                  size="compact"
                  variant="secondary"
                >
                  {t("Connect GitHub")}
                </ButtonAnchor>
              </InlineAlert>
            ) : null}

            <FormField
              hint={
                hasSavedGitHubAccess
                  ? t(
                      "Leave blank to use saved GitHub access. Paste a token only to override it.",
                    )
                  : t("Needs GitHub repo read access.")
              }
              htmlFor={`repo-auth-token-${app.id}`}
              label={t("Replace token")}
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
                    ? t("Paste a token to override saved GitHub access")
                    : t("github_pat_...")
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
                    {t("Reset")}
                  </Button>
                ) : null}
                <Button
                  disabled={
                    !canUpdateRepoAccess ||
                    (!repoAuthTokenChanged && !hasSavedGitHubAccess) ||
                    repoAuthTokenSaving
                  }
                  loading={repoAuthTokenSaving}
                  loadingLabel={t("Queueing…")}
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

      <AppStartupCommandSection app={app} />

      <AppImageMirrorLimitSection app={app} />

      <AppPersistentStorageSection
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
