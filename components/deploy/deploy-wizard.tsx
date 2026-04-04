"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { GitHubRepositoryAccessFields } from "@/components/console/github-repository-access-fields";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import {
  humanizeDeployValue,
  pluralize,
  readInferenceTone,
  readManifestBindingTargets,
  summarizeInspectManifest,
} from "@/lib/deploy/topology-display";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import type {
  FugueGitHubTemplateInspection,
  FugueProject,
} from "@/lib/fugue/api";
import {
  BUILD_STRATEGY_OPTIONS,
  supportsGitHubDockerInputs,
  supportsGitHubSourceDir,
  type BuildStrategyValue,
} from "@/lib/fugue/import-source";
import { useGitHubConnection } from "@/lib/github/connection-client";
import { PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE } from "@/lib/github/messages";
import type { GitHubRepoVisibility } from "@/lib/github/repository";
import { isGitHubRepoUrl } from "@/lib/github/repository";

const NEW_PROJECT_VALUE = "__new__";

type DeployWizardProps = {
  initialBranch: string;
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
  } | null;
  error?: string;
  redirectTo?: string;
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

export function DeployWizard({
  initialBranch,
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
  const [branch, setBranch] = useState(initialBranch);
  const [name, setName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(
    readInitialProjectSelection(projects, workspaceDefaultProjectId),
  );
  const [projectName, setProjectName] = useState(
    workspaceDefaultProjectName ?? "default",
  );
  const [runtimeId, setRuntimeId] = useState<string | null>(
    resolveInitialRuntimeId(inspection, runtimeTargets),
  );
  const [buildStrategy, setBuildStrategy] =
    useState<BuildStrategyValue>("auto");
  const [sourceDir, setSourceDir] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("");
  const [buildContextDir, setBuildContextDir] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    readInitialVariableValues(inspection),
  );

  const manifest = inspection?.fugueManifest ?? null;
  const manifestSummary = summarizeInspectManifest(manifest);
  const visibleBindingServices = manifestSummary.servicesWithBindings.slice(
    0,
    4,
  );
  const visibleInferences = manifestSummary.inferenceReport.slice(0, 4);
  const hasFugueManifest = Boolean(manifest);
  const templateVariables = inspection?.template?.variables ?? [];
  const supportsSourceDir = supportsGitHubSourceDir(buildStrategy);
  const supportsDockerInputs = supportsGitHubDockerInputs(buildStrategy);
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
    setVariableValues(readInitialVariableValues(inspection));
  }, [inspection]);

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

    if (selectedProjectId === NEW_PROJECT_VALUE && !projectName.trim()) {
      return "Project name is required when creating a new project.";
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

  function updateVariableValue(key: string, value: string) {
    setVariableValues((current) => ({
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

    const response = await fetch("/api/deploy/template", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branch: branch.trim(),
        buildContextDir: buildContextDir.trim(),
        buildStrategy,
        dockerfilePath: dockerfilePath.trim(),
        name: name.trim(),
        projectId:
          selectedProjectId !== NEW_PROJECT_VALUE ? selectedProjectId : "",
        projectName:
          selectedProjectId === NEW_PROJECT_VALUE ? projectName.trim() : "",
        repoAuthToken: repoAuthToken.trim(),
        repoUrl: repositoryUrl,
        repoVisibility,
        runtimeId,
        sourceDir: sourceDir.trim(),
        templateSlug: inspection?.template?.slug ?? "",
        variables: variableValues,
      }),
    });

    const payload = (await response
      .json()
      .catch(() => null)) as SubmitResponse | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Deploy request failed.");
    }

    router.push(payload?.redirectTo ?? "/app");
    router.refresh();
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
        <PanelTitle>
          {inspection?.template?.name
            ? `Deploy ${inspection.template.name}`
            : hasFugueManifest
              ? "Deploy the fugue.yaml stack."
              : "Deploy this repository."}
        </PanelTitle>
        <PanelCopy>
          {hasFugueManifest
            ? "Fugue will import the topology declared in fugue.yaml and attach it to the selected project."
            : "Fugue will clone the repository, build it from the selected strategy, and queue the first deployment."}
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
              label="New project name"
            >
              <input
                className="fg-input"
                id="deploy-project-name"
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="default"
                value={projectName}
              />
            </FormField>
          ) : (
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
          )}
        </div>

        {selectedProjectId === NEW_PROJECT_VALUE ? (
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
        ) : null}

        <FormField
          hint="Leave blank to use the repository default branch."
          htmlFor="deploy-branch"
          label="Branch"
          optionalLabel="Optional"
        >
          <input
            autoCapitalize="none"
            className="fg-input"
            id="deploy-branch"
            onChange={(event) => setBranch(event.target.value)}
            placeholder={inspection?.repository.branch ?? "main"}
            spellCheck={false}
            value={branch}
          />
        </FormField>
      </PanelSection>

      <PanelSection>
        <PanelTitle>Access and target</PanelTitle>
        <PanelCopy>
          Choose how Fugue reads the repository, then pick where the first
          deployment should land.
        </PanelCopy>

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
      </PanelSection>

      {hasFugueManifest ? (
        <PanelSection>
          <PanelTitle>Topology</PanelTitle>
          <PanelCopy>
            This repository declares deployment topology in{" "}
            <code>{manifest?.manifestPath ?? "fugue.yaml"}</code>.
          </PanelCopy>

          <InlineAlert variant="info">
            Primary service:{" "}
            <strong>{manifest?.primaryService ?? "not declared"}</strong>. Fugue
            will import {pluralize(manifestSummary.serviceCount, "service")},
            including{" "}
            {pluralize(manifestSummary.backingServiceCount, "backing service")}{" "}
            and {pluralize(manifestSummary.bindingEdgeCount, "binding")}.
          </InlineAlert>

          {manifestSummary.warnings.length ? (
            <InlineAlert variant="warning">
              Review {pluralize(manifestSummary.warnings.length, "warning")}{" "}
              before importing the topology.
            </InlineAlert>
          ) : null}

          {manifestSummary.warnings.length ||
          visibleBindingServices.length ||
          visibleInferences.length ? (
            <div className="fg-deploy-topology-grid">
              {manifestSummary.warnings.length ? (
                <div className="fg-deploy-topology-card">
                  <span className="fg-label">Warnings</span>
                  <ul className="fg-deploy-note-list">
                    {manifestSummary.warnings.map((warning, index) => (
                      <li
                        className="fg-deploy-note-item"
                        key={`wizard-warning-${index}`}
                      >
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {visibleBindingServices.length ? (
                <div className="fg-deploy-topology-card">
                  <span className="fg-label">Bindings</span>
                  <ul className="fg-deploy-note-list">
                    {visibleBindingServices.map((service) => (
                      <li
                        className="fg-deploy-note-item"
                        key={`binding-${service.service}`}
                      >
                        <div className="fg-deploy-note-item__head">
                          <strong>{service.service}</strong>
                        </div>
                        <span>
                          {readManifestBindingTargets(service).join(", ")}
                        </span>
                      </li>
                    ))}
                    {manifestSummary.servicesWithBindings.length >
                    visibleBindingServices.length ? (
                      <li className="fg-deploy-note-item">
                        <span>
                          +
                          {manifestSummary.servicesWithBindings.length -
                            visibleBindingServices.length}{" "}
                          more services with bindings
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {visibleInferences.length ? (
                <div className="fg-deploy-topology-card">
                  <span className="fg-label">Inference report</span>
                  <ul className="fg-deploy-note-list">
                    {visibleInferences.map((item, index) => (
                      <li
                        className="fg-deploy-note-item"
                        key={`wizard-inference-${item.service}-${item.category}-${index}`}
                      >
                        <div className="fg-deploy-note-item__head">
                          <span
                            className={`fg-deploy-note-pill fg-deploy-note-pill--${readInferenceTone(item.level)}`}
                          >
                            {humanizeDeployValue(item.level)}
                          </span>
                          <strong>{humanizeDeployValue(item.service)}</strong>
                        </div>
                        <span>{item.message}</span>
                      </li>
                    ))}
                    {manifestSummary.inferenceReport.length >
                    visibleInferences.length ? (
                      <li className="fg-deploy-note-item">
                        <span>
                          +
                          {manifestSummary.inferenceReport.length -
                            visibleInferences.length}{" "}
                          more topology inferences
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </PanelSection>
      ) : (
        <PanelSection>
          <PanelTitle>Build inputs</PanelTitle>
          <PanelCopy>
            Adjust these only when the repository needs a non-default build
            context or a fixed Dockerfile path.
          </PanelCopy>

          <div className="fg-deploy-form-grid">
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

            {supportsSourceDir ? (
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

            {supportsDockerInputs ? (
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

            {supportsDockerInputs ? (
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
        </PanelSection>
      )}

      {templateVariables.length > 0 ? (
        <PanelSection>
          <PanelTitle>Template variables</PanelTitle>
          <PanelCopy>
            Fill the values that must exist before the first deployment.
            Generated secrets can be left blank.
          </PanelCopy>

          <div className="fg-deploy-variable-list">
            {templateVariables.map((variable) => (
              <div className="fg-deploy-variable-card" key={variable.key}>
                <div className="fg-deploy-variable-card__head">
                  <strong className="fg-ui-heading">
                    {variable.label || variable.key}
                  </strong>
                  <p className="fg-deploy-summary-copy">
                    {variable.description || "Used during first deploy."}
                  </p>
                  <div className="fg-deploy-variable-card__meta">
                    <span className="fg-deploy-variable-pill">
                      {variable.key}
                    </span>
                    {variable.required ? (
                      <span className="fg-deploy-variable-pill">Required</span>
                    ) : (
                      <span className="fg-deploy-variable-pill">Optional</span>
                    )}
                    {variable.secret ? (
                      <span className="fg-deploy-variable-pill">Secret</span>
                    ) : null}
                    {variable.generate ? (
                      <span className="fg-deploy-variable-pill">
                        Auto {variable.generate}
                      </span>
                    ) : null}
                  </div>
                </div>

                <FormField
                  hint={
                    variable.generate
                      ? "Leave blank to auto-generate this value when the deploy is queued."
                      : variable.defaultValue
                        ? "Change the default if this environment needs a different value."
                        : "Enter the value that should exist before the first deploy."
                  }
                  htmlFor={`template-variable-${variable.key}`}
                  label="Value"
                  optionalLabel={
                    variable.required && !variable.generate
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
              </div>
            ))}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection>
        <div className="fg-deploy-inline-actions">
          <Button
            loading={isPending}
            loadingLabel="Queuing deploy"
            type="submit"
            variant="route"
          >
            Queue deployment
          </Button>
        </div>
        <p className="fg-deploy-inline-copy">
          Fugue creates the project if needed, imports the repository, and then
          sends you back to the console.
        </p>
      </PanelSection>
    </form>
  );
}
