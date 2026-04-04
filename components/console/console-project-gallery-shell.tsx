"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { CompactResourceMeter } from "@/components/console/compact-resource-meter";
import { ConsoleProjectBadge } from "@/components/console/console-project-badge";
import {
  ConsoleProjectWorkbench,
  warmConsoleAppEnvStates,
} from "@/components/console/console-project-gallery";
import { ConsoleProjectWorkbenchSkeleton } from "@/components/console/console-page-skeleton";
import { ImportServiceFields } from "@/components/console/import-service-fields";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { OPEN_CREATE_PROJECT_DIALOG_EVENT } from "@/lib/console/dialog-events";
import type {
  ConsoleProjectGallerySummaryData,
  ConsoleProjectSummaryView,
} from "@/lib/console/gallery-types";
import {
  useConsoleRuntimeTargetInventory,
} from "@/lib/console/runtime-target-inventory-client";
import {
  fetchConsoleProjectDetail,
  readCachedConsoleProjectDetail,
  warmConsoleProjectDetails,
} from "@/lib/console/project-detail-client";
import { buildProjectResourceUsageView } from "@/lib/console/project-resource-usage";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import {
  buildImportServicePayload,
  createImportServiceDraft,
  validateImportServiceDraft,
  type ImportServiceDraft,
} from "@/lib/fugue/import-source";
import { consumeSSEStream, type ParsedSSEEvent } from "@/lib/ui/sse";
import { cx } from "@/lib/ui/cx";
import {
  isAbortRequestError,
  readRequestError,
  requestJson,
} from "@/lib/ui/request-json";

type FlashState = {
  message: string;
  variant: "error" | "info" | "success";
};

type CreateProjectResponse = {
  app?: {
    id?: string;
  } | null;
  project?: {
    id?: string;
    name?: string;
  } | null;
  requestInProgress?: boolean;
};

type CreateDialogTarget = {
  id: string;
  name: string;
};

type ProjectImageUsageSummary = {
  projectId: string;
  reclaimableSizeBytes: number;
  totalSizeBytes: number;
  versionCount: number;
};

type ProjectImageUsageResponse = {
  projects?: ProjectImageUsageSummary[];
};

type GalleryStreamPayload = {
  hash?: string | null;
};

const PROJECT_IMAGE_USAGE_CACHE_TTL_MS = 60_000;

type CachedProjectImageUsage = {
  cachedAt: number;
  projects: ProjectImageUsageSummary[];
};

let cachedProjectImageUsage: CachedProjectImageUsage | null = null;

function prepareProjectWorkbench(projectId?: string | null) {
  if (!projectId) {
    return;
  }

  void warmConsoleProjectDetails([projectId]);
}

function buildSuggestedProjectName(existingProjectsCount: number) {
  return `Project ${Math.max(existingProjectsCount + 1, 1)}`;
}

function readCachedProjectImageUsage() {
  if (
    !cachedProjectImageUsage ||
    Date.now() - cachedProjectImageUsage.cachedAt >
      PROJECT_IMAGE_USAGE_CACHE_TTL_MS
  ) {
    cachedProjectImageUsage = null;
    return null;
  }

  return cachedProjectImageUsage.projects;
}

function writeCachedProjectImageUsage(projects: ProjectImageUsageSummary[]) {
  cachedProjectImageUsage = {
    cachedAt: Date.now(),
    projects,
  };
}

function buildProjectImageUsageMap(projects: ProjectImageUsageSummary[]) {
  return projects.reduce<Record<string, ProjectImageUsageSummary>>(
    (accumulator, project) => {
      if (project.projectId.trim()) {
        accumulator[project.projectId] = project;
      }

      return accumulator;
    },
    {},
  );
}

function projectTitle(project: ConsoleProjectSummaryView) {
  return `${project.appCount} app${project.appCount === 1 ? "" : "s"} · ${project.serviceCount} service${project.serviceCount === 1 ? "" : "s"}`;
}

function isDeletingProjectLifecycleLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.includes("deleting");
}

