"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ImportServiceFields } from "@/components/console/import-service-fields";
import { Button } from "@/components/ui/button";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import {
  buildImportServicePayload,
  createImportServiceDraft,
  validateImportServiceDraft,
  type ImportServiceDraft,
} from "@/lib/fugue/import-source";

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

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [stage, setStage] = useState<OnboardingStage>(initialStage);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [importOpen, setImportOpen] = useState(
    initialStage === "needs-import" && defaultImportOpen,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [draft, setDraft] = useState<ImportServiceDraft>(() =>
    createImportServiceDraft(readDefaultImportRuntimeId(runtimeTargets)),
  );
  const importBackdropPressStartedRef = useRef(false);
  const importDialogRequested = searchParams.get("dialog") === "import";

  function replaceDialog(nextDialog: string | null) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextDialog) {
      nextParams.set("dialog", nextDialog);
    } else {
      nextParams.delete("dialog");
    }

    const nextSearch = nextParams.toString();
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname);
  }

  function handleImportBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    importBackdropPressStartedRef.current = event.target === event.currentTarget;
  }

  function handleImportBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    const shouldClose =
      importBackdropPressStartedRef.current && event.target === event.currentTarget;

    importBackdropPressStartedRef.current = false;

    if (!shouldClose) {
      return;
    }

    closeImport();
  }

  useEffect(() => {
    setStage(initialStage);
  }, [initialStage]);

  useEffect(() => {
    setProjectName(defaultProjectName);
  }, [defaultProjectName]);

  useEffect(() => {
    if (initialStage === "needs-import" && importDialogRequested) {
      setImportOpen(true);
      return;
    }

    setImportOpen(false);
  }, [importDialogRequested, initialStage]);

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      runtimeId:
        current.runtimeId && runtimeTargets.some((target) => target.id === current.runtimeId)
          ? current.runtimeId
          : readDefaultImportRuntimeId(runtimeTargets),
    }));
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
        replaceDialog(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [importOpen, isImporting]);

  async function handleCreateWorkspace() {
    if (isCreating) {
      return;
    }

    setFlash(null);
    setIsCreating(true);

    try {
      const data = await requestJson<BootstrapResponse>("/api/fugue/workspace/bootstrap", {
        method: "POST",
      });

      if (data?.workspace?.defaultProjectName) {
        setProjectName(data.workspace.defaultProjectName);
      }

      resetImportForm();
      setStage("needs-import");
      setImportOpen(true);
      replaceDialog("import");
      router.refresh();
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
    replaceDialog(null);
  }

  function resetImportForm() {
    setDraft(createImportServiceDraft(readDefaultImportRuntimeId(runtimeTargets)));
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isImporting) {
      return;
    }

    const validationError = validateImportServiceDraft(draft);

    if (validationError) {
      setFlash({
        message: validationError,
        variant: "error",
      });
      return;
    }

    setFlash(null);
    setIsImporting(true);

    try {
      await requestJson<ImportResponse>(
        draft.sourceMode === "github"
          ? "/api/fugue/apps/import-github"
          : "/api/fugue/apps/import-image",
        {
          body: JSON.stringify(buildImportServicePayload(draft)),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      setImportOpen(false);
      setFlash(null);
      replaceDialog(null);
      router.refresh();
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
    : "Import the first service.";
  const description = isWorkspaceStage
    ? `Set up the workspace and prepare ${projectName}.`
    : "Import a GitHub repository or Docker image to create the first app.";
  const primaryLabel = isWorkspaceStage ? "Create project" : "Import service";
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
          value: "Import one service",
        },
      ]
    : [
        {
          label: "Project",
          value: projectName,
        },
        {
          label: "Sources",
          value: "GitHub repositories or Docker images",
        },
        {
          label: "GitHub access",
          value: "Public or private with an optional stored token",
        },
        {
          label: "Docker images",
          value: "Public image refs are mirrored into Fugue before rollout",
        },
        {
          label: "Optional",
          value: "Branch, app name, build strategy, service port",
        },
        {
          label: "Updates",
          value: "Repository-backed services auto sync; image-backed services can repull the saved image ref",
        },
      ];
  const eyebrow = "Console / first run";
  const importDialogCopy =
    draft.sourceMode === "github"
      ? "Paste a GitHub repository link and choose how Fugue should access it."
      : "Point Fugue at a published Docker image. Fugue mirrors it into the internal registry before rollout.";
  const openImport = () => {
    setFlash(null);
    resetImportForm();
    setImportOpen(true);
    replaceDialog("import");
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
                loadingLabel={isWorkspaceStage ? "Creating workspace…" : "Importing service…"}
                onClick={isWorkspaceStage ? handleCreateWorkspace : openImport}
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
          onClick={handleImportBackdropClick}
          onPointerDown={handleImportBackdropPointerDown}
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
                  Import service
                </PanelTitle>
                <PanelCopy>{importDialogCopy}</PanelCopy>
              </PanelSection>

              <PanelSection className="fg-console-dialog__body">
                <form
                  className="fg-console-dialog__form"
                  id="fugue-import-service-form"
                  onSubmit={handleImport}
                >
                  <ImportServiceFields
                    draft={draft}
                    idPrefix="onboarding-import"
                    inventoryError={runtimeTargetInventoryError}
                    onDraftChange={setDraft}
                    runtimeTargets={runtimeTargets}
                  />
                </form>
              </PanelSection>

              <PanelSection className="fg-console-dialog__footer">
                <div className="fg-console-dialog__actions">
                  <Button onClick={closeImport} type="button" variant="secondary">
                    Cancel
                  </Button>
                  <Button
                    form="fugue-import-service-form"
                    loading={isImporting}
                    loadingLabel="Importing service…"
                    type="submit"
                    variant="primary"
                  >
                    Import service
                  </Button>
                </div>
              </PanelSection>
            </Panel>
          </div>
        </div>
      ) : null}
    </>
  );
}
