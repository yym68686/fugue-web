"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ConsoleDisclosureSection } from "@/components/console/console-disclosure-section";
import { ImportServiceFields } from "@/components/console/import-service-fields";
import {
  buildRawEnvFeedback,
  serializeEnvRecord,
  type RawEnvFeedback,
} from "@/lib/console/raw-env";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import {
  createPendingProjectIntent,
  failPendingProjectIntent,
  resolvePendingProjectIntent,
} from "@/lib/console/pending-project-intents";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import type {
  FugueGitHubTemplateInspection,
  FugueProject,
} from "@/lib/fugue/api";
import {
  buildImportServicePayload,
  createImportServiceDraft,
  validateImportServiceDraft,
  type ImportServiceDraft,
} from "@/lib/fugue/import-source";
import {
  buildLocalUploadFormData,
  createLocalUploadState,
  type LocalUploadState,
} from "@/lib/fugue/local-upload";
import { useGitHubConnection } from "@/lib/github/connection-client";
import {
  buildSuggestedProjectName,
  DUPLICATE_PROJECT_NAME_MESSAGE,
  findProjectByName,
} from "@/lib/project-names";
import type { DeploySearchState } from "@/lib/deploy/query";

type DeployCreateProjectFormProps = {
  currentPath: string;
  initialInspection?: FugueGitHubTemplateInspection | null;
  initialInspectionError?: string | null;
  projects: FugueProject[];
  requestedTemplateSlug?: string | null;
  routeMode: "repository" | "template";
  runtimeTargetInventoryError?: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  search: DeploySearchState;
};

type SubmitResponse = {
  app?: {
    id?: string;
    projectId?: string;
  } | null;
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

  return "Create project failed.";
}

function readInspectionRepositoryUrl(
  inspection?: FugueGitHubTemplateInspection | null,
) {
  const repoOwner = inspection?.repository.repoOwner?.trim() ?? "";
  const repoName = inspection?.repository.repoName?.trim() ?? "";

  return repoOwner && repoName
    ? `https://github.com/${repoOwner}/${repoName}`
    : "";
}

function readInitialDraft(
  routeMode: "repository" | "template",
  runtimeTargets: ConsoleImportRuntimeTargetView[],
  search: DeploySearchState,
  inspection?: FugueGitHubTemplateInspection | null,
) {
  const draft = createImportServiceDraft(
    readDefaultImportRuntimeId(runtimeTargets),
  );

  draft.branch = search.branch;
  draft.envRaw = serializeEnvRecord(search.env);
  draft.imageRef = search.imageRef;
  draft.name = search.appName;
  draft.repoUrl =
    search.repositoryUrl || readInspectionRepositoryUrl(inspection);
  draft.repoVisibility = search.repoVisibility;
  draft.servicePort = search.servicePort;
  draft.sourceMode =
    routeMode === "template"
      ? "github"
      : search.sourceMode === "local-upload"
        ? "local-upload"
        : search.sourceMode === "docker-image"
          ? "docker-image"
          : "github";

  return draft;
}

function readInitialVariableValues(
  inspection?: FugueGitHubTemplateInspection | null,
) {
  return Object.fromEntries(
    (inspection?.template?.variables ?? []).map((variable) => [
      variable.key,
      variable.defaultValue,
    ]),
  ) as Record<string, string>;
}

