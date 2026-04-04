"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createPendingProjectIntent,
  failPendingProjectIntent,
  resolvePendingProjectIntent,
} from "@/lib/console/pending-project-intents";
import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { LocalUploadSourceField } from "@/components/console/local-upload-source-field";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import type { FugueProject } from "@/lib/fugue/api";
import {
  BUILD_STRATEGY_OPTIONS,
  buildImportServicePayload,
  createImportServiceDraft,
  localUploadPreservesDetectedTopology,
  supportsGitHubDockerInputs,
  supportsGitHubSourceDir,
  validateImportServiceDraft,
  type BuildStrategyValue,
} from "@/lib/fugue/import-source";
import {
  buildLocalUploadFormData,
  createLocalUploadState,
  inspectLocalUploadState,
  type LocalUploadState,
} from "@/lib/fugue/local-upload";
import {
  DUPLICATE_PROJECT_NAME_MESSAGE,
  findProjectByName,
} from "@/lib/project-names";

const NEW_PROJECT_VALUE = "__new__";

type DeployUploadWizardProps = {
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

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Deploy request failed.";
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

export function DeployUploadWizard({
  projectInventoryError = null,
  projects,
  runtimeTargetInventoryError = null,
  runtimeTargets,
  workspaceDefaultProjectId = null,
  workspaceDefaultProjectName = null,
}: DeployUploadWizardProps) {
  const router = useRouter();
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
      ),
    [projects, workspaceDefaultProjectId, workspaceDefaultProjectName],
  );

  useEffect(() => {
    setRuntimeId((current) =>
      current && runtimeTargets.some((target) => target.id === current)
        ? current
        : readDefaultImportRuntimeId(runtimeTargets),
    );
  }, [runtimeTargets]);

  function buildDraft() {
    return {
      ...createImportServiceDraft(runtimeId),
      buildContextDir,
      buildStrategy,
      dockerfilePath,
      name,
      runtimeId,
      sourceDir,
      sourceMode: "local-upload" as const,
    };
  }

  const uploadDraft = buildDraft();
  const localUploadKeepsTopologyImport =
    localUploadPreservesDetectedTopology(uploadDraft);

  function validate() {
    if (selectedProjectId === NEW_PROJECT_VALUE) {
      const normalizedProjectName = projectName.trim();

      if (!normalizedProjectName) {
        return "Project name is required when creating a new project.";
      }

      if (findProjectByName(projects, normalizedProjectName)) {
        return DUPLICATE_PROJECT_NAME_MESSAGE;
      }
    }

    return validateImportServiceDraft(uploadDraft, {
      localUpload,
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
          "Project");
    const intent = createPendingProjectIntent({
      appName: name.trim(),
      projectId:
        selectedProjectId !== NEW_PROJECT_VALUE ? selectedProjectId : null,
      projectName: normalizedProjectName,
      retryHref:
        typeof window === "undefined"
          ? null
          : `${window.location.pathname}${window.location.search}`,
      sourceLabel: "Local source",
      sourceMode: "local-upload",
    });
    const requestBody = buildLocalUploadFormData(
      {
        ...buildImportServicePayload(uploadDraft),
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
        failPendingProjectIntent(intent.id, readErrorMessage(error));
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
              message: readErrorMessage(error),
              variant: "error",
            });
          });
        });
      }}
    >
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">Deploy</p>
        <PanelTitle>Deploy from a local source.</PanelTitle>
        <PanelCopy>
          Drag a local folder, <code>docker-compose.yml</code>,{" "}
          <code>fugue.yaml</code>, <code>Dockerfile</code>, or multiple source
          files. Fugue packages the upload on the server, then imports the
          detected topology when present.
        </PanelCopy>

        {projectInventoryError ? (
          <InlineAlert variant="info">
            Project inventory is unavailable right now. You can still deploy
            into a new project.
          </InlineAlert>
        ) : null}

        <div className="fg-deploy-form-grid">
          <FormField
            hint="Reuse an existing project or create a new one for this deploy."
            htmlFor="deploy-upload-project"
            label="Project"
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
            hint="Leave blank to reuse the uploaded folder or primary service name."
            htmlFor="deploy-upload-name"
            label="App name"
            optionalLabel="Optional"
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
            hint="This project will be created before the deploy is queued."
            htmlFor="deploy-upload-project-name"
            label="New project name"
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
          hint="The browser keeps files local until you submit the deploy."
          htmlFor="deploy-upload-upload-folder"
          label="Local source"
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
              ? "Whole-topology import is ready. Leave build strategy on Auto detect and keep manual path overrides blank to import every service from fugue.yaml or docker-compose."
              : "Manual build overrides are active. Clear build strategy and path overrides if you want Fugue to import every service from fugue.yaml or docker-compose."}
          </InlineAlert>
        ) : null}
      </PanelSection>

      <PanelSection>
        <PanelTitle>Target and build</PanelTitle>
        <PanelCopy>
          Choose where the upload should land. Only add manual build settings
          when the upload is meant to deploy as a single app instead of a full
          manifest or compose topology.
        </PanelCopy>

        <DeploymentTargetField
          inventoryError={runtimeTargetInventoryError}
          name="deploy-upload-runtime"
          onChange={setRuntimeId}
          targets={runtimeTargets}
          value={runtimeId}
        />

        <div className="fg-deploy-form-grid">
          <FormField
            hint="Auto detect keeps compose and fugue manifest imports intact."
            htmlFor="deploy-upload-build-strategy"
            label="Build strategy"
          >
            <SelectField
              id="deploy-upload-build-strategy"
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

          {supportsSourceDir ? (
            <FormField
              hint="Use when the app lives below the uploaded root."
              htmlFor="deploy-upload-source-dir"
              label="Source directory"
              optionalLabel="Optional"
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
              hint="Required when the Dockerfile is outside the uploaded root."
              htmlFor="deploy-upload-dockerfile-path"
              label="Dockerfile path"
              optionalLabel="Optional"
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
              hint="Defaults to the uploaded root when omitted."
              htmlFor="deploy-upload-build-context-dir"
              label="Build context"
              optionalLabel="Optional"
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
        <div className="fg-deploy-inline-actions">
          <Button
            loading={isPending}
            loadingLabel="Uploading deploy"
            type="submit"
            variant="route"
          >
            Upload and deploy
          </Button>
        </div>
        <p className="fg-deploy-inline-copy">
          Fugue creates the project if needed, packages the selected files, and
          then sends you back to the console.
        </p>
      </PanelSection>
    </form>
  );
}
