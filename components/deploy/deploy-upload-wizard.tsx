"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createPendingProjectIntent,
  failPendingProjectIntent,
  resolvePendingProjectIntent,
} from "@/lib/console/pending-project-intents";
import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { EnvironmentEditor } from "@/components/console/environment-editor";
import { LocalUploadSourceField } from "@/components/console/local-upload-source-field";
import { PersistentStorageEditor } from "@/components/console/persistent-storage-editor";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useI18n } from "@/components/providers/i18n-provider";
import { SelectField } from "@/components/ui/select-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import {
  buildRawEnvFeedback,
  serializeEnvRecord,
} from "@/lib/console/raw-env";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import type { FugueProject } from "@/lib/fugue/api";
import {
  BUILD_STRATEGY_OPTIONS,
  buildImportServicePayload,
  createImportServiceDraft,
  IMPORT_NETWORK_MODE_OPTIONS,
  localUploadPreservesDetectedTopology,
  supportsGitHubDockerInputs,
  supportsGitHubSourceDir,
  validateImportServiceDraft,
  type BuildStrategyValue,
  type ImportNetworkMode,
} from "@/lib/fugue/import-source";
import {
  buildLocalUploadFormData,
  createLocalUploadState,
  inspectLocalUploadState,
  type LocalUploadState,
} from "@/lib/fugue/local-upload";
import {
  createPersistentStorageDraft,
  hasPersistentStorageDraft,
} from "@/lib/fugue/persistent-storage";
import {
  DUPLICATE_PROJECT_NAME_MESSAGE,
  findProjectByName,
} from "@/lib/project-names";

const NEW_PROJECT_VALUE = "__new__";

type DeployUploadWizardProps = {
  initialEnv?: Record<string, string>;
  projectInventoryError?: string | null;
  projects: FugueProject[];
  runtimeTargetInventoryError?: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  workspaceDefaultProjectId?: string | null;
  workspaceDefaultProjectName?: string | null;
};

type SubmitResponse = {
  error?: string;
  project?: {
    id?: string;
  } | null;
  requestInProgress?: boolean;
};

type Translator = ReturnType<typeof useI18n>["t"];

function readErrorMessage(error: unknown, t: Translator) {
  if (error instanceof Error && error.message.trim()) {
    return t(error.message);
  }

  return t("Deploy request failed.");
}

function buildProjectOptions(
  projects: FugueProject[],
  defaultProjectId?: string | null,
  defaultProjectName?: string | null,
  t?: Translator,
) {
  const deduped = new Map<string, string>();
  const translate: Translator = t ?? ((key: string) => key);

  for (const project of projects) {
    deduped.set(project.id, project.name);
  }

  return [
    ...Array.from(deduped.entries()).map(([id, name]) => ({
      id,
      label:
        defaultProjectId === id
          ? translate("{name} · Default project", { name })
          : name,
    })),
    {
      id: NEW_PROJECT_VALUE,
      label: defaultProjectName
        ? translate("Create new project · {name}", {
            name: defaultProjectName,
          })
        : translate("Create new project"),
    },
  ];
}

function readInitialProjectSelection(
  projects: FugueProject[],
  defaultProjectId?: string | null,
) {
  if (
    defaultProjectId &&
    projects.some((project) => project.id === defaultProjectId)
  ) {
    return defaultProjectId;
  }

  if (projects.length > 0) {
    return projects[0]?.id ?? NEW_PROJECT_VALUE;
  }

  return NEW_PROJECT_VALUE;
}

