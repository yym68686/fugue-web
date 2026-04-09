"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ConsoleDisclosureSection } from "@/components/console/console-disclosure-section";
import {
  createPendingProjectIntent,
  failPendingProjectIntent,
  resolvePendingProjectIntent,
} from "@/lib/console/pending-project-intents";
import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { EnvironmentEditor } from "@/components/console/environment-editor";
import { GitHubRepositoryAccessFields } from "@/components/console/github-repository-access-fields";
import { PersistentStorageEditor } from "@/components/console/persistent-storage-editor";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SelectField } from "@/components/ui/select-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import {
  buildRawEnvFeedback,
  serializeEnvRecord,
} from "@/lib/console/raw-env";
import { pluralize, summarizeInspectManifest } from "@/lib/deploy/topology-display";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import type {
  FugueGitHubTemplateInspection,
  FugueProject,
} from "@/lib/fugue/api";
import {
  BUILD_STRATEGY_OPTIONS,
  IMPORT_NETWORK_MODE_OPTIONS,
  preservesGitHubTopologyImport,
  supportsGitHubDockerInputs,
  supportsGitHubSourceDir,
  type BuildStrategyValue,
} from "@/lib/fugue/import-source";
import {
  readInspectionPersistentStorageSeedFiles,
} from "@/lib/fugue/template-inspection";
import {
  createPersistentStorageDraft,
  hasPersistentStorageDraft,
  serializePersistentStorageDraft,
  summarizePersistentStorageDraft,
  validatePersistentStorageDraft,
} from "@/lib/fugue/persistent-storage";
import { useGitHubConnection } from "@/lib/github/connection-client";
import { PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE } from "@/lib/github/messages";
import type { GitHubRepoVisibility } from "@/lib/github/repository";
import { isGitHubRepoUrl } from "@/lib/github/repository";
import {
  DUPLICATE_PROJECT_NAME_MESSAGE,
  findProjectByName,
} from "@/lib/project-names";

const NEW_PROJECT_VALUE = "__new__";

type DeployWizardProps = {
  initialBranch: string;
  initialEnv?: Record<string, string>;
  initialRepoVisibility: GitHubRepoVisibility;
  inspection: FugueGitHubTemplateInspection | null;
  projectInventoryError?: string | null;
  projects: FugueProject[];
  repositoryUrl: string;
  runtimeTargetInventoryError?: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  workspaceDefaultProjectId?: string | null;
  workspaceDefaultProjectName?: string | null;
};

type SubmitResponse = {
  app?: {
    id?: string;
    projectId?: string;
  } | null;
  error?: string;
  requestInProgress?: boolean;
  redirectTo?: string;
};

type PersistentStorageSeedField = {
  key: string;
  path: string;
  seedContent: string;
  service: string;
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Deploy request failed.";
}

function resolveInitialRuntimeId(
  inspection: FugueGitHubTemplateInspection | null,
  runtimeTargets: ConsoleImportRuntimeTargetView[],
) {
  const templateRuntimeId = inspection?.template?.defaultRuntime?.trim() ?? "";

  if (
    templateRuntimeId &&
    runtimeTargets.some((target) => target.id === templateRuntimeId)
  ) {
    return templateRuntimeId;
  }

  return readDefaultImportRuntimeId(runtimeTargets);
}