export function DeployCreateProjectForm({
  currentPath,
  initialInspection = null,
  initialInspectionError = null,
  projects,
  requestedTemplateSlug = null,
  routeMode,
  runtimeTargetInventoryError = null,
  runtimeTargets,
  search,
}: DeployCreateProjectFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const {
    connectHref: githubConnectHref,
    connection: githubConnection,
    error: githubConnectionError,
    loading: githubConnectionLoading,
  } = useGitHubConnection();
  const [projectName, setProjectName] = useState(() =>
    buildSuggestedProjectName(projects),
  );
  const [importDraft, setImportDraft] = useState<ImportServiceDraft>(() =>
    readInitialDraft(routeMode, runtimeTargets, search, initialInspection),
  );
  const [localUpload, setLocalUpload] = useState<LocalUploadState>(() =>
    createLocalUploadState(),
  );
  const [importCapabilities, setImportCapabilities] = useState({
    persistentStorageSupported: true,
    startupCommandSupported: true,
  });
  const [importEnvFeedback, setImportEnvFeedback] = useState<RawEnvFeedback>(
    () => buildRawEnvFeedback(importDraft.envRaw, "console"),
  );
  const [githubInspection, setGitHubInspection] =
    useState<FugueGitHubTemplateInspection | null>(initialInspection);
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    () => readInitialVariableValues(initialInspection),
  );
  const templateVariables = githubInspection?.template?.variables ?? [];

  useEffect(() => {
    setImportEnvFeedback(buildRawEnvFeedback(importDraft.envRaw, "console"));
  }, [importDraft.envRaw]);

  useEffect(() => {
    setImportDraft((current) => ({
      ...current,
      runtimeId:
        current.runtimeId &&
        runtimeTargets.some((target) => target.id === current.runtimeId)
          ? current.runtimeId
          : readDefaultImportRuntimeId(runtimeTargets),
    }));
  }, [runtimeTargets]);

  useEffect(() => {
    setVariableValues((current) => {
      const next = Object.fromEntries(
        templateVariables.map((variable) => [
          variable.key,
          current[variable.key] ?? variable.defaultValue,
        ]),
      ) as Record<string, string>;

      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);

      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }

      return next;
    });
  }, [templateVariables]);

  function updateVariableValue(key: string, value: string) {
    setVariableValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validate() {
    const normalizedProjectName = projectName.trim();

    if (!normalizedProjectName) {
      return "Project name is required when creating a new project.";
    }

    if (findProjectByName(projects, normalizedProjectName)) {
      return DUPLICATE_PROJECT_NAME_MESSAGE;
    }

    const validationError = validateImportServiceDraft(importDraft, {
      environmentFeedback: importEnvFeedback,
      localUpload,
      persistentStorageSupported:
        importCapabilities.persistentStorageSupported,
      privateGitHubAuthorized:
        githubConnectionLoading || Boolean(githubConnection?.connected),
    });

    if (validationError) {
      return validationError;
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

    return null;
  }

  async function submit() {
    const validationError = validate();

    if (validationError) {
      throw new Error(validationError);
    }

    const normalizedProjectName = projectName.trim();
    const payload = {
      ...buildImportServicePayload(importDraft, {
        includePersistentStorage: importCapabilities.persistentStorageSupported,
      }),
      projectMode: "create",
      projectName: normalizedProjectName,
      ...(templateVariables.length > 0 ? { variables: variableValues } : {}),
      ...(requestedTemplateSlug ? { templateSlug: requestedTemplateSlug } : {}),
    };
    const intent = createPendingProjectIntent({
      appName: importDraft.name.trim(),
      projectName: normalizedProjectName,
      retryHref:
        typeof window === "undefined"
          ? currentPath
          : `${window.location.pathname}${window.location.search}`,
      sourceLabel:
        importDraft.sourceMode === "github"
          ? importDraft.repoUrl
          : importDraft.sourceMode === "docker-image"
            ? importDraft.imageRef
            : "Local source",
      sourceMode: importDraft.sourceMode,
    });

    void (async () => {
      try {
        const response =
          importDraft.sourceMode === "local-upload"
            ? await fetch("/api/fugue/projects/create-and-import-upload", {
                body: buildLocalUploadFormData(payload, localUpload),
                method: "POST",
              })
            : await fetch(
                importDraft.sourceMode === "github"
                  ? "/api/deploy/template"
                  : "/api/fugue/projects/create-and-import",
                {
                  body: JSON.stringify(payload),
                  headers: {
                    "Content-Type": "application/json",
                  },
                  method: "POST",
                },
              );

        const responseBody = (await response
          .json()
          .catch(() => null)) as SubmitResponse | null;

        if (!response.ok) {
          throw new Error(responseBody?.error ?? "Create project failed.");
        }

        resolvePendingProjectIntent(intent.id, {
          appId: responseBody?.app?.id ?? null,
          projectId:
            responseBody?.project?.id ?? responseBody?.app?.projectId ?? null,
          requestInProgress: Boolean(responseBody?.requestInProgress),
        });
      } catch (error) {
        failPendingProjectIntent(intent.id, readErrorMessage(error));
      }
    })();

    router.push(`/app?intent=${encodeURIComponent(intent.id)}`);
  }

  return (
    <form
      className="fg-console-dialog__form fg-project-create-dialog__form fg-deploy-form"
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
      <div className="fg-console-dialog__grid fg-project-create-dialog__grid">
        <FormField
          hint="Shown in the project list."
          htmlFor="deploy-project-name"
          label="Project name"
        >
          <input
            className="fg-input"
            id="deploy-project-name"
            name="projectName"
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Project 1"
            required
            value={projectName}
          />
        </FormField>

        <ImportServiceFields
          draft={importDraft}
          githubConnectHref={githubConnectHref}
          githubConnection={githubConnection}
          githubConnectionError={githubConnectionError}
          githubConnectionLoading={githubConnectionLoading}
          idPrefix="deploy-create-project"
          includeWrapper={false}
          initialGitHubInspection={initialInspection}
          initialGitHubInspectionError={initialInspectionError}
          inventoryError={runtimeTargetInventoryError}
          localUpload={localUpload}
          onCapabilitiesChange={setImportCapabilities}
          onDraftChange={setImportDraft}
          onEnvironmentStatusChange={setImportEnvFeedback}
          onGitHubInspectionChange={(inspection) => {
            setGitHubInspection(inspection);
          }}
          onLocalUploadChange={setLocalUpload}
          runtimeTargets={runtimeTargets}
          showBranchField={false}
          showDockerServicePort
          showRepositoryHint={false}
          showSourceModeSwitch={routeMode !== "template"}
        />

        {importDraft.sourceMode === "github" && templateVariables.length > 0 ? (
          <ConsoleDisclosureSection
            className="fg-console-dialog__advanced"
            description={`${templateVariables.length} variable${templateVariables.length === 1 ? "" : "s"} before first deploy`}
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
                  htmlFor={`deploy-template-variable-${variable.key}`}
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
                    id={`deploy-template-variable-${variable.key}`}
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
      </div>

      <div className="fg-console-dialog__actions fg-deploy-form__actions">
        <Button
          loading={isPending}
          loadingLabel="Creating…"
          type="submit"
          variant="primary"
        >
          Create project
        </Button>
      </div>
    </form>
  );
}
