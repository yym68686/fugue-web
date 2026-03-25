"use client";

import { useEffect, useState, startTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";

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
}: {
  defaultImportOpen?: boolean;
  defaultProjectName?: string;
  initialStage: OnboardingStage;
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
  const [branch, setBranch] = useState("");
  const [name, setName] = useState("");
  const [buildStrategy, setBuildStrategy] = useState("auto");

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

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isImporting) {
      return;
    }

    if (!repoUrl.trim()) {
      setFlash({
        message: "Repository link is required.",
        variant: "error",
      });
      return;
    }

    setFlash(null);
    setIsImporting(true);

    try {
      await requestJson<ImportResponse>("/api/fugue/apps/import-github", {
        body: JSON.stringify({
          branch,
          buildStrategy,
          name,
          repoUrl,
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
    ? `Mint your workspace admin key and prepare the ${projectName} project.`
    : "Bring in one public GitHub repository to populate the console.";
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
          value: "Import one public GitHub repo",
        },
      ]
    : [
        {
          label: "Project",
          value: projectName,
        },
        {
          label: "Source",
          value: "Public GitHub only",
        },
        {
          label: "Optional",
          value: "Branch, app name, build strategy",
        },
      ];
  const eyebrow = "Console / first run";
  const openImport = () => {
    setFlash(null);
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
                    : "Importing project…"
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
                  Import repository.
                </PanelTitle>
                <PanelCopy>Public GitHub only.</PanelCopy>
              </PanelSection>

              <PanelSection>
                <form className="fg-form-grid" onSubmit={handleImport}>
                  <div className="fg-console-dialog__grid">
                    <FormField
                      hint="Only public GitHub repositories are supported right now."
                      htmlFor="repo-url"
                      label="Repository link"
                    >
                      <input
                        className="fg-input"
                        id="repo-url"
                        onChange={(event) => setRepoUrl(event.target.value)}
                        placeholder="https://github.com/owner/repo"
                        required
                        value={repoUrl}
                      />
                    </FormField>

                    <details className="fg-console-disclosure fg-console-dialog__advanced">
                      <summary>Advanced</summary>
                      <div className="fg-console-dialog__advanced-grid">
                        <FormField
                          hint="Leave blank to use the repository default branch."
                          htmlFor="repo-branch"
                          label="Branch"
                          optionalLabel="Optional"
                        >
                          <input
                            className="fg-input"
                            id="repo-branch"
                            onChange={(event) => setBranch(event.target.value)}
                            placeholder="main"
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
                            className="fg-input"
                            id="app-name"
                            onChange={(event) => setName(event.target.value)}
                            placeholder="marketing-site"
                            value={name}
                          />
                        </FormField>

                        <FormField
                          htmlFor="build-strategy"
                          label="Build strategy"
                        >
                          <select
                            className="fg-input"
                            id="build-strategy"
                            onChange={(event) => setBuildStrategy(event.target.value)}
                            value={buildStrategy}
                          >
                            {BUILD_STRATEGY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </FormField>
                      </div>
                    </details>
                  </div>

                  <div className="fg-console-dialog__actions">
                    <Button onClick={closeImport} type="button" variant="secondary">
                      Cancel
                    </Button>
                    <Button loading={isImporting} loadingLabel="Importing project…" type="submit" variant="primary">
                      Import project
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