function applyOptimisticDeletingToProjectSummaries(
  projects: ConsoleProjectSummaryView[],
  deletingProjectIds: ReadonlySet<string>,
) {
  if (deletingProjectIds.size === 0) {
    return projects;
  }

  let didChange = false;
  const nextProjects = projects.map((project) => {
    if (
      !deletingProjectIds.has(project.id) ||
      isDeletingProjectLifecycleLabel(project.lifecycle.label)
    ) {
      return project;
    }

    didChange = true;
    return {
      ...project,
      lifecycle: {
        ...project.lifecycle,
        label: "Deleting",
        live: true,
        syncMode: "active",
        tone: "danger",
      },
    } satisfies ConsoleProjectSummaryView;
  });

  return didChange ? nextProjects : projects;
}

function pruneOptimisticDeletingProjectIds(
  current: Set<string>,
  projects: ConsoleProjectSummaryView[],
) {
  if (current.size === 0) {
    return current;
  }

  const next = new Set<string>();

  projects.forEach((project) => {
    if (
      current.has(project.id) &&
      !isDeletingProjectLifecycleLabel(project.lifecycle.label)
    ) {
      next.add(project.id);
    }
  });

  return next.size === current.size ? current : next;
}

function useOptimisticDeletingProjectSummaries(
  projects: ConsoleProjectSummaryView[],
) {
  const [optimisticDeletingProjectIds, setOptimisticDeletingProjectIds] =
    useState<Set<string>>(() => new Set());

  useEffect(() => {
    setOptimisticDeletingProjectIds((current) =>
      pruneOptimisticDeletingProjectIds(current, projects),
    );
  }, [projects]);

  const markProjectDeleting = useEffectEvent((projectId: string) => {
    const normalizedProjectId = projectId.trim();

    if (!normalizedProjectId) {
      return;
    }

    setOptimisticDeletingProjectIds((current) => {
      if (current.has(normalizedProjectId)) {
        return current;
      }

      const next = new Set(current);
      next.add(normalizedProjectId);
      return next;
    });
  });

  return {
    markProjectDeleting,
    optimisticProjects: applyOptimisticDeletingToProjectSummaries(
      projects,
      optimisticDeletingProjectIds,
    ),
  };
}

function clearCreateDialogUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (url.searchParams.get("dialog") !== "create") {
    return;
  }

  url.searchParams.delete("dialog");
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;

  window.history.replaceState(window.history.state, "", nextUrl);
}

function asRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseGalleryStreamPayload(event: ParsedSSEEvent) {
  try {
    return asRecord(JSON.parse(event.data)) as GalleryStreamPayload | null;
  } catch {
    return null;
  }
}

