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
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import type { ConsoleImportRuntimeTargetView } from "@/lib/console/gallery-types";
import {
  buildRawEnvFeedback,
  type RawEnvFeedback,
} from "@/lib/console/raw-env";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import {
  buildImportServicePayload,
  createImportServiceDraft,
  validateImportServiceDraft,
  type ImportServiceDraft,
} from "@/lib/fugue/import-source";
import { useGitHubConnection } from "@/lib/github/connection-client";
import {
  buildLocalUploadFormData,
  createLocalUploadState,
  type LocalUploadState,
} from "@/lib/fugue/local-upload";
import { type TranslationValues } from "@/lib/i18n/core";

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

const DEFAULT_IMPORT_CAPABILITIES = {
  persistentStorageSupported: true,
  startupCommandSupported: true,
};

function readErrorMessage(
  error: unknown,
  t: (key: string, values?: TranslationValues) => string,
) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
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
  const { locale, t } = useI18n();
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
  const [localUpload, setLocalUpload] = useState<LocalUploadState>(() =>
    createLocalUploadState(),
  );
  const [importCapabilities, setImportCapabilities] = useState(
    DEFAULT_IMPORT_CAPABILITIES,
  );
  const [importEnvFeedback, setImportEnvFeedback] = useState<RawEnvFeedback>(
    () => buildRawEnvFeedback(draft.envRaw, "console", locale),
  );
  const {
    connectHref: githubConnectHref,
    connection: githubConnection,
    error: githubConnectionError,
    loading: githubConnectionLoading,
  } = useGitHubConnection({
    enabled: importOpen,
  });
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
    setImportEnvFeedback(buildRawEnvFeedback(draft.envRaw, "console", locale));
  }, [draft.envRaw, locale]);

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
        message: readErrorMessage(error, t),
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
    setLocalUpload(createLocalUploadState());
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isImporting) {
      return;
    }

    const validationError = validateImportServiceDraft(draft, {
      environmentFeedback: importEnvFeedback,
      localUpload,
      persistentStorageSupported:
        importCapabilities.persistentStorageSupported,
      privateGitHubAuthorized:
        githubConnectionLoading || Boolean(githubConnection?.connected),
      locale,
    });

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
      const endpoint =
        draft.sourceMode === "github"
          ? "/api/fugue/apps/import-github"
          : draft.sourceMode === "local-upload"
            ? "/api/fugue/apps/import-upload"
            : "/api/fugue/apps/import-image";
      const requestInit =
        draft.sourceMode === "local-upload"
          ? {
              body: buildLocalUploadFormData(
                buildImportServicePayload(draft, {
                  includePersistentStorage:
                    importCapabilities.persistentStorageSupported,
                  locale,
                }),
                localUpload,
              ),
              method: "POST",
            }
          : {
              body: JSON.stringify(
                buildImportServicePayload(draft, {
                  includePersistentStorage:
                    importCapabilities.persistentStorageSupported,
                  locale,
                }),
              ),
              headers: {
                "Content-Type": "application/json",
              },
              method: "POST",
            };

      await requestJson<ImportResponse>(endpoint, requestInit);

      setImportOpen(false);
      setFlash(null);
      replaceDialog(null);
      router.refresh();
    } catch (error) {
      setFlash({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setIsImporting(false);
    }
  }

  const isWorkspaceStage = stage === "needs-workspace";
  const title = isWorkspaceStage
    ? t("Create the first project.")
    : t("Import the first service.");
  const description = isWorkspaceStage
    ? t("Set up the workspace and prepare {projectName}.", { projectName })
    : t(
        "Import a GitHub repository, local folder, or Docker image to create the first app.",
      );
  const primaryLabel = isWorkspaceStage ? t("Create project") : t("Import service");
  const disclosureTitle = isWorkspaceStage ? t("What happens next") : t("Import rules");
  const disclosureItems = isWorkspaceStage
    ? [
        {
          label: t("Admin key"),
          value: t("Stored for this workspace"),
        },
        {
          label: t("Project"),
          value: projectName,
        },
        {
          label: t("Next"),
          value: t("Import one service"),
        },
      ]
    : [
        {
          label: t("Project"),
          value: projectName,
        },
        {
          label: t("Sources"),
          value: t("GitHub repositories, local uploads, or Docker images"),
        },
        {
          label: t("GitHub access"),
          value: t(
            "Public or private with GitHub authorization or a stored token",
          ),
        },
        {
          label: t("Docker images"),
          value: t("Public image refs are mirrored into Fugue before rollout"),
        },
        {
          label: t("Local uploads"),
          value: t(
            "Drag a folder, docker-compose.yml, fugue.yaml, Dockerfile, or source files into the browser",
          ),
        },
        {
          label: t("Optional"),
          value: t(
            "Branch, app name, build strategy, and optional source paths",
          ),
        },
        {
          label: t("Updates"),
          value: t(
            "Repository-backed services auto sync; image-backed services can repull the saved image ref",
          ),
        },
      ];
  const eyebrow = t("Console / first run");
  const importDialogCopy =
    draft.sourceMode === "github"
      ? t(
          "Paste a GitHub repository link and choose GitHub authorization or a token for private access.",
        )
      : draft.sourceMode === "local-upload"
        ? t(
            "Drop a local folder or source files. Fugue packages them on the server, then imports the result through the upload path.",
          )
        : t(
            "Point Fugue at a published Docker image. Fugue mirrors it into the internal registry before rollout.",
          );
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
                loadingLabel={
                  isWorkspaceStage
                    ? t("Creating workspace…")
                    : t("Importing service…")
                }
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
                <p className="fg-label fg-panel__eyebrow">
                  {t("Import / {projectName}", { projectName })}
                </p>
                <PanelTitle className="fg-console-dialog__title" id="fugue-import-title">
                  {t("Import service")}
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
                    githubConnectHref={githubConnectHref}
                    githubConnection={githubConnection}
                    githubConnectionError={githubConnectionError}
                    githubConnectionLoading={githubConnectionLoading}
                    idPrefix="onboarding-import"
                    inventoryError={runtimeTargetInventoryError}
                    localUpload={localUpload}
                    onCapabilitiesChange={setImportCapabilities}
                    onDraftChange={setDraft}
                    onEnvironmentStatusChange={setImportEnvFeedback}
                    onLocalUploadChange={setLocalUpload}
                    runtimeTargets={runtimeTargets}
                  />
                </form>
              </PanelSection>

              <PanelSection className="fg-console-dialog__footer">
                <div className="fg-console-dialog__actions">
                  <Button onClick={closeImport} type="button" variant="secondary">
                    {t("Cancel")}
                  </Button>
                  <Button
                    form="fugue-import-service-form"
                    loading={isImporting}
                    loadingLabel={t("Importing service…")}
                    type="submit"
                    variant="primary"
                  >
                    {t("Import service")}
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
