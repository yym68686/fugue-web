"use client";

import { useEffect, useMemo, useState } from "react";

import { ConsoleDisclosureSection } from "@/components/console/console-disclosure-section";
import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { EnvironmentEditor } from "@/components/console/environment-editor";
import { GitHubRepositoryAccessFields } from "@/components/console/github-repository-access-fields";
import { LocalUploadSourceField } from "@/components/console/local-upload-source-field";
import { PersistentStorageEditor } from "@/components/console/persistent-storage-editor";
import { useI18n } from "@/components/providers/i18n-provider";
import { FormField } from "@/components/ui/form-field";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import {
  areRawEnvFeedbackEqual,
  buildRawEnvFeedback,
  type RawEnvFeedback,
} from "@/lib/console/raw-env";
import {
  buildImportRuntimeTargetGroups,
  readDefaultImportRuntimeId,
  readRuntimeTargetOptionLabel,
  readSelectedRuntimeTargetGroupId,
} from "@/lib/console/runtime-targets";
import type { FugueGitHubTemplateInspection } from "@/lib/fugue/api";
import {
  BUILD_STRATEGY_OPTIONS,
  IMPORT_NETWORK_MODE_OPTIONS,
  localUploadPreservesDetectedTopology,
  preservesGitHubTopologyImport,
  supportsGitHubDockerInputs,
  supportsGitHubSourceDir,
  type BuildStrategyValue,
  type ImportNetworkMode,
  type ImportServiceDraft,
  type ImportSourceMode,
} from "@/lib/fugue/import-source";
import {
  inspectLocalUploadState,
  type LocalUploadState,
} from "@/lib/fugue/local-upload";
import {
  buildPersistentStorageSeedFileKey,
  readInspectionPersistentStorageSeedFiles,
  type InspectionPersistentStorageSeedField,
} from "@/lib/fugue/template-inspection";
import {
  hasPersistentStorageDraft,
  summarizePersistentStorageDraft,
} from "@/lib/fugue/persistent-storage";
import { isGitHubRepoUrl } from "@/lib/github/repository";
import type { GitHubConnectionView } from "@/lib/github/types";
import {
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

type GitHubTemplateInspectionResponse = {
  inspection?: FugueGitHubTemplateInspection | null;
};

function buildPersistentStorageSeedFieldId(key: string) {
  return `${key.replace(/[^a-zA-Z0-9_-]+/g, "-")}-seed`;
}

function samePersistentStorageSeedFiles(
  left: ImportServiceDraft["persistentStorageSeedFiles"],
  right: ImportServiceDraft["persistentStorageSeedFiles"],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((file, index) => {
    const candidate = right[index];

    return (
      candidate?.service === file.service &&
      candidate?.path === file.path &&
      candidate?.seedContent === file.seedContent
    );
  });
}

type ImportServiceFieldProps = {
  draft: ImportServiceDraft;
  githubConnectHref?: string | null;
  githubConnection?: GitHubConnectionView | null;
  githubConnectionError?: string | null;
  githubConnectionLoading?: boolean;
  idPrefix: string;
  includeWrapper?: boolean;
  initialGitHubInspection?: FugueGitHubTemplateInspection | null;
  initialGitHubInspectionError?: string | null;
  inventoryError?: string | null;
  localUpload: LocalUploadState;
  onGitHubInspectionChange?: (
    inspection: FugueGitHubTemplateInspection | null,
    error: string | null,
  ) => void;
  onCapabilitiesChange?: (capabilities: {
    persistentStorageSupported: boolean;
    startupCommandSupported: boolean;
  }) => void;
  onDraftChange: (next: ImportServiceDraft) => void;
  onEnvironmentStatusChange?: (feedback: RawEnvFeedback) => void;
  onLocalUploadChange: (next: LocalUploadState) => void;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  showBranchField?: boolean;
  showDockerServicePort?: boolean;
  showRepositoryHint?: boolean;
  showSourceModeSwitch?: boolean;
};

export function ImportServiceFields({
  draft,
  githubConnectHref = null,
  githubConnection = null,
  githubConnectionError = null,
  githubConnectionLoading = false,
  idPrefix,
  includeWrapper = true,
  initialGitHubInspection = null,
  initialGitHubInspectionError = null,
  inventoryError = null,
  localUpload,
  onGitHubInspectionChange,
  onCapabilitiesChange,
  onDraftChange,
  onEnvironmentStatusChange,
  onLocalUploadChange,
  runtimeTargets,
  showBranchField = true,
  showDockerServicePort = false,
  showRepositoryHint = true,
  showSourceModeSwitch = true,
}: ImportServiceFieldProps) {
  const { locale, t } = useI18n();
  const sourceModeOptions: readonly SegmentedControlOption<ImportSourceMode>[] =
    [
      { label: t("GitHub repository"), value: "github" },
      { label: t("Local upload"), value: "local-upload" },
      { label: t("Docker image"), value: "docker-image" },
    ];
  const supportsSourceDir = supportsGitHubSourceDir(draft.buildStrategy);
  const supportsDockerInputs = supportsGitHubDockerInputs(draft.buildStrategy);
  const localUploadInspection = inspectLocalUploadState(localUpload);
  const localUploadKeepsTopologyImport =
    localUploadPreservesDetectedTopology(draft);
  const githubKeepsTopologyImport =
    draft.sourceMode === "github" && preservesGitHubTopologyImport(draft);
  const [githubInspection, setGitHubInspection] =
    useState<FugueGitHubTemplateInspection | null>(initialGitHubInspection);
  const [githubInspectionError, setGitHubInspectionError] = useState<
    string | null
  >(initialGitHubInspectionError);
  const runtimeTargetGroups = buildImportRuntimeTargetGroups(
    runtimeTargets,
    locale,
  );
  const selectedRuntimeTargetGroupId = readSelectedRuntimeTargetGroupId(
    runtimeTargetGroups,
    draft.runtimeId,
  );
  const selectedRuntimeTargetGroup =
    runtimeTargetGroups.find(
      (group) => group.id === selectedRuntimeTargetGroupId,
    ) ?? null;
  const selectedRuntimeTargetOption =
    selectedRuntimeTargetGroup?.options.find(
      (option) => option.id === draft.runtimeId,
    ) ??
    selectedRuntimeTargetGroup?.options.find(
      (option) =>
        option.id ===
        readDefaultImportRuntimeId(selectedRuntimeTargetGroup.options),
    ) ??
    selectedRuntimeTargetGroup?.options[0] ??
    null;
  const githubTopologyDetected = Boolean(
    githubInspection?.composeStack || githubInspection?.fugueManifest,
  );
  const startupCommandSupported =
    draft.sourceMode === "docker-image"
      ? true
      : draft.sourceMode === "github"
        ? !(githubKeepsTopologyImport && githubTopologyDetected)
        : !(
            localUploadInspection.hasTopologyDefinition &&
            localUploadKeepsTopologyImport
          );
  const networkModeSupported = startupCommandSupported;
  const persistentStorageSupported = startupCommandSupported;
  const deploymentSummaryParts = [
    draft.sourceMode === "github"
      ? draft.repoVisibility === "private"
        ? t("Private repo")
        : t("Public repo")
      : draft.sourceMode === "local-upload"
        ? localUploadInspection.hasArchive
          ? t("Local archive")
          : localUploadInspection.itemCount > 0
          ? t(
              localUploadInspection.itemCount === 1
                ? "{count} local file"
                : "{count} local files",
              {
                count: localUploadInspection.itemCount,
              },
            )
          : t("Local folder, files, or archive")
        : t("Published image"),
    selectedRuntimeTargetGroup?.summaryLabel ?? t("Internal cluster"),
    selectedRuntimeTargetOption
      ? readRuntimeTargetOptionLabel(selectedRuntimeTargetOption, locale)
      : null,
    draft.networkMode === "background"
      ? t("Background worker")
      : t("Public service"),
  ].filter(
    (part, index, parts): part is string =>
      Boolean(part) && parts.indexOf(part) === index,
  );
  const deploymentDescription = deploymentSummaryParts.join(" · ");
  const advancedSummaryParts = [
    showBranchField &&
    draft.sourceMode === "github" &&
    draft.branch.trim()
      ? t("Branch {branch}", { branch: draft.branch.trim() })
      : null,
    draft.sourceMode === "local-upload" && localUpload.label
      ? t("Upload {label}", { label: localUpload.label })
      : null,
    draft.name.trim() ? t("Name {name}", { name: draft.name.trim() }) : null,
    showDockerServicePort &&
    draft.sourceMode === "docker-image" &&
    draft.servicePort.trim()
      ? t("Port {port}", { port: draft.servicePort.trim() })
      : null,
    startupCommandSupported && draft.startupCommand.trim()
      ? t("Startup command")
      : null,
    persistentStorageSupported && hasPersistentStorageDraft(draft.persistentStorage)
      ? t("Persistent storage")
      : null,
    draft.sourceMode !== "docker-image" && draft.buildStrategy !== "auto"
      ? (BUILD_STRATEGY_OPTIONS.find(
          (option) => option.value === draft.buildStrategy,
        )?.label
          ? t(
              BUILD_STRATEGY_OPTIONS.find(
                (option) => option.value === draft.buildStrategy,
              )!.label,
            )
          : t("Custom build"))
      : null,
    draft.sourceDir.trim()
      ? t("Source {source}", { source: draft.sourceDir.trim() })
      : null,
    draft.dockerfilePath.trim()
      ? t("Dockerfile {path}", { path: draft.dockerfilePath.trim() })
      : null,
    draft.buildContextDir.trim()
      ? t("Context {path}", { path: draft.buildContextDir.trim() })
      : null,
  ].filter((part): part is string => Boolean(part));
  const advancedDescription =
    advancedSummaryParts.length > 0
      ? advancedSummaryParts.slice(0, 3).join(" · ")
      : draft.sourceMode === "docker-image"
        ? t("Service name and optional startup command.")
        : draft.sourceMode === "github"
          ? t(
              "Branch, name, startup command, build strategy, and optional paths.",
            )
          : t(
              "App name, startup command, build strategy, and optional source overrides.",
            );
  const deploymentDisclosureSummary =
    draft.sourceMode === "github"
      ? t("Access & deployment")
      : t("Deployment");
  const persistentStorageSeedFields = useMemo<
    InspectionPersistentStorageSeedField[]
  >(
    () =>
      githubKeepsTopologyImport
        ? readInspectionPersistentStorageSeedFiles(githubInspection)
        : [],
    [githubInspection, githubKeepsTopologyImport],
  );
  const persistentStorageSeedDescription =
    persistentStorageSeedFields.length > 0
      ? t(
          persistentStorageSeedFields.length === 1
            ? "{count} missing file before first deploy"
            : "{count} missing files before first deploy",
          {
            count: persistentStorageSeedFields.length,
          },
        )
      : null;
  const persistentStorageDescription =
    summarizePersistentStorageDraft(draft.persistentStorage) ??
    t("Add directories or files that must survive redeploys.");
  const [envFeedback, setEnvFeedback] = useState<RawEnvFeedback>(() =>
    buildRawEnvFeedback(draft.envRaw, "console", locale),
  );
  const envCount = Object.keys(envFeedback.env).length;
  const environmentDescription = !envFeedback.valid
    ? envFeedback.message
    : envCount > 0
      ? t(
          envCount === 1
            ? "{count} variable before first deploy"
            : "{count} variables before first deploy",
          {
            count: envCount,
          },
        )
      : t("Optional for first deploy");

  useEffect(() => {
    setEnvFeedback(buildRawEnvFeedback(draft.envRaw, "console", locale));
  }, [draft.envRaw, locale]);

  useEffect(() => {
    const repoUrl = draft.repoUrl.trim();
    const repoAuthToken = draft.repoAuthToken.trim();
    const requiresPrivateRepoAccess = draft.repoVisibility === "private";
    const canInspectPrivateRepo =
      !requiresPrivateRepoAccess ||
      Boolean(repoAuthToken) ||
      Boolean(githubConnection?.connected);

    setGitHubInspection(null);
    setGitHubInspectionError(null);

    if (
      !githubKeepsTopologyImport ||
      !repoUrl ||
      !isGitHubRepoUrl(repoUrl) ||
      (requiresPrivateRepoAccess &&
        (githubConnectionLoading || !canInspectPrivateRepo))
    ) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void requestJson<GitHubTemplateInspectionResponse>(
        "/api/fugue/templates/inspect-github",
        {
          body: JSON.stringify({
            branch: draft.branch.trim(),
            repoAuthToken,
            repoUrl,
            repoVisibility: draft.repoVisibility,
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        },
      )
        .then((response) => {
          setGitHubInspection(response.inspection ?? null);
          setGitHubInspectionError(null);
        })
        .catch((error) => {
          if (isAbortRequestError(error)) {
            return;
          }

          setGitHubInspection(null);
          setGitHubInspectionError(readRequestError(error));
        });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    draft.branch,
    draft.repoAuthToken,
    draft.repoUrl,
    draft.repoVisibility,
    githubConnection?.connected,
    githubConnectionLoading,
    githubKeepsTopologyImport,
  ]);

  useEffect(() => {
    onGitHubInspectionChange?.(githubInspection, githubInspectionError);
  }, [githubInspection, githubInspectionError, onGitHubInspectionChange]);

  useEffect(() => {
    if (startupCommandSupported || !draft.startupCommand.trim()) {
      return;
    }

    onDraftChange({
      ...draft,
      startupCommand: "",
    });
  }, [draft, onDraftChange, startupCommandSupported]);

  useEffect(() => {
    if (networkModeSupported || draft.networkMode !== "background") {
      return;
    }

    onDraftChange({
      ...draft,
      networkMode: "public",
    });
  }, [draft, networkModeSupported, onDraftChange]);

  useEffect(() => {
    onCapabilitiesChange?.({
      persistentStorageSupported,
      startupCommandSupported,
    });
  }, [
    onCapabilitiesChange,
    persistentStorageSupported,
    startupCommandSupported,
  ]);

  useEffect(() => {
    const currentValues = new Map(
      draft.persistentStorageSeedFiles.map((file) => [
        buildPersistentStorageSeedFileKey(file.service, file.path),
        file.seedContent,
      ]),
    );
    const nextPersistentStorageSeedFiles = persistentStorageSeedFields.map(
      (file) => ({
        path: file.path,
        seedContent: currentValues.get(file.key) ?? file.seedContent,
        service: file.service,
      }),
    );

    if (
      samePersistentStorageSeedFiles(
        draft.persistentStorageSeedFiles,
        nextPersistentStorageSeedFiles,
      )
    ) {
      return;
    }

    onDraftChange({
      ...draft,
      persistentStorageSeedFiles: nextPersistentStorageSeedFiles,
    });
  }, [draft, onDraftChange, persistentStorageSeedFields]);

  function updateField<Key extends keyof ImportServiceDraft>(
    key: Key,
    value: ImportServiceDraft[Key],
  ) {
    onDraftChange({
      ...draft,
      [key]: value,
    });
  }

  function updateEnvironmentFeedback(nextFeedback: RawEnvFeedback) {
    if (areRawEnvFeedbackEqual(envFeedback, nextFeedback)) {
      return;
    }

    setEnvFeedback(nextFeedback);
    onEnvironmentStatusChange?.(nextFeedback);
  }

  function updateSourceMode(nextMode: ImportSourceMode) {
    onDraftChange({
      ...draft,
      imageRef: nextMode === "docker-image" ? draft.imageRef : "",
      networkMode: draft.networkMode,
      persistentStorageSeedFiles:
        nextMode === "github" ? draft.persistentStorageSeedFiles : [],
      repoAuthToken: nextMode === "github" ? draft.repoAuthToken : "",
      repoUrl: nextMode === "github" ? draft.repoUrl : "",
      repoVisibility: nextMode === "github" ? draft.repoVisibility : "public",
      sourceMode: nextMode,
    });
  }

  function updateNetworkMode(nextMode: ImportNetworkMode) {
    onDraftChange({
      ...draft,
      networkMode: nextMode,
    });
  }

  function updatePersistentStorageSeedValue(key: string, value: string) {
    onDraftChange({
      ...draft,
      persistentStorageSeedFiles: draft.persistentStorageSeedFiles.map((file) =>
        buildPersistentStorageSeedFileKey(file.service, file.path) === key
          ? {
              ...file,
              seedContent: value,
            }
          : file,
      ),
    });
  }

  const content = (
    <>
      {showSourceModeSwitch ? (
        <div className="fg-field-stack">
          <div className="fg-field-label">
            <span>{t("Source mode")}</span>
          </div>
          <div className="fg-field-control">
            <SegmentedControl
              ariaLabel={t("Import source mode")}
              controlClassName="fg-console-nav"
              itemClassName="fg-console-nav__link"
              labelClassName="fg-console-nav__title"
              onChange={updateSourceMode}
              options={sourceModeOptions}
              value={draft.sourceMode}
              variant="pill"
            />
          </div>
        </div>
      ) : null}

      {draft.sourceMode === "github" ? (
        <FormField
          hint={
            showRepositoryHint
              ? t("Use https://github.com/owner/repo.")
              : undefined
          }
          htmlFor={`${idPrefix}-repo-url`}
          label={t("Repository link")}
        >
          <input
            autoCapitalize="none"
            autoComplete="url"
            className="fg-input"
            id={`${idPrefix}-repo-url`}
            inputMode="url"
            name="repoUrl"
            onChange={(event) => updateField("repoUrl", event.target.value)}
            placeholder="https://github.com/owner/repo"
            required
            spellCheck={false}
            type="url"
            value={draft.repoUrl}
          />
        </FormField>
      ) : draft.sourceMode === "local-upload" ? (
        <FormField
          hint={t(
            "Drag a folder, a .zip or .tgz archive, docker-compose.yml, fugue.yaml, Dockerfile, or multiple source files. Fugue creates the archive on the server before import unless you upload an archive directly.",
          )}
          htmlFor={`${idPrefix}-upload-folder`}
          label={t("Local source")}
        >
          <LocalUploadSourceField
            idPrefix={idPrefix}
            onChange={onLocalUploadChange}
            value={localUpload}
          />
        </FormField>
      ) : (
        <FormField
          hint={t(
            "Use a public image reference such as ghcr.io/example/api:1.2.3. Fugue mirrors it into the internal registry before rollout.",
          )}
          htmlFor={`${idPrefix}-image-ref`}
          label={t("Image reference")}
        >
          <input
            autoCapitalize="none"
            autoComplete="off"
            className="fg-input"
            id={`${idPrefix}-image-ref`}
            name="imageRef"
            onChange={(event) => updateField("imageRef", event.target.value)}
            placeholder="ghcr.io/example/api:1.2.3"
            required
            spellCheck={false}
            value={draft.imageRef}
          />
        </FormField>
      )}

      {draft.sourceMode === "local-upload" &&
      localUploadInspection.hasTopologyDefinition ? (
        <InlineAlert
          variant={localUploadKeepsTopologyImport ? "info" : "warning"}
        >
          {localUploadKeepsTopologyImport
            ? t(
                "Whole-topology import is ready. Leave build strategy on Auto detect and keep manual path overrides blank to import every service from fugue.yaml or docker-compose.",
              )
            : t(
                "Manual build overrides are active. Clear build strategy and path overrides if you want Fugue to import every service from fugue.yaml or docker-compose.",
              )}
        </InlineAlert>
      ) : null}

      {draft.sourceMode === "github" && githubInspectionError ? (
        <InlineAlert variant="warning">{githubInspectionError}</InlineAlert>
      ) : null}

      {draft.sourceMode === "github" &&
      persistentStorageSeedFields.length > 0 ? (
        <ConsoleDisclosureSection
          className="fg-console-dialog__advanced"
          defaultOpen
          description={persistentStorageSeedDescription ?? undefined}
          summary={t("Persistent files")}
        >
          <div className="fg-console-dialog__advanced-grid">
            {persistentStorageSeedFields.map((file) => {
              const fieldId = buildPersistentStorageSeedFieldId(file.key);
              const value =
                draft.persistentStorageSeedFiles.find(
                  (candidate) =>
                    buildPersistentStorageSeedFileKey(
                      candidate.service,
                      candidate.path,
                    ) === file.key,
                )?.seedContent ?? "";

              return (
                <FormField
                  hint={t(
                    "Service {service}. Leave blank to create an empty file on first deploy.",
                    {
                      service: file.service,
                    },
                  )}
                  htmlFor={fieldId}
                  key={file.key}
                  label={file.path}
                  optionalLabel={t("Optional")}
                >
                  <textarea
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="fg-input fg-console-seed-textarea"
                    id={fieldId}
                    onChange={(event) =>
                      updatePersistentStorageSeedValue(
                        file.key,
                        event.target.value,
                      )
                    }
                    placeholder={t("Leave blank to create an empty file.")}
                    spellCheck={false}
                    value={value}
                  />
                </FormField>
              );
            })}
          </div>
        </ConsoleDisclosureSection>
      ) : null}

      {!persistentStorageSupported &&
      hasPersistentStorageDraft(draft.persistentStorage) ? (
        <InlineAlert variant="info">
          {t(
            "Manual persistent storage mounts stay in your draft, but Fugue skips them while this import preserves a whole topology. Switch back to a single-app deploy to reuse them.",
          )}
        </InlineAlert>
      ) : null}

      {persistentStorageSupported ? (
        <ConsoleDisclosureSection
          className="fg-console-dialog__advanced"
          description={persistentStorageDescription}
          summary={t("Persistent storage")}
        >
          <PersistentStorageEditor
            idPrefix={`${idPrefix}-persistent-storage`}
            onChange={(next) =>
              updateField("persistentStorage", next)
            }
            surface="console"
            value={draft.persistentStorage}
          />
        </ConsoleDisclosureSection>
      ) : null}

      <ConsoleDisclosureSection
        className="fg-console-dialog__advanced"
        defaultOpen={!envFeedback.valid || Boolean(draft.envRaw.trim())}
        description={environmentDescription}
        summary={t("Environment")}
      >
        <EnvironmentEditor
          fieldId={`${idPrefix}-env-raw`}
          onChange={(value) => updateField("envRaw", value)}
          onStatusChange={updateEnvironmentFeedback}
          surface="console"
          value={draft.envRaw}
        />
      </ConsoleDisclosureSection>

      <ConsoleDisclosureSection
        className="fg-console-dialog__advanced"
        description={deploymentDescription}
        summary={deploymentDisclosureSummary}
      >
        {draft.sourceMode === "github" ? (
          <GitHubRepositoryAccessFields
            githubConnectHref={githubConnectHref}
            githubConnection={githubConnection}
            githubConnectionError={githubConnectionError}
            githubConnectionLoading={githubConnectionLoading}
            onTokenChange={(value) => updateField("repoAuthToken", value)}
            onVisibilityChange={(value) => updateField("repoVisibility", value)}
            token={draft.repoAuthToken}
            tokenFieldId={`${idPrefix}-repo-auth-token`}
            tokenRequired={draft.repoVisibility === "private"}
            visibility={draft.repoVisibility}
          />
        ) : null}

        <DeploymentTargetField
          inventoryError={inventoryError}
          name={`${idPrefix}-runtime-target`}
          onChange={(value) => updateField("runtimeId", value)}
          targets={runtimeTargets}
          value={draft.runtimeId}
        />

        <div className="fg-field-stack">
          <div className="fg-field-label">
            <span className="fg-field-label__main">
              <span className="fg-field-label__text">{t("Network mode")}</span>
              <HintTooltip ariaLabel={t("Network mode")}>
                {networkModeSupported
                  ? draft.networkMode === "background"
                    ? t(
                        "Background workers skip the managed route, Kubernetes Service, and readiness port.",
                      )
                    : t("Public services get a managed route and readiness checks.")
                  : t(
                      "Whole-topology imports keep per-service networking from fugue.yaml or docker-compose, so background worker mode is unavailable here.",
                    )}
              </HintTooltip>
            </span>
          </div>
          <div className="fg-field-control">
            <SegmentedControl
              ariaLabel={t("App network mode")}
              controlClassName="fg-console-nav"
              itemClassName="fg-console-nav__link"
              labelClassName="fg-console-nav__title"
              onChange={updateNetworkMode}
              options={IMPORT_NETWORK_MODE_OPTIONS.map((option) => ({
                ...option,
                label: t(option.label),
              }))}
              value={
                networkModeSupported ? draft.networkMode : "public"
              }
              variant="pill"
            />
          </div>
        </div>
      </ConsoleDisclosureSection>

      <ConsoleDisclosureSection
        className="fg-console-dialog__advanced"
        description={advancedDescription}
        summary={t("Advanced settings")}
      >
        <div className="fg-console-dialog__advanced-grid">
          {showBranchField && draft.sourceMode === "github" ? (
            <FormField
              hint={t("Leave blank to use the default branch.")}
              htmlFor={`${idPrefix}-repo-branch`}
              label={t("Branch")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-repo-branch`}
                name="branch"
                onChange={(event) => updateField("branch", event.target.value)}
                placeholder="main"
                spellCheck={false}
                value={draft.branch}
              />
            </FormField>
          ) : null}

          <FormField
            hint={
              draft.sourceMode === "github"
                ? t("Leave blank to reuse the repository name.")
                : draft.sourceMode === "local-upload"
                  ? t(
                      "Leave blank to derive the app name from the uploaded folder, file, or archive.",
                    )
                  : t(
                      "Leave blank to derive the app name from the image reference.",
                    )
            }
            htmlFor={`${idPrefix}-app-name`}
            label={t("App name")}
            optionalLabel={t("Optional")}
          >
            <input
              autoComplete="off"
              className="fg-input"
              id={`${idPrefix}-app-name`}
              name="name"
              onChange={(event) => updateField("name", event.target.value)}
              placeholder={t("Marketing site")}
              value={draft.name}
            />
          </FormField>

          {showDockerServicePort &&
          draft.sourceMode === "docker-image" &&
          draft.networkMode !== "background" ? (
            <FormField
              hint={t("Set this when the container listens on a known port.")}
              htmlFor={`${idPrefix}-service-port`}
              label={t("Service port")}
              optionalLabel={t("Optional")}
            >
              <input
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-service-port`}
                inputMode="numeric"
                name="servicePort"
                onChange={(event) => updateField("servicePort", event.target.value)}
                placeholder="8080"
                value={draft.servicePort}
              />
            </FormField>
          ) : null}

          {startupCommandSupported ? (
            <FormField
              hint={t(
                "Runs as `sh -lc <command>`. Leave blank to use the image default entrypoint.",
              )}
              htmlFor={`${idPrefix}-startup-command`}
              label={t("Startup command")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-startup-command`}
                name="startupCommand"
                onChange={(event) =>
                  updateField("startupCommand", event.target.value)
                }
                placeholder="npm run serve"
                spellCheck={false}
                value={draft.startupCommand}
              />
            </FormField>
          ) : null}

          {draft.sourceMode !== "docker-image" ? (
            <FormField
              hint={
                draft.sourceMode === "github"
                  ? t("This build strategy is reused for later syncs.")
                  : t(
                      "Leave auto on unless the upload needs a specific source or Dockerfile override.",
                    )
              }
              htmlFor={`${idPrefix}-build-strategy`}
              label={t("Build strategy")}
            >
              <SelectField
                autoComplete="off"
                id={`${idPrefix}-build-strategy`}
                name="buildStrategy"
                onChange={(event) =>
                  updateField(
                    "buildStrategy",
                    event.target.value as BuildStrategyValue,
                  )
                }
                value={draft.buildStrategy}
              >
                {BUILD_STRATEGY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
                  </option>
                ))}
              </SelectField>
            </FormField>
          ) : null}

          {draft.sourceMode !== "docker-image" && supportsSourceDir ? (
            <FormField
              hint={
                draft.sourceMode === "github"
                  ? t("Use when the app lives below the repo root.")
                  : t("Use when the uploaded app lives below the archive root.")
              }
              htmlFor={`${idPrefix}-source-dir`}
              label={t("Source directory")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-source-dir`}
                name="sourceDir"
                onChange={(event) =>
                  updateField("sourceDir", event.target.value)
                }
                placeholder="apps/web"
                spellCheck={false}
                value={draft.sourceDir}
              />
            </FormField>
          ) : null}

          {draft.sourceMode !== "docker-image" && supportsDockerInputs ? (
            <FormField
              hint={
                draft.sourceMode === "github"
                  ? t(
                      "Required when the Dockerfile is outside the repo root.",
                    )
                  : t(
                      "Required when the uploaded Dockerfile is outside the archive root.",
                    )
              }
              htmlFor={`${idPrefix}-dockerfile-path`}
              label={t("Dockerfile path")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-dockerfile-path`}
                name="dockerfilePath"
                onChange={(event) =>
                  updateField("dockerfilePath", event.target.value)
                }
                placeholder="docker/Dockerfile"
                spellCheck={false}
                value={draft.dockerfilePath}
              />
            </FormField>
          ) : null}

          {draft.sourceMode !== "docker-image" && supportsDockerInputs ? (
            <FormField
              hint={
                draft.sourceMode === "github"
                  ? t("Defaults to the repo root when omitted.")
                  : t("Defaults to the archive root when omitted.")
              }
              htmlFor={`${idPrefix}-build-context-dir`}
              label={t("Build context")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="fg-input"
                id={`${idPrefix}-build-context-dir`}
                name="buildContextDir"
                onChange={(event) =>
                  updateField("buildContextDir", event.target.value)
                }
                placeholder="."
                spellCheck={false}
                value={draft.buildContextDir}
              />
            </FormField>
          ) : null}
        </div>
      </ConsoleDisclosureSection>
    </>
  );

  return includeWrapper ? (
    <div className="fg-console-dialog__grid">{content}</div>
  ) : (
    content
  );
}