export function ConsoleProjectGallery({
  initialData,
  defaultCreateOpen = false,
}: {
  initialData: ConsoleProjectGallerySummaryData;
  defaultCreateOpen?: boolean;
}) {
  const { showToast } = useToast();
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [data, setData] = useState(initialData);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [selectedProjectDetailError, setSelectedProjectDetailError] =
    useState<string | null>(null);
  const [selectedProjectDetailRequestToken, setSelectedProjectDetailRequestToken] =
    useState(0);
  const [selectedProjectDetailStatus, setSelectedProjectDetailStatus] =
    useState<"error" | "idle" | "loading" | "ready">("idle");
  const [workbenchRefreshToken, setWorkbenchRefreshToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(defaultCreateOpen);
  const [createTargetProject, setCreateTargetProject] =
    useState<CreateDialogTarget | null>(null);
  const [projectName, setProjectName] = useState(
    buildSuggestedProjectName(initialData.projects.length),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportServiceDraft>(() =>
    createImportServiceDraft(null),
  );
  const [projectImageUsageByProjectId, setProjectImageUsageByProjectId] =
    useState<Record<string, ProjectImageUsageSummary>>(() =>
      buildProjectImageUsageMap(readCachedProjectImageUsage() ?? []),
    );
  const createBackdropPressStartedRef = useRef(false);
  const galleryRefreshAbortRef = useRef<AbortController | null>(null);
  const galleryRefreshPendingRef = useRef(false);
  const galleryStreamAbortRef = useRef<AbortController | null>(null);
  const selectedProjectIdRef = useRef<string | null>(selectedProjectId);
  const runtimeInventory = useConsoleRuntimeTargetInventory(createOpen);
  const projectPrefetchKey = data.projects
    .map((project) => project.id)
    .join("|");
  const { markProjectDeleting, optimisticProjects } =
    useOptimisticDeletingProjectSummaries(data.projects);

  const selectedProject =
    optimisticProjects.find((project) => project.id === selectedProjectId) ??
    null;
  const isCreateServiceMode = createTargetProject !== null;
  const createDialogEyebrow = isCreateServiceMode
    ? "Add service"
    : "Create project";
  const createDialogTitle = isCreateServiceMode ? "Add service" : "Create project";
  const createDialogCopy = isCreateServiceMode
    ? importDraft.sourceMode === "github"
      ? `Paste a GitHub repository link for ${createTargetProject.name}. Adjust access or placement only if this service needs it.`
      : `Add a published Docker image to ${createTargetProject.name}. Adjust placement only if this service needs it.`
    : "Give the project a name, then point Fugue at the first GitHub repository or Docker image.";
  const createDialogSubmitLabel = isCreating
    ? isCreateServiceMode
      ? "Adding…"
      : "Creating…"
    : isCreateServiceMode
      ? "Add service"
      : "Create project";
  const createDialogFormId = "fugue-create-project-form";
  const workspaceMissing = !data.workspace.exists;

  const refreshGallery = useEffectEvent(
    async (options?: { silent?: boolean; refreshWorkbench?: boolean }) => {
      if (galleryRefreshPendingRef.current) {
        return false;
      }

      galleryRefreshPendingRef.current = true;
      const controller = new AbortController();
      galleryRefreshAbortRef.current = controller;

      try {
        const nextData = await requestJson<ConsoleProjectGallerySummaryData>(
          "/api/fugue/console/gallery",
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (controller.signal.aborted) {
          return false;
        }

        startTransition(() => {
          setData(nextData);
        });

        if (options?.refreshWorkbench) {
          setWorkbenchRefreshToken((value) => value + 1);
        }

        return true;
      } catch (error) {
        if (
          !controller.signal.aborted &&
          !isAbortRequestError(error) &&
          !options?.silent
        ) {
          setFlash({
            message: readRequestError(error),
            variant: "error",
          });
        }

        return false;
      } finally {
        if (galleryRefreshAbortRef.current === controller) {
          galleryRefreshAbortRef.current = null;
        }

        galleryRefreshPendingRef.current = false;
      }
    },
  );

  const openCreateDialog = useEffectEvent(
    (target?: ConsoleProjectSummaryView | null) => {
      if (!data.workspace.exists) {
        return;
      }

      setFlash(null);
      setCreateTargetProject(
        target
          ? {
              id: target.id,
              name: target.name,
            }
          : null,
      );
      setProjectName(
        target?.name ?? buildSuggestedProjectName(data.projects.length),
      );
      setImportDraft((current) => ({
        ...createImportServiceDraft(
          readDefaultImportRuntimeId(runtimeInventory.runtimeTargets),
        ),
        sourceMode: current.sourceMode,
      }));
      setCreateOpen(true);
    },
  );

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
    if (!data.errors.length) {
      return;
    }

    showToast({
      message: `Partial Fugue data: ${data.errors.join(" | ")}.`,
      variant: data.errors.length >= 3 ? "error" : "info",
    });
  }, [data.errors, showToast]);

  useEffect(() => {
    startTransition(() => {
      setData(initialData);
    });
  }, [initialData]);

  useEffect(() => {
    if (
      selectedProjectId &&
      !data.projects.some((project) => project.id === selectedProjectId)
    ) {
      setSelectedProjectDetailError(null);
      setSelectedProjectDetailStatus("idle");
      setSelectedProjectId(null);
    }
  }, [data.projects, selectedProjectId]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  const loadSelectedProjectDetail = useEffectEvent(async (projectId: string) => {
    const cachedDetail = readCachedConsoleProjectDetail(projectId);

    if (cachedDetail?.project) {
      setSelectedProjectDetailError(null);
      setSelectedProjectDetailStatus("ready");
      return;
    }

    setSelectedProjectDetailError(null);
    setSelectedProjectDetailStatus("loading");

    try {
      const detail = await fetchConsoleProjectDetail(projectId);

      if (selectedProjectIdRef.current !== projectId) {
        return;
      }

      if (detail.project) {
        setSelectedProjectDetailStatus("ready");
        return;
      }

      setSelectedProjectDetailError("Project detail is not available yet.");
      setSelectedProjectDetailStatus("error");
    } catch (error) {
      if (
        selectedProjectIdRef.current !== projectId ||
        isAbortRequestError(error)
      ) {
        return;
      }

      setSelectedProjectDetailError(readRequestError(error));
      setSelectedProjectDetailStatus("error");
    }
  });

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProjectDetailError(null);
      setSelectedProjectDetailStatus("idle");
      return;
    }

    void loadSelectedProjectDetail(selectedProjectId);
  }, [
    loadSelectedProjectDetail,
    selectedProjectDetailRequestToken,
    selectedProjectId,
  ]);

  useEffect(() => {
    if (workspaceMissing || !data.projects.length) {
      return;
    }

    const controller = new AbortController();
    let animationFrameHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const warmProjectWorkbench = () => {
      animationFrameHandle = null;
      timeoutHandle = null;
      void (async () => {
        await warmConsoleProjectDetails(
          data.projects.map((project) => project.id),
          {
            concurrency: Math.min(3, data.projects.length),
            signal: controller.signal,
          },
        );

        if (controller.signal.aborted) {
          return;
        }

        const appIds = data.projects.flatMap((project) => {
          const cachedProjectDetail = readCachedConsoleProjectDetail(project.id);
          const detailProject = cachedProjectDetail?.project;

          if (!detailProject) {
            return [];
          }

          return detailProject.services.flatMap((service) =>
            service.kind === "app" ? [service.id] : [],
          );
        });

        if (!appIds.length) {
          return;
        }

        await warmConsoleAppEnvStates(appIds, {
          concurrency: 3,
          signal: controller.signal,
        });
      })();
    };

    if (typeof window.requestAnimationFrame === "function") {
      animationFrameHandle = window.requestAnimationFrame(warmProjectWorkbench);
    } else {
      timeoutHandle = window.setTimeout(warmProjectWorkbench, 0);
    }

    return () => {
      controller.abort();

      if (
        animationFrameHandle !== null &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(animationFrameHandle);
      }

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [projectPrefetchKey, workspaceMissing]);

  useEffect(() => {
    if (!createOpen && !isCreating) {
      setProjectName(buildSuggestedProjectName(data.projects.length));
    }
  }, [createOpen, data.projects.length, isCreating]);

  useEffect(() => {
    if (!runtimeInventory.runtimeTargets.length) {
      return;
    }

    setImportDraft((current) => ({
      ...current,
      runtimeId:
        current.runtimeId &&
        runtimeInventory.runtimeTargets.some(
          (target) => target.id === current.runtimeId,
        )
          ? current.runtimeId
          : readDefaultImportRuntimeId(runtimeInventory.runtimeTargets),
    }));
  }, [runtimeInventory.runtimeTargets]);

  useEffect(() => {
    const handleCreateProjectDialogOpen = () => {
      openCreateDialog(null);
    };

    window.addEventListener(
      OPEN_CREATE_PROJECT_DIALOG_EVENT,
      handleCreateProjectDialogOpen,
    );

    return () => {
      window.removeEventListener(
        OPEN_CREATE_PROJECT_DIALOG_EVENT,
        handleCreateProjectDialogOpen,
      );
    };
  }, [openCreateDialog]);

  useEffect(() => {
    if (!createOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [createOpen]);

  useEffect(() => {
    return () => {
      galleryRefreshAbortRef.current?.abort();
      galleryStreamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!data.projects.length) {
      setProjectImageUsageByProjectId({});
      return undefined;
    }

    const cachedProjects = readCachedProjectImageUsage();

    if (cachedProjects) {
      setProjectImageUsageByProjectId(buildProjectImageUsageMap(cachedProjects));
      return undefined;
    }

    let cancelled = false;

    requestJson<ProjectImageUsageResponse>("/api/fugue/projects/image-usage", {
      cache: "no-store",
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        const nextProjects = response.projects ?? [];
        writeCachedProjectImageUsage(nextProjects);
        setProjectImageUsageByProjectId(buildProjectImageUsageMap(nextProjects));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data.projects]);

  useEffect(() => {
    let cancelled = false;
    let retryDelayMs = 5000;
    let reconnectTimer: number | null = null;

    function clearReconnectTimer() {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    async function openStream() {
      clearReconnectTimer();
      galleryStreamAbortRef.current?.abort();
      const controller = new AbortController();
      galleryStreamAbortRef.current = controller;

      try {
        const response = await fetch("/api/fugue/console/gallery/stream", {
          cache: "no-store",
          headers: {
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(await response.text().catch(() => "Stream unavailable."));
        }

        await consumeSSEStream(response, {
          onRetry(milliseconds) {
            if (milliseconds > 0) {
              retryDelayMs = milliseconds;
            }
          },
          onEvent(event) {
            if (event.event !== "changed") {
              return;
            }

            const payload = parseGalleryStreamPayload(event);

            if (!payload?.hash) {
              return;
            }

            void refreshGallery({
              refreshWorkbench: Boolean(selectedProjectIdRef.current),
              silent: true,
            });
          },
        });
      } catch {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        clearReconnectTimer();
        reconnectTimer = window.setTimeout(() => {
          void openStream();
        }, retryDelayMs);
      }
    }

    void openStream();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      galleryStreamAbortRef.current?.abort();
      galleryStreamAbortRef.current = null;
    };
  }, [refreshGallery]);

  function resetCreateForm(nextProjectName: string) {
    setProjectName(nextProjectName);
    setImportDraft(
      createImportServiceDraft(
        readDefaultImportRuntimeId(runtimeInventory.runtimeTargets),
      ),
    );
  }

  function closeCreate() {
    if (isCreating) {
      return;
    }

    setFlash(null);
    setCreateTargetProject(null);
    setCreateOpen(false);
    clearCreateDialogUrl();
  }

  function handleCreateBackdropPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    createBackdropPressStartedRef.current =
      event.target === event.currentTarget;
  }

  function handleCreateBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    const shouldClose =
      createBackdropPressStartedRef.current &&
      event.target === event.currentTarget;

    createBackdropPressStartedRef.current = false;

    if (!shouldClose) {
      return;
    }

    closeCreate();
  }

  function chooseProject(project: ConsoleProjectSummaryView) {
    if (selectedProjectId === project.id) {
      setSelectedProjectDetailError(null);
      setSelectedProjectDetailStatus("idle");
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectDetailError(null);
    setSelectedProjectDetailStatus("idle");
    setSelectedProjectId(project.id);
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreating) {
      return;
    }

    const validationError = validateImportServiceDraft(importDraft);

    if (validationError) {
      setFlash({
        message: validationError,
        variant: "error",
      });
      return;
    }

    setFlash(null);
    setIsCreating(true);

    try {
      const response = await requestJson<CreateProjectResponse>(
        "/api/fugue/projects/create-and-import",
        {
          body: JSON.stringify({
            ...buildImportServicePayload(importDraft),
            ...(createTargetProject
              ? {
                  projectId: createTargetProject.id,
                }
              : {
                  projectName,
                }),
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      if (response.project?.id) {
        setSelectedProjectId(response.project.id);
      }

      setCreateOpen(false);
      setCreateTargetProject(null);
      setFlash({
        message: response.requestInProgress
          ? "Import is already running."
          : createTargetProject
            ? "Service import queued."
            : "Project import queued.",
        variant: "success",
      });
      resetCreateForm(buildSuggestedProjectName(data.projects.length + 1));
      clearCreateDialogUrl();
      void refreshGallery({
        refreshWorkbench: Boolean(response.project?.id),
        silent: true,
      });
    } catch (error) {
      setFlash({
        message: readRequestError(error),
        variant: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  function handleProjectDeleted(projectId: string) {
    setSelectedProjectId((current) => (current === projectId ? null : current));
    setWorkbenchRefreshToken((value) => value + 1);
    void refreshGallery({ silent: true });
  }

  function handleProjectMutation(
    options?: number | { optimisticDeletingProjectId?: string },
  ) {
    if (
      options &&
      typeof options === "object" &&
      options.optimisticDeletingProjectId
    ) {
      markProjectDeleting(options.optimisticDeletingProjectId);
    }

    setWorkbenchRefreshToken((value) => value + 1);
    void refreshGallery({ silent: true });
  }

  return (
    <>
      <div className="fg-project-gallery">
        <section
          className={cx(
            "fg-project-gallery__shelf",
            !optimisticProjects.length && "fg-project-gallery__shelf--empty",
          )}
        >
          {workspaceMissing ? (
            <div className="fg-project-gallery__empty-state">
              <Panel className="fg-console-dialog-panel">
                <PanelSection>
                  <p className="fg-label fg-panel__eyebrow">Workspace</p>
                  <PanelTitle>No workspace yet</PanelTitle>
                  <PanelCopy>
                    Create a workspace first, then return to the console to import
                    your first service.
                  </PanelCopy>
                </PanelSection>
              </Panel>
            </div>
          ) : optimisticProjects.length ? (
            <div className="fg-project-gallery__stack">
              {optimisticProjects.map((project) => {
                const expanded = selectedProjectId === project.id;
                const cachedProjectDetail = expanded
                  ? readCachedConsoleProjectDetail(project.id)
                  : null;
                const detailId = `project-detail-${project.id}`;
                const projectResourceUsage =
                  projectImageUsageByProjectId[project.id]
                    ? buildProjectResourceUsageView(
                        project.resourceUsageSnapshot,
                        projectImageUsageByProjectId[project.id],
                      )
                    : project.resourceUsage;

                return (
                  <article
                    className={cx(
                      "fg-project-card",
                      expanded && "is-active",
                      expanded && "is-expanded",
                    )}
                    key={project.id}
                  >
                    <button
                      aria-controls={detailId}
                      aria-expanded={expanded}
                      className="fg-project-card__summary"
                      onClick={() => chooseProject(project)}
                      onFocus={() => prepareProjectWorkbench(project.id)}
                      onPointerDown={() => prepareProjectWorkbench(project.id)}
                      onPointerEnter={() => prepareProjectWorkbench(project.id)}
                      type="button"
                    >
                      <div className="fg-project-card__summary-head">
                        <div className="fg-project-card__summary-copy">
                          <div className="fg-project-card__summary-meta">
                            <strong>{project.name}</strong>
                            <StatusBadge
                              live={project.lifecycle.live}
                              tone={project.lifecycle.tone}
                            >
                              {project.lifecycle.label}
                            </StatusBadge>
                          </div>
                          <div className="fg-project-card__summary-meta">
                            <span className="fg-project-card__summary-kicker">
                              {projectTitle(project)}
                            </span>

                            {project.serviceBadges.length ? (
                              <div
                                aria-hidden="true"
                                className="fg-project-card__badges fg-project-card__badges--inline"
                              >
                                {project.serviceBadges.map((badge) => (
                                  <ConsoleProjectBadge
                                    key={badge.id}
                                    kind={badge.kind}
                                    label={badge.label}
                                    meta={badge.meta}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="fg-project-card__summary-resources">
                          {projectResourceUsage.map((resource) => (
                            <CompactResourceMeter item={resource} key={resource.id} />
                          ))}
                        </div>

                        <div className="fg-project-card__summary-side">
                          <span
                            className="fg-project-card__summary-expand"
                            aria-hidden="true"
                          >
                            <svg viewBox="0 0 24 24">
                              <path
                                d="m7.2 9.4 4.8 5.2 4.8-5.2"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.7"
                              />
                            </svg>
                          </span>
                        </div>
                      </div>
                    </button>

                    {expanded ? (
                      cachedProjectDetail?.project ? (
                        <ConsoleProjectWorkbench
                          detailId={detailId}
                          onProjectDeleted={handleProjectDeleted}
                          onProjectMutation={handleProjectMutation}
                          onRequestCreateService={openCreateDialog}
                          projectCatalog={data.projects.map((item) => ({
                            id: item.id,
                            name: item.name,
                          }))}
                          project={project}
                          refreshToken={workbenchRefreshToken}
                        />
                      ) : selectedProjectDetailStatus === "error" ? (
                        <div className="fg-project-card__detail" id={detailId}>
                          <section className="fg-bezel fg-panel fg-project-workbench">
                            <div className="fg-bezel__inner fg-project-workbench__inner">
                              <div className="fg-workbench-section">
                                <p className="fg-console-note">
                                  {selectedProjectDetailError ??
                                    "Unable to load this project right now."}
                                </p>
                                <div className="fg-project-actions">
                                  <Button
                                    onClick={() => {
                                      setSelectedProjectDetailRequestToken(
                                        (value) => value + 1,
                                      );
                                    }}
                                    size="compact"
                                    type="button"
                                    variant="secondary"
                                  >
                                    Retry
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>
                      ) : (
                        <ConsoleProjectWorkbenchSkeleton detailId={detailId} />
                      )
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="fg-project-gallery__empty-state">
              <Button
                onClick={() => openCreateDialog(null)}
                type="button"
                variant="primary"
              >
                Create project
              </Button>
            </div>
          )}
        </section>
      </div>

      {createOpen ? (
        <div
          className="fg-console-dialog-backdrop"
          onClick={handleCreateBackdropClick}
          onPointerDown={handleCreateBackdropPointerDown}
        >
          <div
            aria-labelledby="fugue-create-project-title"
            aria-modal="true"
            className="fg-console-dialog-shell fg-project-dialog-shell"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <Panel className="fg-console-dialog-panel">
              <PanelSection>
                <p className="fg-label fg-panel__eyebrow">{createDialogEyebrow}</p>
                <PanelTitle
                  className="fg-console-dialog__title"
                  id="fugue-create-project-title"
                >
                  {createDialogTitle}
                </PanelTitle>
                <PanelCopy>{createDialogCopy}</PanelCopy>
              </PanelSection>

              <PanelSection className="fg-console-dialog__body">
                <form
                  className="fg-console-dialog__form"
                  id={createDialogFormId}
                  onSubmit={handleCreateProject}
                >
                  <div className="fg-console-dialog__grid">
                    {createTargetProject ? (
                      <FormField htmlFor="create-project-current" label="Project">
                        <input
                          className="fg-input"
                          id="create-project-current"
                          name="projectName"
                          readOnly
                          value={createTargetProject.name}
                        />
                      </FormField>
                    ) : (
                      <FormField
                        hint="Shown in the project list."
                        htmlFor="create-project-name"
                        label="Project name"
                      >
                        <input
                          className="fg-input"
                          id="create-project-name"
                          name="projectName"
                          onChange={(event) => setProjectName(event.target.value)}
                          placeholder="Project 1"
                          required
                          value={projectName}
                        />
                      </FormField>
                    )}

                    {runtimeInventory.loading ? (
                      <p className="fg-console-note">
                        Loading deployment targets…
                      </p>
                    ) : null}

                    <ImportServiceFields
                      draft={importDraft}
                      idPrefix="create-service"
                      includeWrapper={false}
                      inventoryError={runtimeInventory.runtimeTargetInventoryError}
                      onDraftChange={setImportDraft}
                      runtimeTargets={runtimeInventory.runtimeTargets}
                    />
                  </div>
                </form>
              </PanelSection>

              <PanelSection className="fg-console-dialog__footer">
                <div className="fg-console-dialog__actions">
                  <Button onClick={closeCreate} type="button" variant="secondary">
                    Cancel
                  </Button>
                  <Button
                    form={createDialogFormId}
                    loading={isCreating}
                    loadingLabel={createDialogSubmitLabel}
                    type="submit"
                    variant="primary"
                  >
                    {createDialogSubmitLabel}
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
