"use client";

import { useEffect, useState, startTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ConsoleDisclosureSection } from "@/components/console/console-disclosure-section";
import { DeploymentTargetField } from "@/components/console/deployment-target-field";
import { GitHubRepositoryAccessFields } from "@/components/console/github-repository-access-fields";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { SelectField } from "@/components/ui/select-field";
import { useToast } from "@/components/ui/toast";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import type { GitHubRepoVisibility } from "@/lib/github/repository";

type OnboardingStage = "needs-workspace" | "needs-import";
type FlashState = {
  message: string;
  variant: "error" | "info" | "success";
};

type BootstrapResponse = {
  workspace?: {
    defaultProjectName?: string | null;
  };
};

type ImportResponse = {
  app?: {
    id?: string;
  } | null;
  requestInProgress?: boolean;
};

const BUILD_STRATEGY_OPTIONS = [
  { label: "Auto detect", value: "auto" },
  { label: "Static site", value: "static-site" },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "Buildpacks", value: "buildpacks" },
  { label: "Nixpacks", value: "nixpacks" },
] as const;

type BuildStrategyValue = (typeof BUILD_STRATEGY_OPTIONS)[number]["value"];

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

async function requestJson<T>(
  input: RequestInfo,
  init?: RequestInit,
) {
  const response = await fetch(input, init);
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(data?.error || "Request failed.");
  }

  return data;
}