export function DeployUploadWizard({
  initialEnv = {},
  projectInventoryError = null,
  projects,
  runtimeTargetInventoryError = null,
  runtimeTargets,
  workspaceDefaultProjectId = null,
  workspaceDefaultProjectName = null,
}: DeployUploadWizardProps) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState(
    readInitialProjectSelection(projects, workspaceDefaultProjectId),
  );
  const [projectName, setProjectName] = useState(
    workspaceDefaultProjectName ?? "default",
  );
  const [name, setName] = useState("");
  const [runtimeId, setRuntimeId] = useState<string | null>(
    readDefaultImportRuntimeId(runtimeTargets),
  );
  const [buildStrategy, setBuildStrategy] =
    useState<BuildStrategyValue>("auto");
  const [sourceDir, setSourceDir] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("");
  const [buildContextDir, setBuildContextDir] = useState("");
  const [startupCommand, setStartupCommand] = useState("");
  const [networkMode, setNetworkMode] =
    useState<ImportNetworkMode>("public");
  const [persistentStorage, setPersistentStorage] = useState(() =>
    createPersistentStorageDraft(),
  );
  const [envRawDraft, setEnvRawDraft] = useState(() =>
    serializeEnvRecord(initialEnv),
  );
  const [envFeedback, setEnvFeedback] = useState(() =>
    buildRawEnvFeedback(serializeEnvRecord(initialEnv), "deploy", locale),
  );
  const [localUpload, setLocalUpload] = useState<LocalUploadState>(() =>
    createLocalUploadState(),
  );

  const supportsSourceDir = supportsGitHubSourceDir(buildStrategy);
  const supportsDockerInputs = supportsGitHubDockerInputs(buildStrategy);
  const localUploadInspection = inspectLocalUploadState(localUpload);
  const projectOptions = useMemo(
    () =>
      buildProjectOptions(
        projects,
        workspaceDefaultProjectId,
        workspaceDefaultProjectName,
        t,
      ),
    [projects, t, workspaceDefaultProjectId, workspaceDefaultProjectName],
  );
  const buildStrategyOptions = useMemo(
    () =>
      BUILD_STRATEGY_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t],
  );
  const networkModeOptions = useMemo(
    () =>
      IMPORT_NETWORK_MODE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t],
  );

  useEffect(() => {
    setRuntimeId((current) =>
      current && runtimeTargets.some((target) => target.id === current)
        ? current
        : readDefaultImportRuntimeId(runtimeTargets),
    );
  }, [runtimeTargets]);

  useEffect(() => {
    const nextEnvRaw = serializeEnvRecord(initialEnv);
    setEnvRawDraft(nextEnvRaw);
    setEnvFeedback(buildRawEnvFeedback(nextEnvRaw, "deploy", locale));
  }, [initialEnv, locale]);

  function updateEnvRaw(nextValue: string) {
    setEnvRawDraft(nextValue);
  }

  function buildDraft() {
    return {
      ...createImportServiceDraft(runtimeId),
      buildContextDir,
      buildStrategy,
      dockerfilePath,
      envRaw: envRawDraft,
      name,
      networkMode,
      persistentStorage,
      runtimeId,
      startupCommand,
      sourceDir,
      sourceMode: "local-upload" as const,
    };
  }

  const uploadDraft = buildDraft();
  const localUploadKeepsTopologyImport =
    localUploadPreservesDetectedTopology(uploadDraft);
  const startupCommandSupported = !(
    localUploadInspection.hasTopologyDefinition && localUploadKeepsTopologyImport
  );
  const networkModeSupported = startupCommandSupported;
  const persistentStorageSupported = startupCommandSupported;

  useEffect(() => {
    if (startupCommandSupported || !startupCommand.trim()) {
      return;
    }

    setStartupCommand("");
  }, [startupCommand, startupCommandSupported]);

  useEffect(() => {
    if (networkModeSupported || networkMode === "public") {
      return;
    }

    setNetworkMode("public");
  }, [networkMode, networkModeSupported]);

  function validate() {
    if (selectedProjectId === NEW_PROJECT_VALUE) {
      const normalizedProjectName = projectName.trim();

      if (!normalizedProjectName) {
        return t("Project name is required when creating a new project.");
      }

      if (findProjectByName(projects, normalizedProjectName)) {
        return t(DUPLICATE_PROJECT_NAME_MESSAGE);
      }
    }

    return validateImportServiceDraft(uploadDraft, {
      environmentFeedback: envFeedback,
      locale,
      localUpload,
      persistentStorageSupported,
    });
  }

  async function submit() {
    const validationError = validate();

    if (validationError) {
      throw new Error(validationError);
    }

    const normalizedProjectName =
      selectedProjectId === NEW_PROJECT_VALUE
        ? projectName.trim()
        : (projects.find((project) => project.id === selectedProjectId)?.name ??
          workspaceDefaultProjectName ??
          t("Project"));
    const intent = createPendingProjectIntent({
      appName: name.trim(),
      projectId:
        selectedProjectId !== NEW_PROJECT_VALUE ? selectedProjectId : null,
      projectName: normalizedProjectName,
      retryHref:
        typeof window === "undefined"
          ? null
          : `${window.location.pathname}${window.location.search}`,
      sourceLabel: t("Local source"),
      sourceMode: "local-upload",
    });
    const requestBody = buildLocalUploadFormData(
      {
        ...buildImportServicePayload(uploadDraft, {
          includePersistentStorage: persistentStorageSupported,
        }),
        ...(selectedProjectId !== NEW_PROJECT_VALUE
          ? { projectId: selectedProjectId }
          : {
              projectMode: "create",
              projectName: projectName.trim(),
            }),
      },
      localUpload,
    );

    void (async () => {
      try {
        const response = await fetch(
          "/api/fugue/projects/create-and-import-upload",
          {
            method: "POST",
            body: requestBody,
          },
        );

        const payload = (await response
          .json()
          .catch(() => null)) as SubmitResponse | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Deploy request failed.");
        }

        resolvePendingProjectIntent(intent.id, {
          projectId:
            payload?.project?.id ??
            (selectedProjectId !== NEW_PROJECT_VALUE ? selectedProjectId : null),
          requestInProgress: Boolean(payload?.requestInProgress),
        });
      } catch (error) {
        failPendingProjectIntent(intent.id, readErrorMessage(error, t));
      }
    })();

    router.push(`/app?intent=${encodeURIComponent(intent.id)}`);
  }

  return (
    <form
      className="fg-deploy-form"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(() => {
          void submit().catch((error) => {
            showToast({
              message: readErrorMessage(error, t),
              variant: "error",
            });
          });
        });
      }}
    >
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">{t("Deploy")}</p>
        <PanelTitle>{t("Deploy from a local source.")}</PanelTitle>
        <PanelCopy>
          {t("Drag a local folder, .zip, .tgz, docker-compose.yml, fugue.yaml, Dockerfile, or multiple source files. Fugue packages file uploads on the server, then imports the detected topology when present.")}
        </PanelCopy>

        {projectInventoryError ? (
          <InlineAlert variant="info">
            {t("Project inventory is unavailable right now. You can still deploy into a new project.")}
          </InlineAlert>
        ) : null}

        <div className="fg-deploy-form-grid">
          <FormField
            hint={t("Reuse an existing project or create a new one for this deploy.")}
            htmlFor="deploy-upload-project"
            label={t("Project")}
          >
            <SelectField
              id="deploy-upload-project"
              onChange={(event) => setSelectedProjectId(event.target.value)}
              value={selectedProjectId}
            >
              {projectOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </FormField>

          <FormField
            hint={t("Leave blank to reuse the uploaded folder or primary service name.")}
            htmlFor="deploy-upload-name"
            label={t("App name")}
            optionalLabel={t("Optional")}
          >
            <input
              className="fg-input"
              id="deploy-upload-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="route-service"
              value={name}
            />
          </FormField>
        </div>

        {selectedProjectId === NEW_PROJECT_VALUE ? (
          <FormField
            hint={t("This project will be created before the deploy is queued.")}
            htmlFor="deploy-upload-project-name"
            label={t("New project name")}
          >
            <input
              className="fg-input"
              id="deploy-upload-project-name"
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="default"
              value={projectName}
            />
          </FormField>
        ) : null}

        <FormField
          hint={t("The browser keeps files local until you submit the deploy.")}
          htmlFor="deploy-upload-upload-folder"
          label={t("Local source")}
        >
          <LocalUploadSourceField
            idPrefix="deploy-upload"
            onChange={setLocalUpload}
            value={localUpload}
          />
        </FormField>

        {localUploadInspection.hasTopologyDefinition ? (
          <InlineAlert
            variant={localUploadKeepsTopologyImport ? "info" : "warning"}
          >
            {localUploadKeepsTopologyImport
              ? t("Whole-topology import is ready. Leave build strategy on Auto detect and keep manual path overrides blank to import every service from fugue.yaml or docker-compose.")
              : t("Manual build overrides are active. Clear build strategy and path overrides if you want Fugue to import every service from fugue.yaml or docker-compose.")}
          </InlineAlert>
      ) : null}

      {!persistentStorageSupported &&
      hasPersistentStorageDraft(persistentStorage) ? (
        <InlineAlert variant="info">
          {t("Manual persistent storage mounts stay in this draft, but Fugue skips them while the upload imports a whole topology. Switch back to a single-app upload to reuse them.")}
        </InlineAlert>
      ) : null}
      </PanelSection>

      <PanelSection>
        <PanelTitle>{t("Target and build")}</PanelTitle>
        <PanelCopy>
          {t("Choose where the upload should land. Only add manual build settings when the upload is meant to deploy as a single app instead of a full manifest or compose topology.")}
        </PanelCopy>

        <DeploymentTargetField
          inventoryError={runtimeTargetInventoryError}
          name="deploy-upload-runtime"
          onChange={setRuntimeId}
          targets={runtimeTargets}
          value={runtimeId}
        />

        <FormField
          hint={t("Public services get a managed route. Internal services stay cluster-only. Background workers skip route and readiness setup.")}
          htmlFor="deploy-upload-network-mode"
          label={t("Network mode")}
        >
          <div id="deploy-upload-network-mode">
            <SegmentedControl
              ariaLabel={t("Upload deploy network mode")}
              onChange={setNetworkMode}
              options={networkModeOptions}
              value={networkModeSupported ? networkMode : "public"}
              variant="pill"
            />
          </div>
        </FormField>

        {!networkModeSupported ? (
          <InlineAlert variant="info">
            {t("Whole-topology uploads keep per-service networking from fugue.yaml or docker-compose.yml, so manual network mode is only available for single-app uploads.")}
          </InlineAlert>
        ) : networkMode === "internal" ? (
          <InlineAlert variant="info">
            {t("Internal services keep a cluster-only Service and readiness checks, but Fugue does not publish a public route for them.")}
          </InlineAlert>
        ) : networkMode === "background" ? (
          <InlineAlert variant="info">
            {t("Background workers run without a managed route, Kubernetes Service, or readiness port.")}
          </InlineAlert>
        ) : null}

        <div className="fg-deploy-form-grid">
          <FormField
            hint={t("Auto detect keeps compose and fugue manifest imports intact.")}
            htmlFor="deploy-upload-build-strategy"
            label={t("Build strategy")}
          >
            <SelectField
              id="deploy-upload-build-strategy"
              onChange={(event) =>
                setBuildStrategy(event.target.value as BuildStrategyValue)
              }
              value={buildStrategy}
            >
              {buildStrategyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          </FormField>

          {supportsSourceDir ? (
            <FormField
              hint={t("Use when the app lives below the uploaded root.")}
              htmlFor="deploy-upload-source-dir"
              label={t("Source directory")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="none"
                className="fg-input"
                id="deploy-upload-source-dir"
                onChange={(event) => setSourceDir(event.target.value)}
                placeholder="apps/web"
                spellCheck={false}
                value={sourceDir}
              />
            </FormField>
          ) : null}

          {supportsDockerInputs ? (
            <FormField
              hint={t("Required when the Dockerfile is outside the uploaded root.")}
              htmlFor="deploy-upload-dockerfile-path"
              label={t("Dockerfile path")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="none"
                className="fg-input"
                id="deploy-upload-dockerfile-path"
                onChange={(event) => setDockerfilePath(event.target.value)}
                placeholder="docker/Dockerfile"
                spellCheck={false}
                value={dockerfilePath}
              />
            </FormField>
          ) : null}

          {supportsDockerInputs ? (
            <FormField
              hint={t("Defaults to the uploaded root when omitted.")}
              htmlFor="deploy-upload-build-context-dir"
              label={t("Build context")}
              optionalLabel={t("Optional")}
            >
              <input
                autoCapitalize="none"
                className="fg-input"
                id="deploy-upload-build-context-dir"
                onChange={(event) => setBuildContextDir(event.target.value)}
                placeholder="."
                spellCheck={false}
                value={buildContextDir}
              />
            </FormField>
          ) : null}
        </div>
      </PanelSection>

      <PanelSection>
        <PanelTitle>{t("Environment")}</PanelTitle>
        <EnvironmentEditor
          fieldId="deploy-upload-env-raw"
          onChange={updateEnvRaw}
          onStatusChange={setEnvFeedback}
          surface="deploy"
          value={envRawDraft}
        />
      </PanelSection>

      {startupCommandSupported ? (
        <PanelSection>
          <PanelTitle>{t("Advanced settings")}</PanelTitle>
          <PanelCopy>
            {t("Override the default entrypoint only when this upload should start with a custom shell command.")}
          </PanelCopy>

          <FormField
            hint={t("Runs as `sh -lc <command>`. Leave blank to use the image default entrypoint.")}
            htmlFor="deploy-upload-startup-command"
            label={t("Startup command")}
            optionalLabel={t("Optional")}
          >
            <input
              autoCapitalize="none"
              autoComplete="off"
              className="fg-input"
              id="deploy-upload-startup-command"
              onChange={(event) => setStartupCommand(event.target.value)}
              placeholder="npm run serve"
              spellCheck={false}
              value={startupCommand}
            />
          </FormField>
        </PanelSection>
      ) : null}

      {persistentStorageSupported ? (
        <PanelSection>
          <PanelTitle>{t("Persistent storage")}</PanelTitle>
          <PanelCopy>
            {t("Add directories or files that should stay attached after redeploys, restarts, and runtime moves. File contents only apply when Fugue creates the file for the first time.")}
          </PanelCopy>

          <PersistentStorageEditor
            idPrefix="deploy-upload-persistent-storage"
            onChange={setPersistentStorage}
            surface="deploy"
            value={persistentStorage}
          />
        </PanelSection>
      ) : null}

      <PanelSection>
        <div className="fg-deploy-inline-actions">
          <Button
            loading={isPending}
            loadingLabel={t("Uploading deploy")}
            type="submit"
            variant="route"
          >
            {t("Upload and deploy")}
          </Button>
        </div>
        <p className="fg-deploy-inline-copy">
          {t("Fugue creates the project if needed, packages the selected files, and then sends you back to the console.")}
        </p>
      </PanelSection>
    </form>
  );
}