function buildProjectOptions(
  projects: FugueProject[],
  defaultProjectId?: string | null,
  defaultProjectName?: string | null,
) {
  const deduped = new Map<string, string>();

  for (const project of projects) {
    deduped.set(project.id, project.name);
  }

  return [
    ...Array.from(deduped.entries()).map(([id, name]) => ({
      id,
      label: defaultProjectId === id ? `${name} · Default project` : name,
    })),
    {
      id: NEW_PROJECT_VALUE,
      label: `Create new project${defaultProjectName ? ` · ${defaultProjectName}` : ""}`,
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

function readInitialVariableValues(
  inspection: FugueGitHubTemplateInspection | null,
) {
  return Object.fromEntries(
    (inspection?.template?.variables ?? []).map((variable) => [
      variable.key,
      variable.defaultValue,
    ]),
  ) as Record<string, string>;
}

function buildPersistentStorageSeedFieldId(key: string) {
  return `persistent-storage-seed-${key.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function readInitialPersistentStorageSeedValues(
  inspection: FugueGitHubTemplateInspection | null,
) {
  return Object.fromEntries(
    readInspectionPersistentStorageSeedFiles(inspection).map((file) => [
      file.key,
      file.seedContent,
    ]),
  ) as Record<string, string>;
}

export function DeployWizard({
  initialBranch,
  initialEnv = {},
  initialRepoVisibility,
  inspection,
  projectInventoryError = null,
  projects,
  repositoryUrl,
  runtimeTargetInventoryError = null,
  runtimeTargets,
  workspaceDefaultProjectId = null,
  workspaceDefaultProjectName = null,
}: DeployWizardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [repoVisibility, setRepoVisibility] = useState<GitHubRepoVisibility>(
    initialRepoVisibility,
  );
  const [repoAuthToken, setRepoAuthToken] = useState("");
  const {
    connectHref: githubConnectHref,
    connection: githubConnection,
    error: githubConnectionError,
    loading: githubConnectionLoading,
  } = useGitHubConnection();
  const [name, setName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(
    readInitialProjectSelection(projects, workspaceDefaultProjectId),
  );
  const [projectName, setProjectName] = useState("");
  const [runtimeId, setRuntimeId] = useState<string | null>(
    resolveInitialRuntimeId(inspection, runtimeTargets),
  );
  const [buildStrategy, setBuildStrategy] =
    useState<BuildStrategyValue>("auto");
  const [sourceDir, setSourceDir] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("");
  const [buildContextDir, setBuildContextDir] = useState("");
  const [startupCommand, setStartupCommand] = useState("");
  const [networkMode, setNetworkMode] = useState<"background" | "public">(
    "public",
  );
  const [persistentStorage, setPersistentStorage] = useState(() =>
    createPersistentStorageDraft(),
  );
  const [envRawDraft, setEnvRawDraft] = useState(() =>
    serializeEnvRecord(initialEnv),
  );
  const [envFeedback, setEnvFeedback] = useState(() =>
    buildRawEnvFeedback(serializeEnvRecord(initialEnv), "deploy"),
  );
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    readInitialVariableValues(inspection),
  );
  const [persistentStorageSeedValues, setPersistentStorageSeedValues] =
    useState<Record<string, string>>(
      readInitialPersistentStorageSeedValues(inspection),
    );

  const manifest = inspection?.fugueManifest ?? null;
  const manifestSummary = summarizeInspectManifest(manifest);
  const hasFugueManifest = Boolean(manifest);
  const preservesTopologyImport =
    hasFugueManifest ||
    preservesGitHubTopologyImport({
      buildContextDir,
      buildStrategy,
      dockerfilePath,
      sourceDir,
    });
  const startupCommandSupported = !(
    Boolean(inspection?.fugueManifest || inspection?.composeStack) &&
    preservesTopologyImport
  );
  const networkModeSupported = startupCommandSupported;
  const persistentStorageSupported = startupCommandSupported;
  const templateVariables = inspection?.template?.variables ?? [];
  const persistentStorageSeedFiles = useMemo<PersistentStorageSeedField[]>(
    () =>
      preservesTopologyImport
        ? readInspectionPersistentStorageSeedFiles(inspection)
        : [],
    [inspection, preservesTopologyImport],
  );
  const supportsSourceDir = supportsGitHubSourceDir(buildStrategy);
  const supportsDockerInputs = supportsGitHubDockerInputs(buildStrategy);
  const deploymentSummaryCopy = `${repoVisibility === "private" ? "Private repo" : "Public repo"} · ${hasFugueManifest ? "Manifest import" : "Repository build"} · ${networkMode === "background" ? "Background worker" : "Public service"}`;
  const advancedSummaryParts = [
    name.trim() ? `Name ${name.trim()}` : null,
    startupCommandSupported && startupCommand.trim() ? "Startup command" : null,
    persistentStorageSupported && hasPersistentStorageDraft(persistentStorage)
      ? "Persistent storage"
      : null,
    !hasFugueManifest && buildStrategy !== "auto"
      ? (BUILD_STRATEGY_OPTIONS.find((option) => option.value === buildStrategy)
          ?.label ?? "Custom build")
      : null,
  ].filter((part): part is string => Boolean(part));
  const advancedSummaryCopy =
    advancedSummaryParts.length > 0
      ? advancedSummaryParts.join(" · ")
      : hasFugueManifest
        ? `Imports ${pluralize(manifestSummary.serviceCount, "service")} from ${manifest?.manifestPath ?? "fugue.yaml"}`
        : "App name, startup command, and optional build overrides.";
  const templateVariablesSummaryCopy =
    templateVariables.length > 0
      ? `${pluralize(templateVariables.length, "variable")} before first deploy`
      : null;
  const environmentSummaryCopy = !envFeedback.valid
    ? envFeedback.message
    : Object.keys(envFeedback.env).length > 0
      ? `${pluralize(
          Object.keys(envFeedback.env).length,
          "variable",
        )} before first deploy`
      : "Optional for first deploy";
  const persistentStorageSeedSummaryCopy =
    persistentStorageSeedFiles.length > 0
      ? `${pluralize(persistentStorageSeedFiles.length, "missing file")} before first deploy`
      : null;
  const persistentStorageSummaryCopy =
    summarizePersistentStorageDraft(persistentStorage) ??
    "Add directories or files that must stay attached after deploys and restarts.";
  const projectOptions = useMemo(
    () =>
      buildProjectOptions(
        projects,
        workspaceDefaultProjectId,
        workspaceDefaultProjectName,
      ),
    [projects, workspaceDefaultProjectId, workspaceDefaultProjectName],
  );

  useEffect(() => {
    setRuntimeId((current) =>
      current && runtimeTargets.some((target) => target.id === current)
        ? current
        : resolveInitialRuntimeId(inspection, runtimeTargets),
    );
  }, [inspection, runtimeTargets]);

  useEffect(() => {
    if (networkModeSupported || networkMode !== "background") {
      return;
    }

    setNetworkMode("public");
  }, [networkMode, networkModeSupported]);

  useEffect(() => {
    setVariableValues(readInitialVariableValues(inspection));
  }, [inspection]);

  useEffect(() => {
    const nextEnvRaw = serializeEnvRecord(initialEnv);
    setEnvRawDraft(nextEnvRaw);
    setEnvFeedback(buildRawEnvFeedback(nextEnvRaw, "deploy"));
  }, [initialEnv]);

  useEffect(() => {
    setPersistentStorageSeedValues(
      readInitialPersistentStorageSeedValues(inspection),
    );
  }, [inspection]);

  useEffect(() => {
    if (startupCommandSupported || !startupCommand.trim()) {
      return;
    }

    setStartupCommand("");
  }, [startupCommand, startupCommandSupported]);

  function updateEnvRaw(nextValue: string) {
    setEnvRawDraft(nextValue);
  }

  function validate() {
    if (!repositoryUrl.trim()) {
      return "Repository link is required.";
    }

    if (!isGitHubRepoUrl(repositoryUrl)) {
      return "GitHub repository links must use https://github.com/owner/repo.";
    }

    if (
      repoVisibility === "private" &&
      !repoAuthToken.trim() &&
      !githubConnection?.connected &&
      !githubConnectionLoading
    ) {
      return PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE;
    }

    if (selectedProjectId === NEW_PROJECT_VALUE) {
      const normalizedProjectName = projectName.trim();

      if (!normalizedProjectName) {
        return "Project name is required when creating a new project.";
      }

      if (findProjectByName(projects, normalizedProjectName)) {
        return DUPLICATE_PROJECT_NAME_MESSAGE;
      }
    }

    for (const variable of templateVariables) {
      const value = variableValues[variable.key]?.trim() ?? "";

      if (
        !value &&
        !variable.defaultValue &&
        !variable.generate &&
        variable.required
      ) {
        return `${variable.label || variable.key} is required.`;
      }
    }

    if (persistentStorageSupported) {
      const persistentStorageError = validatePersistentStorageDraft(
        persistentStorage,
      );

      if (persistentStorageError) {
        return persistentStorageError;
      }
    }

    if (!envFeedback.valid) {
      return envFeedback.message;
    }

    return null;
  }

  function updateVariableValue(key: string, value: string) {
    setVariableValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePersistentStorageSeedValue(key: string, value: string) {
    setPersistentStorageSeedValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit() {
    const validationError = validate();

    if (validationError) {
      showToast({
        message: validationError,
        variant: "error",
      });
      return;
    }

    const normalizedProjectName =
      selectedProjectId === NEW_PROJECT_VALUE
        ? projectName.trim()
        : (projects.find((project) => project.id === selectedProjectId)?.name ??
          workspaceDefaultProjectName ??
          "Project");
    const serializedPersistentStorage =
      persistentStorageSupported
        ? serializePersistentStorageDraft(persistentStorage)
        : undefined;
    const intent = createPendingProjectIntent({
      appName: name.trim(),
      projectId:
        selectedProjectId !== NEW_PROJECT_VALUE ? selectedProjectId : null,
      projectName: normalizedProjectName,
      retryHref:
        typeof window === "undefined"
          ? null
          : `${window.location.pathname}${window.location.search}`,
      sourceLabel: repositoryUrl,
      sourceMode: "github",
    });
    const requestBody = {
      branch: initialBranch.trim(),
      buildContextDir: buildContextDir.trim(),
      buildStrategy,
      dockerfilePath: dockerfilePath.trim(),
      name: name.trim(),
      projectId:
        selectedProjectId !== NEW_PROJECT_VALUE ? selectedProjectId : "",
      projectName:
        selectedProjectId === NEW_PROJECT_VALUE ? projectName.trim() : "",
      projectMode: selectedProjectId === NEW_PROJECT_VALUE ? "create" : "",
      repoAuthToken: repoAuthToken.trim(),
      repoUrl: repositoryUrl,
      repoVisibility,
      runtimeId,
      ...(networkMode === "background" ? { networkMode: "background" } : {}),
      ...(startupCommandSupported && startupCommand.trim()
        ? { startupCommand: startupCommand.trim() }
        : {}),
      sourceDir: sourceDir.trim(),
      templateSlug: inspection?.template?.slug ?? "",
      ...(serializedPersistentStorage
        ? { persistentStorage: serializedPersistentStorage }
        : {}),
      ...(persistentStorageSeedFiles.length > 0
        ? {
            persistentStorageSeedFiles: persistentStorageSeedFiles.map(
              (file) => ({
                path: file.path,
                seedContent: persistentStorageSeedValues[file.key] ?? "",
                service: file.service,
              }),
            ),
          }
        : {}),
      ...(Object.keys(envFeedback.env).length > 0
        ? { env: envFeedback.env }
        : {}),
      variables: variableValues,
    };

    void (async () => {
      try {
        const response = await fetch("/api/deploy/template", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        const payload = (await response
          .json()
          .catch(() => null)) as SubmitResponse | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Deploy request failed.");
        }

        resolvePendingProjectIntent(intent.id, {
          appId: payload?.app?.id ?? null,
          projectId:
            payload?.app?.projectId ??
            (selectedProjectId !== NEW_PROJECT_VALUE ? selectedProjectId : null),
          requestInProgress: Boolean(payload?.requestInProgress),
        });
      } catch (error) {
        failPendingProjectIntent(intent.id, readErrorMessage(error));
      }
    })();

    router.push(`/app?intent=${encodeURIComponent(intent.id)}`);
  }

  return (
    <form
      className="fg-console-dialog__form fg-deploy-form"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(() => {
          void submit().catch((error) => {
            showToast({
              message: readErrorMessage(error),
              variant: "error",
            });
          });
        });
      }}
    >
      <div className="fg-console-dialog__grid">
        {projectInventoryError ? (
          <InlineAlert variant="info">
            Project inventory is unavailable right now. You can still deploy
            into a new project.
          </InlineAlert>
        ) : null}

        <FormField
          hint="Reuse an existing project or create a new one for this deploy."
          htmlFor="deploy-project"
          label="Project"
        >
          <SelectField
            id="deploy-project"
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

        {selectedProjectId === NEW_PROJECT_VALUE ? (
          <FormField
            hint="This project will be created before the deploy is queued."
            htmlFor="deploy-project-name"
            label="Project name"
          >
            <input
              className="fg-input"
              id="deploy-project-name"
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Project 1"
              value={projectName}
            />
          </FormField>
        ) : null}

        {persistentStorageSeedFiles.length > 0 ? (
        <ConsoleDisclosureSection
          className="fg-console-dialog__advanced"
          defaultOpen
          description={persistentStorageSeedSummaryCopy ?? undefined}
          summary="Persistent files"
        >
            <div className="fg-console-dialog__advanced-grid">
              {persistentStorageSeedFiles.map((file) => {
                const fieldId = buildPersistentStorageSeedFieldId(file.key);

                return (
                  <FormField
                    hint={`Service ${file.service}. Leave blank to create an empty file on first deploy.`}
                    htmlFor={fieldId}
                    key={file.key}
                    label={file.path}
                    optionalLabel="Optional"
                  >
                    <textarea
                      autoCapitalize="off"
                      autoCorrect="off"
                      className="fg-input fg-deploy-seed-textarea"
                      id={fieldId}
                      onChange={(event) =>
                        updatePersistentStorageSeedValue(
                          file.key,
                          event.target.value,
                        )
                      }
                      placeholder="Leave blank to create an empty file."
                      spellCheck={false}
                      value={persistentStorageSeedValues[file.key] ?? ""}
                    />
                  </FormField>
                );
              })}
            </div>
        </ConsoleDisclosureSection>
      ) : null}

        {!persistentStorageSupported &&
        hasPersistentStorageDraft(persistentStorage) ? (
          <InlineAlert variant="info">
            Manual persistent storage mounts stay in this draft, but Fugue
            skips them while this deploy preserves a whole topology. Switch
            back to a single-app deploy to reuse them.
          </InlineAlert>
        ) : null}

        {persistentStorageSupported ? (
          <ConsoleDisclosureSection
            className="fg-console-dialog__advanced"
            description={persistentStorageSummaryCopy}
            summary="Persistent storage"
          >
            <PersistentStorageEditor
              idPrefix="deploy-persistent-storage"
              onChange={setPersistentStorage}
              surface="deploy"
              value={persistentStorage}
            />
          </ConsoleDisclosureSection>
        ) : null}

        <ConsoleDisclosureSection
          className="fg-console-dialog__advanced"
          description={deploymentSummaryCopy}
          summary="Access & deployment"
        >
          <GitHubRepositoryAccessFields
            githubConnectHref={githubConnectHref}
            githubConnection={githubConnection}
            githubConnectionError={githubConnectionError}
            githubConnectionLoading={githubConnectionLoading}
            onTokenChange={setRepoAuthToken}
            onVisibilityChange={setRepoVisibility}
            token={repoAuthToken}
            tokenFieldId="deploy-repo-auth-token"
            tokenRequired={repoVisibility === "private"}
            visibility={repoVisibility}
          />

          <DeploymentTargetField
            inventoryError={runtimeTargetInventoryError}
            name="deploy-runtime"
            onChange={setRuntimeId}
            targets={runtimeTargets}
            value={runtimeId}
          />

          <div className="fg-field-stack">
            <div className="fg-field-label">
              <span className="fg-field-label__main">
                <span className="fg-field-label__text">Network mode</span>
                <HintTooltip ariaLabel="Network mode">
                  {networkModeSupported
                    ? networkMode === "background"
                      ? "Background workers skip the managed route, Kubernetes Service, and readiness port."
                      : "Public services get a managed route and readiness checks."
                    : "Whole-topology imports keep per-service networking from fugue.yaml or docker-compose, so background worker mode is unavailable here."}
                </HintTooltip>
              </span>
            </div>
            <div className="fg-field-control">
              <SegmentedControl
                ariaLabel="Template deploy network mode"
                controlClassName="fg-console-nav"
                itemClassName="fg-console-nav__link"
                labelClassName="fg-console-nav__title"
                onChange={setNetworkMode}
                options={IMPORT_NETWORK_MODE_OPTIONS}
                value={networkModeSupported ? networkMode : "public"}
                variant="pill"
              />
            </div>
          </div>
        </ConsoleDisclosureSection>

        <ConsoleDisclosureSection
          className="fg-console-dialog__advanced"
          defaultOpen={!envFeedback.valid || Boolean(envRawDraft.trim())}
          description={environmentSummaryCopy}
          summary="Environment"
        >
          <EnvironmentEditor
            fieldId="deploy-env-raw"
            onChange={updateEnvRaw}
            onStatusChange={setEnvFeedback}
            surface="deploy"
            value={envRawDraft}
          />
        </ConsoleDisclosureSection>

        <ConsoleDisclosureSection
          className="fg-console-dialog__advanced"
          description={advancedSummaryCopy}
          summary="Advanced settings"
        >
          <div className="fg-console-dialog__advanced-grid">
            <FormField
              hint="Leave blank to reuse the repository name."
              htmlFor="deploy-name"
              label="App name"
              optionalLabel="Optional"
            >
              <input
                className="fg-input"
                id="deploy-name"
                onChange={(event) => setName(event.target.value)}
                placeholder={
                  inspection?.repository.defaultAppName ?? "marketing-site"
                }
                value={name}
              />
            </FormField>

            {startupCommandSupported ? (
              <FormField
                hint="Runs as `sh -lc <command>`. Leave blank to use the image default entrypoint."
                htmlFor="deploy-startup-command"
                label="Startup command"
                optionalLabel="Optional"
              >
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  className="fg-input"
                  id="deploy-startup-command"
                  onChange={(event) => setStartupCommand(event.target.value)}
                  placeholder="npm run serve"
                  spellCheck={false}
                  value={startupCommand}
                />
              </FormField>
            ) : null}

            {!hasFugueManifest ? (
              <FormField
                hint="Auto detect works for most repositories."
                htmlFor="deploy-build-strategy"
                label="Build strategy"
              >
                <SelectField
                  id="deploy-build-strategy"
                  onChange={(event) =>
                    setBuildStrategy(event.target.value as BuildStrategyValue)
                  }
                  value={buildStrategy}
                >
                  {BUILD_STRATEGY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </FormField>
            ) : null}

            {!hasFugueManifest && supportsSourceDir ? (
              <FormField
                hint="Use when the app lives below the repo root."
                htmlFor="deploy-source-dir"
                label="Source directory"
                optionalLabel="Optional"
              >
                <input
                  autoCapitalize="none"
                  className="fg-input"
                  id="deploy-source-dir"
                  onChange={(event) => setSourceDir(event.target.value)}
                  placeholder="apps/web"
                  spellCheck={false}
                  value={sourceDir}
                />
              </FormField>
            ) : null}

            {!hasFugueManifest && supportsDockerInputs ? (
              <FormField
                hint="Required when the Dockerfile is outside the repo root."
                htmlFor="deploy-dockerfile-path"
                label="Dockerfile path"
                optionalLabel="Optional"
              >
                <input
                  autoCapitalize="none"
                  className="fg-input"
                  id="deploy-dockerfile-path"
                  onChange={(event) => setDockerfilePath(event.target.value)}
                  placeholder="docker/Dockerfile"
                  spellCheck={false}
                  value={dockerfilePath}
                />
              </FormField>
            ) : null}

            {!hasFugueManifest && supportsDockerInputs ? (
              <FormField
                hint="Defaults to the repository root when omitted."
                htmlFor="deploy-build-context-dir"
                label="Build context"
                optionalLabel="Optional"
              >
                <input
                  autoCapitalize="none"
                  className="fg-input"
                  id="deploy-build-context-dir"
                  onChange={(event) => setBuildContextDir(event.target.value)}
                  placeholder="."
                  spellCheck={false}
                  value={buildContextDir}
                />
              </FormField>
            ) : null}
          </div>

          {hasFugueManifest ? (
            <InlineAlert
              variant={manifestSummary.warnings.length ? "warning" : "info"}
            >
              {manifestSummary.warnings.length
                ? `${pluralize(manifestSummary.warnings.length, "warning")} found in ${manifest?.manifestPath ?? "fugue.yaml"}. Review before deploying.`
                : `Imports ${pluralize(manifestSummary.serviceCount, "service")} from ${manifest?.manifestPath ?? "fugue.yaml"}. Primary service: ${manifest?.primaryService ?? "not declared"}.`}
            </InlineAlert>
          ) : null}
        </ConsoleDisclosureSection>

        {templateVariables.length > 0 ? (
          <ConsoleDisclosureSection
            className="fg-console-dialog__advanced"
            description={templateVariablesSummaryCopy ?? undefined}
            summary="Template variables"
          >
            <div className="fg-console-dialog__advanced-grid">
              {templateVariables.map((variable) => (
                <FormField
                  hint={
                    variable.description
                      ? `${variable.description}${variable.generate ? " Leave blank to auto-generate it." : variable.defaultValue ? " Leave blank to use the default." : ""}`
                      : variable.generate
                        ? "Leave blank to auto-generate this value when the deploy is queued."
                        : variable.defaultValue
                          ? "Leave blank to use the default value."
                          : "Enter the value that should exist before the first deploy."
                  }
                  htmlFor={`template-variable-${variable.key}`}
                  key={variable.key}
                  label={variable.label || variable.key}
                  optionalLabel={
                    variable.required &&
                    !variable.generate &&
                    !variable.defaultValue
                      ? undefined
                      : "Optional"
                  }
                >
                  <input
                    autoCapitalize="none"
                    autoComplete={variable.secret ? "new-password" : "off"}
                    className="fg-input"
                    id={`template-variable-${variable.key}`}
                    onChange={(event) =>
                      updateVariableValue(variable.key, event.target.value)
                    }
                    placeholder={
                      variable.generate
                        ? "Auto-generate on deploy"
                        : variable.defaultValue || "Enter value"
                    }
                    required={
                      variable.required &&
                      !variable.generate &&
                      !variable.defaultValue
                    }
                    spellCheck={false}
                    type={variable.secret ? "password" : "text"}
                    value={variableValues[variable.key] ?? ""}
                  />
                </FormField>
              ))}
            </div>
          </ConsoleDisclosureSection>
        ) : null}

        <div className="fg-console-dialog__actions fg-deploy-form__actions">
          <Button
            loading={isPending}
            loadingLabel="Queuing deploy"
            type="submit"
            variant="primary"
          >
            Queue deployment
          </Button>
        </div>
      </div>
    </form>
  );
}