export function ConsoleOnboarding({
  defaultImportOpen = false,
  defaultProjectName = "default",
  initialStage,
  runtimeTargets = [],
  runtimeTargetInventoryError = null,
}: {
  defaultImportOpen?: boolean;
  defaultProjectName?: string;
  initialStage: OnboardingStage;
  runtimeTargets?: ConsoleImportRuntimeTargetView[];
  runtimeTargetInventoryError?: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [stage, setStage] = useState<OnboardingStage>(initialStage);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [importOpen, setImportOpen] = useState(
    initialStage === "needs-import" && defaultImportOpen,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoVisibility, setRepoVisibility] = useState<GitHubRepoVisibility>("public");
  const [repoAuthToken, setRepoAuthToken] = useState("");
  const [branch, setBranch] = useState("");
  const [name, setName] = useState("");
  const [buildStrategy, setBuildStrategy] = useState<BuildStrategyValue>("auto");
  const [sourceDir, setSourceDir] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("");
  const [buildContextDir, setBuildContextDir] = useState("");
  const [servicePort, setServicePort] = useState("");
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string | null>(
    () => readDefaultImportRuntimeId(runtimeTargets),
  );

  useEffect(() => {
    setStage(initialStage);
  }, [initialStage]);

  useEffect(() => {
    setProjectName(defaultProjectName);
  }, [defaultProjectName]);

  useEffect(() => {
    if (initialStage === "needs-import" && defaultImportOpen) {
      setImportOpen(true);
    }
  }, [defaultImportOpen, initialStage]);

  useEffect(() => {
    setSelectedRuntimeId((current) =>
      current && runtimeTargets.some((target) => target.id === current)
        ? current
        : readDefaultImportRuntimeId(runtimeTargets),
    );
  }, [runtimeTargets]);

  useEffect(() => {
    if (!flash) {
      return;
    }

    showToast({
      message: flash.message,
      variant: flash.variant,
    });
  }, [flash, showToast]);

  useEffect(() => {
    if (!importOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isImporting) {
        setFlash(null);
        setImportOpen(false);
        startTransition(() => {
          router.replace("/app");
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [importOpen, isImporting, router]);

  async function handleCreateWorkspace() {
    if (isCreating) {
      return;
    }

    setFlash(null);
    setIsCreating(true);

    try {
      const data = await requestJson<BootstrapResponse>(
        "/api/fugue/workspace/bootstrap",
        {
          method: "POST",
        },
      );

      if (data?.workspace?.defaultProjectName) {
        setProjectName(data.workspace.defaultProjectName);
      }

      resetImportForm();
      setStage("needs-import");
      setImportOpen(true);
      startTransition(() => {
        router.replace("/app?dialog=import");
        router.refresh();
      });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  function closeImport() {
    if (isImporting) {
      return;
    }

    setFlash(null);
    setImportOpen(false);
    startTransition(() => {
      router.replace("/app");
    });
  }

  function resetImportForm() {
    setRepoUrl("");
    setRepoVisibility("public");
    setRepoAuthToken("");
    setBranch("");
    setName("");
    setBuildStrategy("auto");
    setSourceDir("");
    setDockerfilePath("");
    setBuildContextDir("");
    setServicePort("");
    setSelectedRuntimeId(readDefaultImportRuntimeId(runtimeTargets));
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isImporting) {
      return;
    }

    const normalizedRepoUrl = repoUrl.trim();

    if (!normalizedRepoUrl) {
      setFlash({
        message: "Repository link is required.",
        variant: "error",
      });
      return;
    }

    const normalizedRepoAuthToken = repoAuthToken.trim();

    if (repoVisibility === "private" && !normalizedRepoAuthToken) {
      setFlash({
        message: "Private GitHub repositories require a GitHub token.",
        variant: "error",
      });
      return;
    }

    setFlash(null);
    setIsImporting(true);

    try {
      const normalizedBranch = branch.trim();
      const normalizedName = name.trim();
      const normalizedSourceDir = sourceDir.trim();
      const normalizedDockerfilePath = dockerfilePath.trim();
      const normalizedBuildContextDir = buildContextDir.trim();
      const normalizedServicePort = servicePort.trim();

      await requestJson<ImportResponse>("/api/fugue/apps/import-github", {
        body: JSON.stringify({
          ...(normalizedBranch ? { branch: normalizedBranch } : {}),
          buildStrategy,
          ...(normalizedName ? { name: normalizedName } : {}),
          ...(repoVisibility === "private" ? { repoAuthToken: normalizedRepoAuthToken } : {}),
          repoUrl: normalizedRepoUrl,
          repoVisibility,
          ...(normalizedSourceDir ? { sourceDir: normalizedSourceDir } : {}),
          ...(normalizedDockerfilePath ? { dockerfilePath: normalizedDockerfilePath } : {}),
          ...(normalizedBuildContextDir ? { buildContextDir: normalizedBuildContextDir } : {}),
          ...(normalizedServicePort ? { servicePort: normalizedServicePort } : {}),
          ...(selectedRuntimeId ? { runtimeId: selectedRuntimeId } : {}),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      setImportOpen(false);
      setFlash(null);
      startTransition(() => {
        router.replace("/app");
        router.refresh();
      });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsImporting(false);
    }
  }

  const isWorkspaceStage = stage === "needs-workspace";
  const title = isWorkspaceStage
    ? "Create the first project."
    : "Import the first repository.";
  const description = isWorkspaceStage
    ? `Set up the workspace and prepare ${projectName}.`
    : "Import the first repository to create the first app.";
  const primaryLabel = isWorkspaceStage ? "Create project" : "Import repository";
  const disclosureTitle = isWorkspaceStage ? "What happens next" : "Import rules";
  const disclosureItems = isWorkspaceStage
    ? [
        {
          label: "Admin key",
          value: "Stored for this workspace",
        },
        {
          label: "Project",
          value: projectName,
        },
        {
          label: "Next",
          value: "Import one GitHub repo",
        },
      ]
    : [
        {
          label: "Project",
          value: projectName,
        },
        {
          label: "Source",
          value: "GitHub repositories",
        },
        {
          label: "Access",
          value: "Public or private",
        },
        {
          label: "Credentials",
          value: "Private repos store a token for rebuilds and syncs",
        },
        {
          label: "Optional",
          value: "Branch, app name, build strategy",
        },
        {
          label: "Updates",
          value: "Later syncs reuse this branch and build strategy",
        },
      ];
  const eyebrow = "Console / first run";
  const supportsSourceDir =
    buildStrategy === "auto" ||
    buildStrategy === "static-site" ||
    buildStrategy === "buildpacks" ||
    buildStrategy === "nixpacks";
  const supportsDockerInputs =
    buildStrategy === "auto" || buildStrategy === "dockerfile";
  const openImport = () => {
    setFlash(null);
    resetImportForm();
    setImportOpen(true);
    startTransition(() => {
      router.replace("/app?dialog=import");
    });
  };

  return (
    <>
      <section className="fg-console-onboarding">
        <Panel className="fg-console-onboarding__panel">
          <PanelSection className="fg-console-onboarding__head">
            <p className="fg-label fg-panel__eyebrow">{eyebrow}</p>
            <PanelTitle>{title}</PanelTitle>
            <PanelCopy>{description}</PanelCopy>
          </PanelSection>

          <PanelSection className="fg-console-onboarding__body">
            <div className="fg-console-onboarding__actions">
              <Button
                loading={isCreating || isImporting}
                loadingLabel={
                  isWorkspaceStage
                    ? "Creating workspace…"
                    : "Importing repository…"
                }
                onClick={
                  isWorkspaceStage
                    ? handleCreateWorkspace
                    : openImport
                }
                type="button"
                variant="primary"
              >
                {primaryLabel}
              </Button>
            </div>

            <details className="fg-console-disclosure">
              <summary>{disclosureTitle}</summary>
              <dl className="fg-console-disclosure__list">
                {disclosureItems.map((item) => (
                  <div className="fg-console-disclosure__item" key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </PanelSection>
        </Panel>
      </section>

      {importOpen ? (
        <div
          aria-hidden={isImporting}
          className="fg-console-dialog-backdrop"
          onClick={closeImport}
        >
          <div
            aria-labelledby="fugue-import-title"
            aria-modal="true"
            className="fg-console-dialog-shell"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <Panel className="fg-console-dialog-panel">
              <PanelSection>
                <p className="fg-label fg-panel__eyebrow">Import / {projectName}</p>
                <PanelTitle className="fg-console-dialog__title" id="fugue-import-title">
                  Import repository
                </PanelTitle>
                <PanelCopy>
                  Paste a GitHub repository link and choose how Fugue should access it.
                </PanelCopy>
              </PanelSection>

              <PanelSection>
                <form className="fg-form-grid" onSubmit={handleImport}>
                  <div className="fg-console-dialog__grid">
                    <FormField
                      hint="Use https://github.com/owner/repo."
                      htmlFor="repo-url"
                      label="Repository link"
                    >
                      <input
                        autoComplete="url"
                        autoCapitalize="none"
                        className="fg-input"
                        id="repo-url"
                        inputMode="url"
                        name="repoUrl"
                        onChange={(event) => setRepoUrl(event.target.value)}
                        placeholder="https://github.com/owner/repo"
                        required
                        spellCheck={false}
                        type="url"
                        value={repoUrl}
                      />
                    </FormField>

                    <GitHubRepositoryAccessFields
                      onTokenChange={setRepoAuthToken}
                      onVisibilityChange={setRepoVisibility}
                      token={repoAuthToken}
                      tokenFieldId="repo-auth-token"
                      tokenRequired={repoVisibility === "private"}
                      visibility={repoVisibility}
                    />

                    <DeploymentTargetField
                      inventoryError={runtimeTargetInventoryError}
                      name="onboarding-runtime-target"
                      onChange={setSelectedRuntimeId}
                      targets={runtimeTargets}
                      value={selectedRuntimeId}
                    />

                    <ConsoleDisclosureSection
                      className="fg-console-dialog__advanced"
                      description="Branch, app name, build strategy, and optional source paths."
                      summary="Advanced settings"
                    >
                      <div className="fg-console-dialog__advanced-grid">
                        <FormField
                          hint="Leave blank to use the default branch."
                          htmlFor="repo-branch"
                          label="Branch"
                          optionalLabel="Optional"
                        >
                          <input
                            autoCapitalize="none"
                            autoComplete="off"
                            className="fg-input"
                            id="repo-branch"
                            name="branch"
                            onChange={(event) => setBranch(event.target.value)}
                            placeholder="main"
                            spellCheck={false}
                            value={branch}
                          />
                        </FormField>

                        <FormField
                          hint="Leave blank to reuse the repository name."
                          htmlFor="app-name"
                          label="App name"
                          optionalLabel="Optional"
                        >
                          <input
                            autoComplete="off"
                            className="fg-input"
                            id="app-name"
                            name="name"
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Marketing site"
                            value={name}
                          />
                        </FormField>

                        <FormField
                          hint="This build strategy is reused for later syncs."
                          htmlFor="build-strategy"
                          label="Build strategy"
                        >
                          <SelectField
                            autoComplete="off"
                            id="build-strategy"
                            name="buildStrategy"
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
                            htmlFor="import-source-dir"
                            label="Source directory"
                            optionalLabel="Optional"
                          >
                            <input
                              autoCapitalize="none"
                              autoComplete="off"
                              className="fg-input"
                              id="import-source-dir"
                              name="sourceDir"
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
                            htmlFor="import-dockerfile-path"
                            label="Dockerfile path"
                            optionalLabel="Optional"
                          >
                            <input
                              autoCapitalize="none"
                              autoComplete="off"
                              className="fg-input"
                              id="import-dockerfile-path"
                              name="dockerfilePath"
                              onChange={(event) => setDockerfilePath(event.target.value)}
                              placeholder="docker/Dockerfile"
                              spellCheck={false}
                              value={dockerfilePath}
                            />
                          </FormField>
                        ) : null}

                        {supportsDockerInputs ? (
                          <FormField
                            hint="Defaults to the repo root when omitted."
                            htmlFor="import-build-context-dir"
                            label="Build context"
                            optionalLabel="Optional"
                          >
                            <input
                              autoCapitalize="none"
                              autoComplete="off"
                              className="fg-input"
                              id="import-build-context-dir"
                              name="buildContextDir"
                              onChange={(event) => setBuildContextDir(event.target.value)}
                              placeholder="."
                              spellCheck={false}
                              value={buildContextDir}
                            />
                          </FormField>
                        ) : null}

                        <FormField
                          hint="Override the public HTTP port when the image does not expose it."
                          htmlFor="import-service-port"
                          label="Service port"
                          optionalLabel="Optional"
                        >
                          <input
                            autoComplete="off"
                            className="fg-input"
                            id="import-service-port"
                            inputMode="numeric"
                            name="servicePort"
                            onChange={(event) => setServicePort(event.target.value)}
                            placeholder="3333"
                            value={servicePort}
                          />
                        </FormField>
                      </div>
                    </ConsoleDisclosureSection>
                  </div>

                  <div className="fg-console-dialog__actions">
                    <Button onClick={closeImport} type="button" variant="secondary">
                      Cancel
                    </Button>
                    <Button loading={isImporting} loadingLabel="Importing repository…" type="submit" variant="primary">
                      Import repository
                    </Button>
                  </div>
                </form>
              </PanelSection>
            </Panel>
          </div>
        </div>
      ) : null}
    </>
  );
}
