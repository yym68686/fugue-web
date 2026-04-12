"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { CompactResourceMeter } from "@/components/console/compact-resource-meter";
import { ConsoleProjectBadge } from "@/components/console/console-project-badge";
import {
  ConsoleProjectWorkbench,
  warmConsoleAppEnvStates,
} from "@/components/console/console-project-gallery";
import { ConsoleProjectWorkbenchSkeleton } from "@/components/console/console-page-skeleton";
import { ImportServiceFields } from "@/components/console/import-service-fields";
import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { HintInline } from "@/components/ui/hint-tooltip";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { OPEN_CREATE_PROJECT_DIALOG_EVENT } from "@/lib/console/dialog-events";
import {
  buildRawEnvFeedback,
  type RawEnvFeedback,
} from "@/lib/console/raw-env";
import type {
  ConsoleProjectGallerySummaryData,
  ConsoleProjectSummaryView,
} from "@/lib/console/gallery-types";
import type { ConsoleTone } from "@/lib/console/types";
import {
  clearPendingProjectIntent,
  createPendingProjectIntent,
  failPendingProjectIntent,
  resolvePendingProjectIntent,
  usePendingProjectIntent,
  type PendingProjectIntent,
} from "@/lib/console/pending-project-intents";
import {
  useConsoleRuntimeTargetInventory,
} from "@/lib/console/runtime-target-inventory-client";
import {
  fetchConsoleProjectDetail,
  invalidateConsoleProjectDetails,
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
import { useGitHubConnection } from "@/lib/github/connection-client";
import {
  buildLocalUploadFormData,
  createLocalUploadState,
  type LocalUploadState,
} from "@/lib/fugue/local-upload";
import {
  buildSuggestedProjectName,
  findProjectByName,
} from "@/lib/project-names";
import { consumeSSEStream, type ParsedSSEEvent } from "@/lib/ui/sse";
import { cx } from "@/lib/ui/cx";
import {
  isAbortRequestError,
} from "@/lib/ui/request-json";

type FlashState = {
  message: string;
  variant: "error" | "info" | "success";
};

type CreateProjectResponse = {
  app?: {
    id?: string;
    projectId?: string;
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

type PendingProjectProgressStep = {
  copy: string;
  label: string;
  live?: boolean;
  status: string;
  tone: ConsoleTone;
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

type Translator = (
  key: string,
  values?: Record<string, number | string>,
) => string;

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

function projectTitle(project: ConsoleProjectSummaryView, t: Translator) {
  const appLabel = t(
    project.appCount === 1 ? "{count} app" : "{count} apps",
    {
      count: project.appCount,
    },
  );
  const serviceLabel = t(
    project.serviceCount === 1 ? "{count} service" : "{count} services",
    {
      count: project.serviceCount,
    },
  );
  return `${appLabel} · ${serviceLabel}`;
}

function isDeletingProjectLifecycleLabel(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.includes("deleting");
}

function shouldKeepOptimisticDeletingProject(
  project: ConsoleProjectSummaryView,
  expectedServiceCount: number,
) {
  return (
    !isDeletingProjectLifecycleLabel(project.lifecycle.label) &&
    project.serviceCount >= expectedServiceCount
  );
}

function applyOptimisticDeletingToProjectSummaries(
  projects: ConsoleProjectSummaryView[],
  deletingProjects: ReadonlyMap<string, number>,
) {
  if (deletingProjects.size === 0) {
    return projects;
  }

  let didChange = false;
  const nextProjects = projects.map((project) => {
    const expectedServiceCount = deletingProjects.get(project.id);

    if (
      expectedServiceCount === undefined ||
      !shouldKeepOptimisticDeletingProject(project, expectedServiceCount)
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
  current: Map<string, number>,
  projects: ConsoleProjectSummaryView[],
) {
  if (current.size === 0) {
    return current;
  }

  const next = new Map<string, number>();

  projects.forEach((project) => {
    const expectedServiceCount = current.get(project.id);

    if (
      expectedServiceCount !== undefined &&
      shouldKeepOptimisticDeletingProject(project, expectedServiceCount)
    ) {
      next.set(project.id, expectedServiceCount);
    }
  });

  if (next.size !== current.size) {
    return next;
  }

  for (const [projectId, expectedServiceCount] of current) {
    if (next.get(projectId) !== expectedServiceCount) {
      return next;
    }
  }

  return current;
}

function useOptimisticDeletingProjectSummaries(
  projects: ConsoleProjectSummaryView[],
) {
  const [optimisticDeletingProjects, setOptimisticDeletingProjects] = useState<
    Map<string, number>
  >(() => new Map());

  useEffect(() => {
    setOptimisticDeletingProjects((current) =>
      pruneOptimisticDeletingProjectIds(current, projects),
    );
  }, [projects]);

  const markProjectDeleting = useEffectEvent(
    (projectId: string, serviceCount: number) => {
      const normalizedProjectId = projectId.trim();
      const normalizedServiceCount = Math.max(0, serviceCount);

      if (!normalizedProjectId || normalizedServiceCount === 0) {
        return;
      }

      setOptimisticDeletingProjects((current) => {
        if (current.get(normalizedProjectId) === normalizedServiceCount) {
          return current;
        }

        const next = new Map(current);
        next.set(normalizedProjectId, normalizedServiceCount);
        return next;
      });
    },
  );

  return {
    markProjectDeleting,
    optimisticProjects: applyOptimisticDeletingToProjectSummaries(
      projects,
      optimisticDeletingProjects,
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

function clearPendingProjectIntentUrl(intentId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  const currentIntentId = url.searchParams.get("intent");

  if (!currentIntentId) {
    return;
  }

  if (intentId && currentIntentId !== intentId) {
    return;
  }

  url.searchParams.delete("intent");
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;

  window.history.replaceState(window.history.state, "", nextUrl);
}

function resolveCreateProjectId(
  response: CreateProjectResponse,
  fallbackProjectId?: string | null,
) {
  return (
    response.project?.id?.trim() ||
    response.app?.projectId?.trim() ||
    fallbackProjectId?.trim() ||
    null
  );
}

function readErrorMessage(error: unknown, t: Translator) {
  if (isAbortRequestError(error)) {
    return t("Request canceled.");
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return t("Request failed.");
}

async function readResponseError(response: Response, t: Translator) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return t("Request failed with status {status}.", { status: response.status });
  }

  try {
    const payload = JSON.parse(trimmed) as { error?: unknown };

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Fall back to the raw response body when the payload is not JSON.
  }

  return trimmed;
}

async function requestJsonLocalized<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  t: Translator,
) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readResponseError(response, t));
  }

  return (await response.json().catch(() => ({}))) as T;
}

function readPendingProjectIntentStatus(
  intent: PendingProjectIntent,
  t: Translator,
) {
  if (intent.status === "error") {
    return {
      eyebrow: t("Queue failed"),
      label: t("Retry needed"),
      live: false,
      tone: "danger" as const,
    };
  }

  if (intent.projectId) {
    return {
      eyebrow: intent.requestInProgress
        ? t("Import running")
        : t("Build queued"),
      label: intent.requestInProgress ? t("Syncing") : t("Queued"),
      live: intent.requestInProgress,
      tone: "info" as const,
    };
  }

  return {
    eyebrow: t("Creating project"),
    label: t("Working"),
    live: true,
    tone: "info" as const,
  };
}

function readPendingProjectIntentSourceSummary(
  intent: PendingProjectIntent,
  t: Translator,
) {
  switch (intent.sourceMode) {
    case "docker-image":
      return t("Docker image");
    case "local-upload":
      return t("Local upload");
    case "github":
    default:
      return t("GitHub import");
  }
}

function readPendingProjectIntentSourceDetail(
  intent: PendingProjectIntent,
  t: Translator,
) {
  const sourceLabel = intent.sourceLabel?.trim();

  switch (intent.sourceMode) {
    case "docker-image":
      return sourceLabel || t("Published image reference");
    case "local-upload":
      if (
        !sourceLabel ||
        /^local source$/i.test(sourceLabel) ||
        /^local upload$/i.test(sourceLabel)
      ) {
        return t("Source files uploaded from this browser");
      }

      return sourceLabel;
    case "github":
    default:
      return sourceLabel || t("Repository import");
  }
}

function readPendingProjectIntentSummary(
  intent: PendingProjectIntent,
  t: Translator,
) {
  if (intent.status === "error") {
    return t("The first service did not queue.");
  }

  if (intent.projectId) {
    return t(
      "Project created. The live workbench will replace this shell automatically.",
    );
  }

  switch (intent.sourceMode) {
    case "docker-image":
      return t("Mirroring the image and preparing the first rollout.");
    case "local-upload":
      return t("Packaging uploaded files for the first build.");
    case "github":
    default:
      return t("Preparing the first repository build.");
  }
}

function readPendingProjectIntentTitle(
  intent: PendingProjectIntent,
  t: Translator,
) {
  if (intent.status === "error") {
    return t("Couldn't queue the first service");
  }

  if (intent.projectId) {
    return intent.requestInProgress
      ? t("First service is syncing into the console")
      : t("First service is queued");
  }

  switch (intent.sourceMode) {
    case "docker-image":
      return t("Preparing the first rollout");
    case "local-upload":
      return t("Packaging the first build");
    case "github":
    default:
      return t("Preparing the first repository build");
  }
}

function readPendingProjectIntentDetailCopy(
  intent: PendingProjectIntent,
  t: Translator,
) {
  if (intent.status === "error") {
    return (
      intent.errorMessage ??
      t("The request stopped before build logs and route controls could attach.")
    );
  }

  if (intent.projectId) {
    return t(
      "Keep this page open. Fugue will swap this shell for the live workbench as soon as the app record is visible.",
    );
  }

  switch (intent.sourceMode) {
    case "docker-image":
      return t(
        "Fugue is creating the project, mirroring the image internally, and staging the first rollout.",
      );
    case "local-upload":
      return t(
        "Fugue is creating the project and packaging the uploaded files on the server before the first build starts.",
      );
    case "github":
    default:
      return t(
        "Fugue is creating the project and preparing the repository import before build logs can attach.",
      );
  }
}

function readPendingProjectIntentSteps(
  intent: PendingProjectIntent,
  t: Translator,
): PendingProjectProgressStep[] {
  const intakeLabel =
    intent.sourceMode === "docker-image"
      ? t("Prepare image rollout")
      : intent.sourceMode === "local-upload"
        ? t("Package uploaded source")
        : t("Prepare repository build");
  const intakeCopy =
    intent.sourceMode === "docker-image"
      ? t("Mirror the published image internally and stage the first rollout.")
      : intent.sourceMode === "local-upload"
        ? t("Archive the uploaded files and stage the first build on the server.")
        : t("Inspect the repository and prepare the build plan for the first service.");

  if (intent.projectId) {
    return [
      {
        copy: t("The project exists and the first service slot is reserved."),
        label: t("Project created"),
        status: t("Done"),
        tone: "positive",
      },
      {
        copy: intakeCopy,
        label: intakeLabel,
        live: intent.requestInProgress,
        status: intent.requestInProgress ? t("Running") : t("Queued"),
        tone: "info",
      },
      {
        copy:
          t(
            "Build logs, route controls, and environment panels replace this shell automatically.",
          ),
        label: t("Attach live workbench"),
        status: t("Waiting"),
        tone: "neutral",
      },
    ];
  }

  return [
    {
      copy: t("Reserve the project and the first service slot."),
      label: t("Create project"),
      live: true,
      status: t("Working"),
      tone: "info",
    },
    {
      copy: intakeCopy,
      label: intakeLabel,
      status: t("Waiting"),
      tone: "neutral",
    },
    {
      copy: t("The live workbench appears as soon as the app record becomes visible."),
      label: t("Attach live workbench"),
      status: t("Waiting"),
      tone: "neutral",
    },
  ];
}

function PendingProjectCard({
  expanded,
  intent,
  onOpen,
}: {
  expanded: boolean;
  intent: PendingProjectIntent;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const status = readPendingProjectIntentStatus(intent, t);
  const detailId = `project-detail-pending-${intent.id}`;
  const facts = [
    {
      label: t("Project"),
      value: intent.projectName,
    },
    {
      label: t("Source"),
      value: readPendingProjectIntentSourceDetail(intent, t),
    },
    {
      label: t("App name"),
      value: intent.appName?.trim() || t("Auto-detect after import"),
    },
    {
      label: t("Handoff"),
      value:
        intent.status === "error"
          ? t("Return to the create flow and retry the import")
          : t(
              "The live workbench replaces this shell when logs and route controls are ready",
            ),
    },
  ];
  const progressSteps =
    intent.status === "error" ? [] : readPendingProjectIntentSteps(intent, t);

  return (
    <article
      className={cx(
        "fg-project-card",
        "fg-project-card--pending",
        expanded && "is-active",
        expanded && "is-expanded",
      )}
    >
      <button
        aria-controls={detailId}
        aria-expanded={expanded}
        className="fg-project-card__summary"
        onClick={onOpen}
        type="button"
      >
        <div className="fg-project-card__summary-head">
          <div className="fg-project-card__summary-copy">
            <div className="fg-project-card__summary-meta">
              <strong>{intent.projectName}</strong>
              <StatusBadge live={status.live} tone={status.tone}>
                {status.label}
              </StatusBadge>
            </div>

            <div className="fg-project-card__summary-meta">
              <span className="fg-project-card__summary-kicker">
                {readPendingProjectIntentSummary(intent, t)}
              </span>
            </div>
          </div>

          <div className="fg-project-card__summary-resources fg-project-card__summary-resources--pending">
              <span className="fg-project-pending-summary">
              {readPendingProjectIntentSourceSummary(intent, t)}
            </span>
          </div>

          <div className="fg-project-card__summary-side">
            <span className="fg-project-card__summary-expand" aria-hidden="true">
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
        <div className="fg-project-card__detail" id={detailId}>
          <section className="fg-bezel fg-panel fg-project-workbench fg-project-workbench--pending-shell">
            <div className="fg-bezel__inner fg-project-pending-shell-panel">
              <PanelSection className="fg-project-pending-shell__hero">
                <div className="fg-project-pending-shell__status-row">
                  <p className="fg-label fg-panel__eyebrow">{status.eyebrow}</p>
                  <StatusBadge live={status.live} tone={status.tone}>
                    {status.label}
                  </StatusBadge>
                </div>

                <div className="fg-project-pending-shell__hero-row">
                  <div className="fg-project-pending-shell__hero-copy">
                    <p className="fg-label">
                      {readPendingProjectIntentSourceSummary(intent, t)}
                    </p>
                    <h3 className="fg-project-pending-shell__title fg-ui-heading">
                      {readPendingProjectIntentTitle(intent, t)}
                    </h3>
                    <p className="fg-project-pending-shell__copy">
                      {readPendingProjectIntentDetailCopy(intent, t)}
                    </p>
                  </div>

                  {intent.status === "error" && intent.retryHref ? (
                    <div className="fg-project-pending-shell__hero-actions">
                      <ButtonAnchor href={intent.retryHref} variant="secondary">
                        {t("Open retry flow")}
                      </ButtonAnchor>
                    </div>
                  ) : null}
                </div>
              </PanelSection>

              {progressSteps.length ? (
                <PanelSection className="fg-project-pending-shell__progress">
                  <div className="fg-project-pending-shell__progress-copy">
                    <HintInline
                      ariaLabel={t("Next steps")}
                      hint={t(
                        "This shell disappears automatically once the live workbench is ready.",
                      )}
                    >
                      <p className="fg-label fg-panel__eyebrow">{t("Next steps")}</p>
                    </HintInline>
                  </div>

                  <ol className="fg-console-checklist fg-project-pending-checklist">
                    {progressSteps.map((step) => (
                      <li className="fg-console-checklist__item" key={step.label}>
                        <span className="fg-console-checklist__state">
                          <StatusBadge
                            className="fg-project-pending-checklist__badge"
                            live={step.live}
                            tone={step.tone}
                          >
                            {step.status}
                          </StatusBadge>
                        </span>

                        <div className="fg-project-pending-checklist__copy">
                          <strong>{step.label}</strong>
                          <p>{step.copy}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </PanelSection>
              ) : null}

              <PanelSection className="fg-project-pending-shell__details">
                <details className="fg-console-disclosure fg-console-disclosure--section">
                  <summary>
                    <span className="fg-console-disclosure__summary-copy">
                      <HintInline
                        ariaLabel={t("Build details")}
                        as="span"
                        className="fg-console-disclosure__summary-label-row"
                        hint={t(
                          "Project name, source reference, app naming, and handoff behavior",
                        )}
                      >
                        <span className="fg-console-disclosure__summary-label">
                          {t("Build details")}
                        </span>
                      </HintInline>
                    </span>
                    <span className="fg-console-disclosure__summary-icon" aria-hidden="true">
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
                  </summary>

                  <div className="fg-console-disclosure__panel">
                    <dl className="fg-console-disclosure__list">
                      {facts.map((fact) => (
                        <div className="fg-console-disclosure__item" key={fact.label}>
                          <dt>{fact.label}</dt>
                          <dd>{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </details>
              </PanelSection>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
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
  initialPendingIntentId = null,
}: {
  initialData: ConsoleProjectGallerySummaryData;
  defaultCreateOpen?: boolean;
  initialPendingIntentId?: string | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [data, setData] = useState(initialData);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [requestedProjectId, setRequestedProjectId] = useState<string | null>(
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
  const [activePendingIntentId, setActivePendingIntentId] = useState<string | null>(
    initialPendingIntentId,
  );
  const [pendingIntentFocused, setPendingIntentFocused] = useState(
    Boolean(initialPendingIntentId),
  );
  const [createTargetProject, setCreateTargetProject] =
    useState<CreateDialogTarget | null>(null);
  const [projectName, setProjectName] = useState(
    buildSuggestedProjectName(initialData.projects),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportServiceDraft>(() =>
    createImportServiceDraft(null),
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
  const {
    connectHref: githubConnectHref,
    connection: githubConnection,
    error: githubConnectionError,
    loading: githubConnectionLoading,
  } = useGitHubConnection({
    enabled: createOpen,
  });
  const [projectImageUsageByProjectId, setProjectImageUsageByProjectId] =
    useState<Record<string, ProjectImageUsageSummary>>(() =>
      buildProjectImageUsageMap(readCachedProjectImageUsage() ?? []),
    );

  useEffect(() => {
    setImportEnvFeedback(buildRawEnvFeedback(importDraft.envRaw, "console"));
  }, [importDraft.envRaw]);
  const pendingIntent = usePendingProjectIntent(activePendingIntentId);
  const galleryRefreshAbortRef = useRef<AbortController | null>(null);
  const galleryRefreshPendingRef = useRef(false);
  const galleryStreamAbortRef = useRef<AbortController | null>(null);
  const selectedProjectIdRef = useRef<string | null>(selectedProjectId);
  const announcedPendingIntentErrorRef = useRef<string | null>(null);
  const runtimeInventory = useConsoleRuntimeTargetInventory(createOpen);
  const projectPrefetchKey = data.projects
    .map((project) => project.id)
    .join("|");
  const { markProjectDeleting, optimisticProjects } =
    useOptimisticDeletingProjectSummaries(data.projects);
  const pendingProjectVisible = Boolean(
    pendingIntent &&
      (!pendingIntent.projectId ||
        !optimisticProjects.some((project) => project.id === pendingIntent.projectId)),
  );

  const selectedProject =
    optimisticProjects.find((project) => project.id === selectedProjectId) ??
    null;
  const isCreateServiceMode = createTargetProject !== null;
  const createDialogEyebrow = isCreateServiceMode
    ? t("Add service")
    : t("Create project");
  const createDialogTitle = isCreateServiceMode
    ? t("Add service")
    : t("Create project");
  const createDialogCopy = isCreateServiceMode
    ? importDraft.sourceMode === "github"
      ? t(
          "Paste a GitHub repository link for {projectName}. Adjust access or placement only if this service needs it.",
          {
            projectName: createTargetProject.name,
          },
        )
      : importDraft.sourceMode === "local-upload"
        ? t(
            "Drop a local folder, archive, or source files for {projectName}. Fugue packages file uploads on the server before import.",
            {
              projectName: createTargetProject.name,
            },
          )
        : t(
            "Add a published Docker image to {projectName}. Adjust placement only if this service needs it.",
            {
              projectName: createTargetProject.name,
            },
          )
    : t(
        "Give the project a name, then point Fugue at the first GitHub repository, local folder, or Docker image.",
      );
  const createDialogSubmitLabel = isCreating
    ? isCreateServiceMode
      ? t("Adding…")
      : t("Creating…")
    : isCreateServiceMode
      ? t("Add service")
      : t("Create project");
  const createDialogFormId = "fugue-create-project-form";
  const workspaceMissing = !data.workspace.exists;

  function refreshRoute() {
    startTransition(() => {
      router.refresh();
    });
  }

  const refreshGallery = useEffectEvent(
    async (options?: { silent?: boolean; refreshWorkbench?: boolean }) => {
      if (galleryRefreshPendingRef.current) {
        return false;
      }

      galleryRefreshPendingRef.current = true;
      const controller = new AbortController();
      galleryRefreshAbortRef.current = controller;

      try {
        const nextData = await requestJsonLocalized<ConsoleProjectGallerySummaryData>(
          "/api/fugue/console/gallery",
          {
            cache: "no-store",
            signal: controller.signal,
          },
          t,
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
            message: readErrorMessage(error, t),
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
        target?.name ?? buildSuggestedProjectName(data.projects),
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
      message: t("Partial Fugue data: {details}.", {
        details: data.errors.join(" | "),
      }),
      variant: data.errors.length >= 3 ? "error" : "info",
    });
  }, [data.errors, showToast, t]);

  useEffect(() => {
    startTransition(() => {
      setData(initialData);
    });
  }, [initialData]);

  useEffect(() => {
    if (!initialPendingIntentId) {
      return;
    }

    setActivePendingIntentId(initialPendingIntentId);
    setPendingIntentFocused(true);
  }, [initialPendingIntentId]);

  useEffect(() => {
    if (!activePendingIntentId || pendingIntent) {
      return;
    }

    clearPendingProjectIntentUrl(activePendingIntentId);
    setActivePendingIntentId(null);
    setPendingIntentFocused(false);
  }, [activePendingIntentId, pendingIntent]);

  useEffect(() => {
    if (!pendingIntent?.projectId) {
      return;
    }

    setRequestedProjectId(pendingIntent.projectId);
  }, [pendingIntent?.projectId]);

  useEffect(() => {
    if (!requestedProjectId) {
      return;
    }

    if (!data.projects.some((project) => project.id === requestedProjectId)) {
      return;
    }

    setSelectedProjectDetailError(null);
    setSelectedProjectDetailStatus("idle");
    setSelectedProjectId(requestedProjectId);
    setPendingIntentFocused(false);
    setRequestedProjectId(null);
  }, [data.projects, requestedProjectId]);

  useEffect(() => {
    if (
      !pendingIntent?.id ||
      pendingIntent.status !== "error" ||
      !pendingIntent.errorMessage
    ) {
      return;
    }

    const signature = `${pendingIntent.id}:${pendingIntent.errorMessage}`;

    if (announcedPendingIntentErrorRef.current === signature) {
      return;
    }

    announcedPendingIntentErrorRef.current = signature;
    showToast({
      message: pendingIntent.errorMessage,
      variant: "error",
    });
  }, [pendingIntent, showToast]);

  useEffect(() => {
    if (!pendingIntent || pendingIntent.status === "error") {
      return;
    }

    const projectVisible = pendingIntent.projectId
      ? data.projects.some((project) => project.id === pendingIntent.projectId)
      : false;

    if (pendingIntent.status === "resolved" && projectVisible) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshGallery({
        refreshWorkbench: Boolean(pendingIntent.projectId),
        silent: true,
      });
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [data.projects, pendingIntent, refreshGallery]);

  useEffect(() => {
    if (
      !pendingIntent?.id ||
      pendingIntent.status !== "resolved" ||
      !pendingIntent.projectId
    ) {
      return;
    }

    if (!data.projects.some((project) => project.id === pendingIntent.projectId)) {
      return;
    }

    clearPendingProjectIntent(pendingIntent.id);
    clearPendingProjectIntentUrl(pendingIntent.id);
    setActivePendingIntentId((current) =>
      current === pendingIntent.id ? null : current,
    );
  }, [data.projects, pendingIntent]);

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

      setSelectedProjectDetailError(t("Project detail is not available yet."));
      setSelectedProjectDetailStatus("error");
    } catch (error) {
      if (
        selectedProjectIdRef.current !== projectId ||
        isAbortRequestError(error)
      ) {
        return;
      }

      setSelectedProjectDetailError(readErrorMessage(error, t));
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
      setProjectName(buildSuggestedProjectName(data.projects));
    }
  }, [createOpen, data.projects, isCreating]);

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

    requestJsonLocalized<ProjectImageUsageResponse>("/api/fugue/projects/image-usage", {
      cache: "no-store",
    }, t)
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
          throw new Error(
            await response.text().catch(() => t("Stream unavailable.")),
          );
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
    // refreshGallery is an Effect Event and always reads the latest state.
    // Keeping it out of the dependency list avoids tearing down SSE on every render.
  }, []);

  function resetCreateForm(nextProjectName: string) {
    setProjectName(nextProjectName);
    setImportDraft(
      createImportServiceDraft(
        readDefaultImportRuntimeId(runtimeInventory.runtimeTargets),
      ),
    );
    setLocalUpload(createLocalUploadState());
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

  function focusPendingIntentCard() {
    setPendingIntentFocused(true);
    setRequestedProjectId(null);
    setSelectedProjectDetailError(null);
    setSelectedProjectDetailStatus("idle");
    setSelectedProjectId(null);
  }

  function chooseProject(project: ConsoleProjectSummaryView) {
    setPendingIntentFocused(false);
    setRequestedProjectId(null);

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

    const normalizedProjectName = projectName.trim();

    if (!createTargetProject) {
      if (!normalizedProjectName) {
        setFlash({
          message: t("Project name is required when creating a new project."),
          variant: "error",
        });
        return;
      }

      if (findProjectByName(data.projects, normalizedProjectName)) {
        setFlash({
          message: t(
            "Project name already exists. Choose a different name or select the existing project.",
          ),
          variant: "error",
        });
        return;
      }
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
      setFlash({
        message: validationError,
        variant: "error",
      });
      return;
    }

    setFlash(null);
    const endpoint =
      importDraft.sourceMode === "local-upload"
        ? "/api/fugue/projects/create-and-import-upload"
        : "/api/fugue/projects/create-and-import";
    const requestInit =
      importDraft.sourceMode === "local-upload"
        ? {
            body: buildLocalUploadFormData(
              {
                ...buildImportServicePayload(importDraft, {
                  includePersistentStorage:
                    importCapabilities.persistentStorageSupported,
                }),
                ...(createTargetProject
                  ? {
                      projectId: createTargetProject.id,
                    }
                  : {
                      projectMode: "create",
                      projectName: normalizedProjectName,
                    }),
              },
              localUpload,
            ),
            method: "POST",
          }
        : {
            body: JSON.stringify({
              ...buildImportServicePayload(importDraft, {
                includePersistentStorage:
                  importCapabilities.persistentStorageSupported,
              }),
              ...(createTargetProject
                ? {
                    projectId: createTargetProject.id,
                  }
                : {
                    projectMode: "create",
                    projectName: normalizedProjectName,
                  }),
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          };

    if (!createTargetProject) {
      const intent = createPendingProjectIntent({
        appName: importDraft.name,
        projectName: normalizedProjectName,
        retryHref: "/app?dialog=create",
        sourceLabel:
          importDraft.sourceMode === "github"
            ? importDraft.repoUrl
            : importDraft.sourceMode === "docker-image"
              ? importDraft.imageRef
              : t("Local source"),
        sourceMode: importDraft.sourceMode,
      });

      setActivePendingIntentId(intent.id);
      focusPendingIntentCard();
      setCreateTargetProject(null);
      setCreateOpen(false);
      setFlash({
        message: t("Creating project and queueing the first deployment."),
        variant: "info",
      });
      resetCreateForm(
        buildSuggestedProjectName([
          ...data.projects,
          {
            name: normalizedProjectName,
          },
        ]),
      );
      clearCreateDialogUrl();

      void (async () => {
        try {
          const response = await requestJsonLocalized<CreateProjectResponse>(
            endpoint,
            requestInit,
            t,
          );
          const affectedProjectId = resolveCreateProjectId(response);

          if (affectedProjectId) {
            invalidateConsoleProjectDetails(affectedProjectId);
          }

          resolvePendingProjectIntent(intent.id, {
            appId: response.app?.id ?? null,
            projectId: affectedProjectId,
            requestInProgress: Boolean(response.requestInProgress),
          });
          setFlash({
            message: response.requestInProgress
              ? t("Import is already running.")
              : t("Project import queued."),
            variant: "success",
          });
          void refreshGallery({
            refreshWorkbench: Boolean(affectedProjectId),
            silent: true,
          });
          refreshRoute();
        } catch (error) {
          const message = readErrorMessage(error, t);

          failPendingProjectIntent(intent.id, message);
        }
      })();

      return;
    }

    setIsCreating(true);

    try {
      const response = await requestJsonLocalized<CreateProjectResponse>(
        endpoint,
        requestInit,
        t,
      );
      const affectedProjectId = resolveCreateProjectId(
        response,
        createTargetProject?.id,
      );

      if (affectedProjectId) {
        invalidateConsoleProjectDetails(affectedProjectId);
      }

      if (affectedProjectId) {
        setRequestedProjectId(affectedProjectId);
      }

      setCreateOpen(false);
      setCreateTargetProject(null);
      setFlash({
        message: response.requestInProgress
          ? t("Import is already running.")
          : t("Service import queued."),
        variant: "success",
      });
      resetCreateForm(buildSuggestedProjectName(data.projects));
      clearCreateDialogUrl();
      void refreshGallery({
        refreshWorkbench: Boolean(affectedProjectId),
        silent: true,
      });
      refreshRoute();
    } catch (error) {
      setFlash({
        message: readErrorMessage(error, t),
        variant: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  function handleProjectDeleted(projectId: string) {
    invalidateConsoleProjectDetails(projectId);
    setSelectedProjectId((current) => (current === projectId ? null : current));
    setWorkbenchRefreshToken((value) => value + 1);
    void refreshGallery({ silent: true });
    refreshRoute();
  }

  function handleProjectMutation(
    options?:
      | number
      | {
          optimisticDeletingProjectId?: string;
          optimisticDeletingServiceCount?: number;
        },
  ) {
    const affectedProjectId =
      options && typeof options === "object"
        ? options.optimisticDeletingProjectId || selectedProjectIdRef.current
        : selectedProjectIdRef.current;

    if (affectedProjectId) {
      invalidateConsoleProjectDetails(affectedProjectId);
    }

    if (
      options &&
      typeof options === "object" &&
      options.optimisticDeletingProjectId &&
      typeof options.optimisticDeletingServiceCount === "number"
    ) {
      markProjectDeleting(
        options.optimisticDeletingProjectId,
        options.optimisticDeletingServiceCount,
      );
    }

    setWorkbenchRefreshToken((value) => value + 1);
    void refreshGallery({ silent: true });
    refreshRoute();
  }

  return (
    <>
      <div className="fg-project-gallery">
        <section
          className={cx(
            "fg-project-gallery__shelf",
            !optimisticProjects.length &&
              !pendingProjectVisible &&
              "fg-project-gallery__shelf--empty",
          )}
        >
          {workspaceMissing ? (
            <div className="fg-project-gallery__empty-state">
              <Panel className="fg-console-dialog-panel">
                <PanelSection>
                  <p className="fg-label fg-panel__eyebrow">{t("Workspace")}</p>
                  <PanelTitle>{t("No workspace yet")}</PanelTitle>
                  <PanelCopy>
                    {t(
                      "Create a workspace first, then return to the console to import your first service.",
                    )}
                  </PanelCopy>
                </PanelSection>
              </Panel>
            </div>
          ) : optimisticProjects.length || pendingProjectVisible ? (
            <div className="fg-project-gallery__stack">
              {pendingProjectVisible && pendingIntent ? (
                <PendingProjectCard
                  expanded={pendingIntentFocused}
                  intent={pendingIntent}
                  onOpen={focusPendingIntentCard}
                />
              ) : null}

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
                              {t(project.lifecycle.label)}
                            </StatusBadge>
                          </div>
                          <div className="fg-project-card__summary-meta">
                            <span className="fg-project-card__summary-kicker">
                              {projectTitle(project, t)}
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
                                    t("Unable to load this project right now.")}
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
                                    {t("Retry")}
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
                {t("Create project")}
              </Button>
            </div>
          )}
        </section>
      </div>

      {createOpen ? (
        <div className="fg-console-dialog-backdrop">
          <div
            aria-labelledby="fugue-create-project-title"
            aria-modal="true"
            className="fg-console-dialog-shell fg-project-dialog-shell fg-project-create-dialog-shell"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <Panel className="fg-console-dialog-panel fg-project-create-dialog-panel">
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

              <PanelSection className="fg-console-dialog__body fg-project-create-dialog__body">
                <form
                  className="fg-console-dialog__form fg-project-create-dialog__form"
                  id={createDialogFormId}
                  onSubmit={handleCreateProject}
                >
                  <div className="fg-console-dialog__grid fg-project-create-dialog__grid">
                    {createTargetProject ? (
                      <FormField
                        htmlFor="create-project-current"
                        label={t("Project")}
                      >
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
                        hint={t("Shown in the project list.")}
                        htmlFor="create-project-name"
                        label={t("Project name")}
                      >
                        <input
                          className="fg-input"
                          id="create-project-name"
                          name="projectName"
                          onChange={(event) => setProjectName(event.target.value)}
                          placeholder={t("Project 1")}
                          required
                          value={projectName}
                        />
                      </FormField>
                    )}

                    {runtimeInventory.loading ? (
                      <p className="fg-console-note">
                        {t("Loading deployment targets…")}
                      </p>
                    ) : null}

                    <ImportServiceFields
                      draft={importDraft}
                      githubConnectHref={githubConnectHref}
                      githubConnection={githubConnection}
                      githubConnectionError={githubConnectionError}
                      githubConnectionLoading={githubConnectionLoading}
                      idPrefix="create-service"
                      includeWrapper={false}
                      inventoryError={runtimeInventory.runtimeTargetInventoryError}
                      localUpload={localUpload}
                      onCapabilitiesChange={setImportCapabilities}
                      onDraftChange={setImportDraft}
                      onEnvironmentStatusChange={setImportEnvFeedback}
                      onLocalUploadChange={setLocalUpload}
                      runtimeTargets={runtimeInventory.runtimeTargets}
                    />
                  </div>
                </form>
              </PanelSection>

              <PanelSection className="fg-console-dialog__footer">
                <div className="fg-console-dialog__actions">
                  <Button onClick={closeCreate} type="button" variant="secondary">
                    {t("Cancel")}
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
