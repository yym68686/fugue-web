"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import dynamic from "next/dynamic";

import { CompactResourceMeter } from "@/components/console/compact-resource-meter";
import { ImportServiceFields } from "@/components/console/import-service-fields";
import { ConsoleProjectWorkbenchSkeleton } from "@/components/console/console-page-skeleton";
import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { CountryFlagLabel } from "@/components/ui/country-flag-label";
import { FormField } from "@/components/ui/form-field";
import {
  Panel,
  PanelCopy,
  PanelSection,
  PanelTitle,
} from "@/components/ui/panel";
import {
  ProofShell,
  ProofShellEmpty,
  ProofShellRibbon,
} from "@/components/ui/proof-shell";
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import { TechStackLogo } from "@/components/ui/tech-stack-logo";
import { useToast } from "@/components/ui/toast";
import {
  buildEnvDraftRowsFromEntries,
  entriesFromEnvRecord,
  parseRawEnvInput,
  serializeEnvEntries,
  type EnvDraftRow,
  type EnvEntry,
} from "@/lib/console/env-editor";
import type {
  ConsoleGalleryAppView,
  ConsoleGalleryBadgeKind,
  ConsoleGalleryCommitView,
  ConsoleGalleryPersistentStorageMountView,
  ConsoleProjectDetailData,
  ConsoleGalleryProjectView,
  ConsoleProjectGalleryData,
  ConsoleProjectSummaryView,
} from "@/lib/console/gallery-types";
import { OPEN_CREATE_PROJECT_DIALOG_EVENT } from "@/lib/console/dialog-events";
import {
  fetchConsoleProjectDetail,
  readCachedConsoleProjectDetail,
} from "@/lib/console/project-detail-client";
import { readProjectLifecycleTone } from "@/lib/console/project-lifecycle-tone";
import { buildProjectResourceUsageView } from "@/lib/console/project-resource-usage";
import {
  useConsoleRuntimeTargetInventory,
  warmConsoleRuntimeTargetInventory,
} from "@/lib/console/runtime-target-inventory-client";
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
  DUPLICATE_PROJECT_NAME_MESSAGE,
  findProjectByName,
} from "@/lib/project-names";
import { readGitHubCommitHref } from "@/lib/fugue/source-links";
import { isGitHubSourceType } from "@/lib/github/repository";
import type { ConsoleTone } from "@/lib/console/types";
import { parseAnsiText } from "@/lib/ui/ansi";
import { useAnticipatoryWarmup } from "@/lib/ui/anticipatory-warmup";
import { copyText } from "@/lib/ui/clipboard";
import { cx } from "@/lib/ui/cx";
import {
  createAbortRequestError,
  isAbortRequestError,
} from "@/lib/ui/request-json";
import { consumeSSEStream, type ParsedSSEEvent } from "@/lib/ui/sse";

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

type EnvResponse = {
  env?: Record<string, string>;
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

type BuildLogsResponse = {
  available?: boolean;
  buildStrategy?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
  jobName?: string | null;
  logs?: string;
  operationId?: string | null;
  operationStatus?: string | null;
  resultMessage?: string | null;
  source?: string | null;
  startedAt?: string | null;
};

type RuntimeLogsResponse = {
  component?: string | null;
  logs?: string;
  pods?: string[];
  warnings?: string[];
};

type LogsConnectionState =
  | "connecting"
  | "ended"
  | "error"
  | "idle"
  | "live"
  | "reconnecting"
  | "snapshot";

type LogStreamSource = {
  component: string | null;
  container: string | null;
  jobName: string | null;
  namespace: string | null;
  phase: string | null;
  pod: string | null;
  previous: boolean;
  stream: string | null;
};

type BuildLogStreamStatus = {
  buildStrategy: string | null;
  completedAt: string | null;
  cursor: string | null;
  errorMessage: string | null;
  jobName: string | null;
  lastUpdatedAt: string | null;
  operationId: string | null;
  operationStatus: string | null;
  pods: string[];
  resultMessage: string | null;
  startedAt: string | null;
};

type RuntimeLogStreamState = {
  component: string | null;
  container: string | null;
  cursor: string | null;
  follow: boolean;
  namespace: string | null;
  pods: string[];
  previous: boolean;
  selector: string | null;
};

type LogStreamLogLine = {
  cursor: string | null;
  line: string;
  source: LogStreamSource | null;
  timestamp: string | null;
};

type LogStreamWarning = {
  cursor: string | null;
  message: string | null;
  source: LogStreamSource | null;
};

type LogStreamEnd = {
  cursor: string | null;
  operationStatus: string | null;
  reason: string | null;
};

type AppAction =
  | "delete"
  | "disable"
  | "force-delete"
  | "redeploy"
  | "restart"
  | "start";
type ProjectAction = "delete";
type WorkbenchView = "env" | "files" | "images" | "logs" | "route" | "settings";
type EnvironmentFormat = "raw" | "table";
type LogsView = "build" | "runtime";

type EnvRow = {
  existing: boolean;
  id: string;
  key: string;
  originalKey: string;
  originalValue: string;
  removed: boolean;
  value: string;
};

type EnvRawFeedback = {
  message: string;
  tone: "error" | "info" | "success";
  valid: boolean;
};

type RuntimeLogsUnavailableState = {
  description: string;
  label: string;
  title: string;
};

type DeleteAppActionResult = {
  alreadyDeleting?: boolean;
  deleted?: boolean;
};

type ConsoleGalleryServiceView = ConsoleGalleryProjectView["services"][number];

const WORKBENCH_VIEW_OPTIONS: readonly SegmentedControlOption<WorkbenchView>[] =
  [
    { value: "env", label: "Environment" },
    { value: "route", label: "Route" },
    { value: "files", label: "Files" },
    { value: "logs", label: "Logs" },
    { value: "images", label: "Images" },
    { value: "settings", label: "Settings" },
  ];

const ENV_ROUTE_AND_LOGS_WORKBENCH_OPTIONS: readonly SegmentedControlOption<WorkbenchView>[] =
  [
    { value: "env", label: "Environment" },
    { value: "route", label: "Route" },
    { value: "logs", label: "Logs" },
    { value: "images", label: "Images" },
    { value: "settings", label: "Settings" },
  ];

const BACKING_SERVICE_WORKBENCH_OPTIONS: readonly SegmentedControlOption<WorkbenchView>[] =
  [
    { value: "settings", label: "Settings" },
    { value: "logs", label: "Logs" },
  ];

const ENVIRONMENT_FORMAT_OPTIONS: readonly SegmentedControlOption<EnvironmentFormat>[] =
  [
    { value: "table", label: "Variables" },
    { value: "raw", label: "Raw" },
  ];

const LOG_VIEW_OPTIONS: readonly SegmentedControlOption<LogsView>[] = [
  { value: "build", label: "Build" },
  { value: "runtime", label: "Runtime" },
];

const RUNTIME_ONLY_LOG_VIEW_OPTIONS: readonly SegmentedControlOption<LogsView>[] =
  [{ value: "runtime", label: "Runtime" }];

const LOG_AUTO_REFRESH_INTERVAL_MS = 3_000;
const LOG_STREAM_FIRST_EVENT_TIMEOUT_MS = 3_000;
const PROJECT_ACTIVE_REFRESH_INTERVAL_MS = 3_000;
const PROJECT_PASSIVE_REFRESH_INTERVAL_MS = 6_000;
const LOG_TAIL_LINES = 200;
const APP_ENV_PREFETCH_CONCURRENCY = 3;
const WORKBENCH_LAYER_PREFETCH_CONCURRENCY = 3;
const PROJECT_IMAGE_USAGE_CACHE_TTL_MS = 60_000;

type CachedEnvState = {
  baseline: Record<string, string>;
  format: EnvironmentFormat;
  rawDraft: string;
  rawFeedback: EnvRawFeedback;
  rows: EnvRow[];
};

type CachedProjectImageUsage = {
  cachedAt: number;
  projects: ProjectImageUsageSummary[];
};

const envStateCache = new Map<string, CachedEnvState>();
const envStateRequestCache = new Map<string, Promise<CachedEnvState>>();
let cachedProjectImageUsage: CachedProjectImageUsage | null = null;

function createDefaultEnvRawFeedback(): EnvRawFeedback {
  return {
    message: "Paste a .env block to expand it into individual variables.",
    tone: "info",
    valid: true,
  };
}

function cloneEnvRows(rows: EnvRow[]) {
  return rows.map((row) => ({ ...row }));
}

function cloneCachedEnvState(state: CachedEnvState): CachedEnvState {
  return {
    baseline: { ...state.baseline },
    format: state.format,
    rawDraft: state.rawDraft,
    rawFeedback: { ...state.rawFeedback },
    rows: cloneEnvRows(state.rows),
  };
}

function readCachedEnvState(appId: string) {
  const cached = envStateCache.get(appId);
  return cached ? cloneCachedEnvState(cached) : null;
}

function writeCachedEnvState(appId: string, state: CachedEnvState) {
  envStateCache.set(appId, cloneCachedEnvState(state));
}

function WorkbenchLoadingNote({ label }: { label: string }) {
  return (
    <div className="fg-workbench-section">
      <p className="fg-console-note">{label}</p>
    </div>
  );
}

const AppRoutePanel = dynamic(
  () =>
    import("@/components/console/app-route-panel").then(
      (module) => module.AppRoutePanel,
    ),
  {
    loading: () => <WorkbenchLoadingNote label="Loading route settings…" />,
  },
);

const AppSettingsPanel = dynamic(
  () =>
    import("@/components/console/app-settings-panel").then(
      (module) => module.AppSettingsPanel,
    ),
  {
    loading: () => <WorkbenchLoadingNote label="Loading app settings…" />,
  },
);

const BackingServiceSettingsPanel = dynamic(
  () =>
    import("@/components/console/backing-service-settings-panel").then(
      (module) => module.BackingServiceSettingsPanel,
    ),
  {
    loading: () => <WorkbenchLoadingNote label="Loading service settings…" />,
  },
);

const ConsoleFilesWorkbench = dynamic(
  () =>
    import("@/components/console/console-files-workbench").then(
      (module) => module.ConsoleFilesWorkbench,
    ),
  {
    loading: () => <WorkbenchLoadingNote label="Loading files…" />,
  },
);

const AppImagesPanel = dynamic(
  () =>
    import("@/components/console/app-images-panel").then(
      (module) => module.AppImagesPanel,
    ),
  {
    loading: () => <WorkbenchLoadingNote label="Loading saved images…" />,
  },
);

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
const LOG_AUTO_FOLLOW_THRESHOLD_PX = 32;
const LOG_MAX_VISIBLE_LINES = 1_000;
const PENDING_COMMIT_HINT_TAIL_LINES = 1;
const TERMINAL_LOG_OPERATION_STATUSES = new Set([
  "canceled",
  "cancelled",
  "completed",
  "failed",
]);

function createClientId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type ProjectLifecycle = {
  label: string;
  live: boolean;
  syncMode: "active" | "idle" | "passive";
  tone: ConsoleTone;
};

const LIVE_STATUS_BADGE_KEYWORDS = [
  "running",
  "building",
  "deploying",
  "importing",
  "transferring",
  "failing-over",
  "updating",
  "queued",
  "pending",
  "migrating",
  "deleting",
  "starting",
  "creating",
  "provisioning",
] as const;

function includesLifecycleKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function isPausedLifecycleValue(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  return (
    normalized.length > 0 &&
    includesLifecycleKeyword(normalized, ["disabled", "paused"])
  );
}

function isDeletingLifecycleValue(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  return (
    normalized.length > 0 &&
    includesLifecycleKeyword(normalized, ["deleting"])
  );
}

function isPausedAppService(app?: ConsoleGalleryAppView | null) {
  return isPausedLifecycleValue(app?.phase);
}

function isFailedLifecycleValue(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  return (
    normalized.length > 0 &&
    includesLifecycleKeyword(normalized, ["error", "fail", "stopped"])
  );
}

function isFailedAppService(app?: ConsoleGalleryAppView | null) {
  return isFailedLifecycleValue(app?.phase);
}

function shouldShowLiveStatusBadge(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  return LIVE_STATUS_BADGE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );
}

function readProjectLifecycle(
  project: ConsoleGalleryProjectView,
): ProjectLifecycle {
  const hasRunningApp = project.services.some(
    (service) => service.kind === "app" && service.serviceRole === "running",
  );
  const hasPendingApp = project.services.some(
    (service) => service.kind === "app" && service.serviceRole === "pending",
  );
  const tracksGitHubBranch = project.services.some(
    (service) =>
      service.kind === "app" && isGitHubSourceType(service.sourceType),
  );
  const statuses = project.services
    .map((service) => (service.kind === "app" ? service.phase : service.status))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (
    statuses.some((status) => includesLifecycleKeyword(status, ["deleting"]))
  ) {
    return {
      label: "Deleting",
      tone: readProjectLifecycleTone("Deleting"),
      live: true,
      syncMode: "active",
    };
  }

  if (
    statuses.some((status) =>
      includesLifecycleKeyword(status, ["error", "fail", "stopped"]),
    )
  ) {
    return {
      label: "Error",
      tone: readProjectLifecycleTone("Error"),
      live: false,
      syncMode: "passive",
    };
  }

  if (hasRunningApp && hasPendingApp) {
    return {
      label: "Updating",
      tone: readProjectLifecycleTone("Updating"),
      live: true,
      syncMode: "active",
    };
  }

  if (
    statuses.some((status) => includesLifecycleKeyword(status, ["importing"]))
  ) {
    return {
      label: "Importing",
      tone: readProjectLifecycleTone("Importing"),
      live: true,
      syncMode: "active",
    };
  }

  if (
    statuses.some((status) => includesLifecycleKeyword(status, ["building"]))
  ) {
    return {
      label: "Building",
      tone: readProjectLifecycleTone("Building"),
      live: true,
      syncMode: "active",
    };
  }

  if (
    statuses.some((status) => includesLifecycleKeyword(status, ["deploying"]))
  ) {
    return {
      label: "Deploying",
      tone: readProjectLifecycleTone("Deploying"),
      live: true,
      syncMode: "active",
    };
  }

  if (
    statuses.some((status) =>
      includesLifecycleKeyword(status, ["queued", "pending", "migrating"]),
    )
  ) {
    return {
      label: "Queued",
      tone: readProjectLifecycleTone("Queued"),
      live: true,
      syncMode: "active",
    };
  }

  if (
    statuses.length > 0 &&
    statuses.every((status) => isPausedLifecycleValue(status))
  ) {
    return {
      label: "Paused",
      tone: readProjectLifecycleTone("Paused"),
      live: false,
      syncMode: "idle",
    };
  }

  if (project.appCount > 0) {
    return {
      label: "Running",
      tone: readProjectLifecycleTone("Running"),
      live: false,
      syncMode: tracksGitHubBranch ? "passive" : "idle",
    };
  }

  if (project.serviceCount > 0) {
    return {
      label: "Ready",
      tone: readProjectLifecycleTone("Ready"),
      live: false,
      syncMode: "idle",
    };
  }

  return {
    label: "Idle",
    tone: readProjectLifecycleTone("Idle"),
    live: false,
    syncMode: "idle",
  };
}

function readAppServiceRoleLabel(
  service?: Pick<ConsoleGalleryAppView, "phase" | "serviceRole"> | null,
) {
  if (isDeletingLifecycleValue(service?.phase)) {
    return "Deleting service";
  }

  if (
    service?.serviceRole === "pending" &&
    includesLifecycleKeyword(service.phase?.trim().toLowerCase() ?? "", [
      "transfer",
      "transferring",
      "failing-over",
      "migrating",
    ])
  ) {
    return "Transfer in progress";
  }

  return service?.serviceRole === "pending"
    ? "Next release"
    : "Current release";
}

function isPendingForceDeletePhase(phase?: string | null) {
  const normalized = phase?.trim().toLowerCase() ?? "";

  return (
    normalized.length > 0 &&
    includesLifecycleKeyword(normalized, [
      "importing",
      "building",
      "deploying",
      "transferring",
      "failing-over",
      "queued",
      "pending",
      "migrating",
      "updating",
    ])
  );
}

function canForceDeletePendingService(
  service?: Pick<ConsoleGalleryAppView, "phase" | "serviceRole"> | null,
) {
  return (
    service?.serviceRole === "pending" &&
    isPendingForceDeletePhase(service.phase)
  );
}

function readForceDeleteActionLabel(phase?: string | null) {
  const normalized = phase?.trim().toLowerCase() ?? "";

  if (includesLifecycleKeyword(normalized, ["importing", "building"])) {
    return "Abort build & delete";
  }

  if (
    includesLifecycleKeyword(normalized, [
      "transfer",
      "transferring",
      "failing-over",
      "migrating",
    ])
  ) {
    return "Cancel transfer & delete";
  }

  if (includesLifecycleKeyword(normalized, ["deploying", "updating"])) {
    return "Abort deploy & delete";
  }

  if (includesLifecycleKeyword(normalized, ["queued", "pending", "migrating"])) {
    return "Cancel rollout & delete";
  }

  return "Force delete";
}

function readForceDeleteActionDescription(phase?: string | null) {
  const normalized = phase?.trim().toLowerCase() ?? "";

  if (includesLifecycleKeyword(normalized, ["importing", "building"])) {
    return "Abort the in-flight build and force delete this service.";
  }

  if (
    includesLifecycleKeyword(normalized, [
      "transfer",
      "transferring",
      "failing-over",
      "migrating",
    ])
  ) {
    return "Cancel the in-flight transfer and force delete this service.";
  }

  if (includesLifecycleKeyword(normalized, ["deploying", "updating"])) {
    return "Abort the in-flight deploy and force delete this service.";
  }

  if (includesLifecycleKeyword(normalized, ["queued", "pending", "migrating"])) {
    return "Cancel the queued rollout and force delete this service.";
  }

  return "Force delete this pending service.";
}

function readDeleteActionSuccessMessage(
  action: "delete" | "force-delete",
  result: DeleteAppActionResult,
  phase?: string | null,
) {
  if (result.deleted) {
    return "Service deleted.";
  }

  if (action === "delete") {
    return result.alreadyDeleting ? "Delete is already queued." : "Delete queued.";
  }

  if (result.alreadyDeleting) {
    return "Force delete is already queued.";
  }

  const normalized = phase?.trim().toLowerCase() ?? "";

  if (includesLifecycleKeyword(normalized, ["importing", "building"])) {
    return "Build aborted. Force delete queued.";
  }

  if (includesLifecycleKeyword(normalized, ["deploying", "updating"])) {
    return "Deploy aborted. Force delete queued.";
  }

  if (includesLifecycleKeyword(normalized, ["queued", "pending", "migrating"])) {
    return "Queued rollout canceled. Force delete queued.";
  }

  return "Force delete queued.";
}

function readErrorMessage(error: unknown) {
  if (isAbortRequestError(error)) {
    return "Request canceled.";
  }

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

  return (data ?? {}) as T;
}

async function readResponseError(response: Response) {
  const body = await response.text().catch(() => "");
  const trimmed = body.trim();

  if (!trimmed) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const payload = JSON.parse(trimmed) as { error?: unknown };

    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Fall back to the raw response body when the stream proxy returns plain text.
  }

  return trimmed;
}

function asRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function readBooleanValue(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : false;
}

function readStringArrayValue(
  record: Record<string, unknown> | null,
  key: string,
) {
  const value = record?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseStreamPayload(event: ParsedSSEEvent) {
  try {
    return asRecord(JSON.parse(event.data));
  } catch {
    return null;
  }
}

function readLogStreamSource(value: unknown): LogStreamSource | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    component: readStringValue(record, "component"),
    container: readStringValue(record, "container"),
    jobName: readStringValue(record, "job_name"),
    namespace: readStringValue(record, "namespace"),
    phase: readStringValue(record, "phase"),
    pod: readStringValue(record, "pod"),
    previous: readBooleanValue(record, "previous"),
    stream: readStringValue(record, "stream"),
  };
}

function parseBuildLogStreamStatus(
  event: ParsedSSEEvent,
): BuildLogStreamStatus | null {
  const payload = parseStreamPayload(event);

  if (!payload) {
    return null;
  }

  return {
    buildStrategy: readStringValue(payload, "build_strategy"),
    completedAt: readStringValue(payload, "completed_at"),
    cursor: readStringValue(payload, "cursor"),
    errorMessage: readStringValue(payload, "error_message"),
    jobName: readStringValue(payload, "job_name"),
    lastUpdatedAt: readStringValue(payload, "last_updated_at"),
    operationId: readStringValue(payload, "operation_id"),
    operationStatus: readStringValue(payload, "operation_status"),
    pods: readStringArrayValue(payload, "pods"),
    resultMessage: readStringValue(payload, "result_message"),
    startedAt: readStringValue(payload, "started_at"),
  };
}

function parseRuntimeLogStreamState(
  event: ParsedSSEEvent,
): RuntimeLogStreamState | null {
  const payload = parseStreamPayload(event);

  if (!payload) {
    return null;
  }

  return {
    component: readStringValue(payload, "component"),
    container: readStringValue(payload, "container"),
    cursor: readStringValue(payload, "cursor"),
    follow: readBooleanValue(payload, "follow"),
    namespace: readStringValue(payload, "namespace"),
    pods: readStringArrayValue(payload, "pods"),
    previous: readBooleanValue(payload, "previous"),
    selector: readStringValue(payload, "selector"),
  };
}

function parseLogStreamLogLine(event: ParsedSSEEvent): LogStreamLogLine | null {
  const payload = parseStreamPayload(event);

  if (!payload) {
    return null;
  }

  const line = readStringValue(payload, "line");

  if (line === null) {
    return null;
  }

  return {
    cursor: readStringValue(payload, "cursor"),
    line,
    source: readLogStreamSource(payload.source),
    timestamp: readStringValue(payload, "timestamp"),
  };
}

function parseLogStreamWarning(event: ParsedSSEEvent): LogStreamWarning | null {
  const payload = parseStreamPayload(event);

  if (!payload) {
    return null;
  }

  return {
    cursor: readStringValue(payload, "cursor"),
    message: readStringValue(payload, "message"),
    source: readLogStreamSource(payload.source),
  };
}

function parseLogStreamEnd(event: ParsedSSEEvent): LogStreamEnd | null {
  const payload = parseStreamPayload(event);

  if (!payload) {
    return null;
  }

  return {
    cursor: readStringValue(payload, "cursor"),
    operationStatus: readStringValue(payload, "operation_status"),
    reason: readStringValue(payload, "reason"),
  };
}

function buildLogsResponseFromStatus(
  status: BuildLogStreamStatus,
): BuildLogsResponse {
  return {
    buildStrategy: status.buildStrategy,
    completedAt: status.completedAt,
    errorMessage: status.errorMessage,
    jobName: status.jobName,
    operationId: status.operationId,
    operationStatus: status.operationStatus,
    resultMessage: status.resultMessage,
    startedAt: status.startedAt,
  };
}

function trimLogLines(lines: string[]) {
  const overflow = lines.length - LOG_MAX_VISIBLE_LINES;

  if (overflow > 0) {
    lines.splice(0, overflow);
  }

  return lines;
}

function isLogViewportNearBottom(element: HTMLElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    LOG_AUTO_FOLLOW_THRESHOLD_PX
  );
}

function readLogStreamSourceId(source?: LogStreamSource | null) {
  if (!source) {
    return null;
  }

  const parts = [
    source.stream,
    source.namespace,
    source.component,
    source.jobName,
    source.pod,
    source.container,
    source.previous ? "previous" : "current",
  ].filter(Boolean);

  return parts.length ? parts.join(":") : null;
}

function readLogStreamSourceLabel(source?: LogStreamSource | null) {
  if (!source) {
    return null;
  }

  if (source.stream === "build") {
    return (
      [source.pod, source.container].filter(Boolean).join("/") ||
      source.jobName ||
      "build"
    );
  }

  return (
    source.pod ||
    source.container ||
    source.component ||
    source.stream ||
    "runtime"
  );
}

function appendLogLine(
  currentLines: string[],
  line: string,
  source: LogStreamSource | null,
  previousSourceId: string | null,
) {
  const sourceId = readLogStreamSourceId(source);
  const sourceLabel =
    sourceId && sourceId !== previousSourceId
      ? readLogStreamSourceLabel(source)
      : null;

  if (sourceLabel) {
    if (currentLines.length > 0) {
      currentLines.push("");
    }

    currentLines.push(`==> ${sourceLabel} <==`);
  }

  currentLines.push(line);

  return {
    lines: trimLogLines(currentLines),
    sourceId: sourceId ?? previousSourceId,
  };
}

function appendLogWarning(
  currentLines: string[],
  warning: LogStreamWarning,
  previousSourceId: string | null,
) {
  const message = warning.message?.trim();

  if (!message) {
    return {
      lines: currentLines,
      sourceId: previousSourceId,
    };
  }

  return appendLogLine(
    currentLines,
    `[warning] ${message}`,
    warning.source,
    previousSourceId,
  );
}

function joinLogLines(lines: string[]) {
  return lines.join("\n");
}

function splitLogTextIntoLines(value: string) {
  return value.replace(/\r\n?/g, "\n").split("\n");
}

function buildRuntimeLogSnapshotLines(snapshot: RuntimeLogsResponse) {
  const lines = splitLogTextIntoLines(snapshot.logs ?? "");

  for (const warning of snapshot.warnings ?? []) {
    const message = warning.trim();

    if (!message) {
      continue;
    }

    if (lines.length > 0 && lines.at(-1) !== "") {
      lines.push("");
    }

    lines.push(`[warning] ${message}`);
  }

  return trimLogLines(lines);
}

class LogStreamRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LogStreamRequestError";
    this.status = status;
  }
}

function isRetryableLogStreamError(
  error: unknown,
  logsMode: LogsView,
  app: ConsoleGalleryAppView | null,
) {
  if (!(error instanceof LogStreamRequestError)) {
    return true;
  }

  if (error.status >= 500) {
    return true;
  }

  if (
    error.status === 404 &&
    logsMode === "runtime" &&
    includesLifecycleKeyword(app?.phase ?? "", ["deploying"])
  ) {
    return true;
  }

  return false;
}

function readLogStreamErrorMessage(error: unknown, logsMode: LogsView) {
  if (error instanceof LogStreamRequestError && error.status === 404) {
    return `${humanizeUiLabel(logsMode)} logs are not ready yet.`;
  }

  return readErrorMessage(error);
}

function projectApps(project: ConsoleGalleryProjectView) {
  const runningApps = project.services.filter(
    (service): service is { kind: "app" } & ConsoleGalleryAppView =>
      service.kind === "app" && service.serviceRole === "running",
  );

  if (runningApps.length > 0) {
    return runningApps;
  }

  return project.services.filter(
    (service): service is { kind: "app" } & ConsoleGalleryAppView =>
      service.kind === "app" && service.serviceRole === "pending",
  );
}

function serviceKey(service: ConsoleGalleryServiceView) {
  return service.kind === "app"
    ? `${service.kind}:${service.id}:${service.serviceRole}`
    : `${service.kind}:${service.id}`;
}

function readPreferredProjectService(
  services: ConsoleGalleryProjectView["services"],
) {
  return (
    services.find(
      (service) => service.kind === "app" && service.serviceRole === "pending",
    ) ??
    services[0] ??
    null
  );
}

function readServiceWarmupKey(service: ConsoleGalleryServiceView | null) {
  if (!service) {
    return "";
  }

  if (service.kind !== "app") {
    return serviceKey(service);
  }

  const storageSignature = service.persistentStorageMounts
    .map(
      (mount) =>
        `${mount.kind ?? "unknown"}:${mount.path}:${mount.mode ?? "null"}`,
    )
    .join("|");

  return `${serviceKey(service)}:${service.phase}:${storageSignature}`;
}

async function warmItemsWithConcurrency<T>(
  items: readonly T[],
  warm: (item: T) => Promise<unknown>,
  options?: {
    concurrency?: number;
    signal?: AbortSignal;
  },
) {
  if (!items.length) {
    return;
  }

  const concurrency = Math.max(
    1,
    Math.min(
      options?.concurrency ?? WORKBENCH_LAYER_PREFETCH_CONCURRENCY,
      items.length,
    ),
  );
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (!options?.signal?.aborted) {
        const item = items[nextIndex];
        nextIndex += 1;

        if (!item) {
          return;
        }

        try {
          await warm(item);
        } catch (error) {
          if (options?.signal?.aborted || isAbortRequestError(error)) {
            return;
          }
        }
      }
    }),
  );
}

function orderServicesForWarmup(
  services: ConsoleGalleryProjectView["services"],
  selectedService: ConsoleGalleryServiceView | null,
) {
  const orderedServices: ConsoleGalleryProjectView["services"] = [];
  const seenServiceKeys = new Set<string>();

  if (selectedService) {
    orderedServices.push(selectedService);
    seenServiceKeys.add(serviceKey(selectedService));
  }

  for (const service of services) {
    const key = serviceKey(service);

    if (seenServiceKeys.has(key)) {
      continue;
    }

    seenServiceKeys.add(key);
    orderedServices.push(service);
  }

  return orderedServices;
}

function useWorkbenchAnticipatoryWarmup(
  services: ConsoleGalleryProjectView["services"],
  selectedService: ConsoleGalleryServiceView | null,
) {
  const warmWorkbenchResources = useEffectEvent(async (signal: AbortSignal) => {
    const orderedServices = orderServicesForWarmup(services, selectedService);

    if (!orderedServices.length) {
      return;
    }

    const appServices = orderedServices.filter(
      (service): service is { kind: "app" } & ConsoleGalleryAppView =>
        service.kind === "app",
    );
    const runningAppServices = appServices.filter(
      (service) =>
        service.serviceRole === "running" && !isPausedAppService(service),
    );
    const hasBackingServices = orderedServices.some(
      (service) => service.kind === "backing-service",
    );
    const tasks: Promise<unknown>[] = [];

    if (orderedServices.length > 0) {
      tasks.push(
        warmConsoleRuntimeTargetInventory({
          signal,
        }),
      );
    }

    if (appServices.length > 0) {
      tasks.push(import("@/components/console/app-route-panel"));
      tasks.push(import("@/components/console/app-settings-panel"));
      tasks.push(
        import("@/components/console/app-images-panel").then((module) =>
          warmItemsWithConcurrency(
            appServices,
            (service) =>
              module.warmAppImageInventory(service.id, {
                signal,
              }),
            {
              concurrency: WORKBENCH_LAYER_PREFETCH_CONCURRENCY,
              signal,
            },
          ),
        ),
      );
      tasks.push(
        warmConsoleAppEnvStates(
          appServices.map((service) => service.id),
          {
            concurrency: WORKBENCH_LAYER_PREFETCH_CONCURRENCY,
            signal,
          },
        ),
      );

      if (runningAppServices.length > 0) {
        tasks.push(
          import("@/components/console/console-files-workbench").then(
            (module) =>
              warmItemsWithConcurrency(
                runningAppServices,
                (service) =>
                  module.warmConsoleFilesWorkbench({
                    appId: service.id,
                    persistentStorageMounts: service.persistentStorageMounts,
                    signal,
                  }),
                {
                  concurrency: WORKBENCH_LAYER_PREFETCH_CONCURRENCY,
                  signal,
                },
              ),
          ),
        );
      }
    }

    if (hasBackingServices) {
      tasks.push(import("@/components/console/backing-service-settings-panel"));
    }

    await Promise.allSettled(tasks);
  });

  const layerWarmupKey = services.map(readServiceWarmupKey).join("||");

  useAnticipatoryWarmup(
    services.length > 0 ? warmWorkbenchResources : null,
    [layerWarmupKey, readServiceWarmupKey(selectedService)],
    {
      mode: "idle",
      timeoutMs: 1_000,
    },
  );
}

function shouldHideOptimisticallyDeletingService(
  service: ConsoleGalleryServiceView,
  deletingAppIds: ReadonlySet<string>,
) {
  return (
    service.kind === "app" &&
    (deletingAppIds.has(service.id) || isDeletingLifecycleValue(service.phase))
  );
}

function buildOptimisticProjectServiceBadges(
  services: ConsoleGalleryProjectView["services"],
) {
  const badges = new Map<
    string,
    ConsoleGalleryProjectView["serviceBadges"][number]
  >();

  for (const service of services) {
    const key =
      service.kind === "app"
        ? `project-service:app:${service.id}`
        : `project-service:${service.kind}:${service.id}`;

    if (
      service.kind === "app" &&
      service.serviceRole === "pending" &&
      badges.has(key)
    ) {
      continue;
    }

    badges.set(key, {
      ...service.primaryBadge,
      id: key,
    });
  }

  return [...badges.values()];
}

function countProjectApps(services: ConsoleGalleryProjectView["services"]) {
  return services.reduce(
    (count, service) => count + (service.kind === "app" ? 1 : 0),
    0,
  );
}

function applyOptimisticDeletingToProjects(
  projects: ConsoleGalleryProjectView[],
  deletingAppIds: ReadonlySet<string>,
) {
  let didChange = false;
  const nextProjects = projects.map((project) => {
    let projectChanged = false;
    const nextServices = project.services.filter((service) => {
      const shouldHide = shouldHideOptimisticallyDeletingService(
        service,
        deletingAppIds,
      );

      if (shouldHide) {
        projectChanged = true;
      }

      return !shouldHide;
    });

    if (!projectChanged) {
      return project;
    }

    didChange = true;
    return {
      ...project,
      appCount: countProjectApps(nextServices),
      serviceBadges: buildOptimisticProjectServiceBadges(nextServices),
      serviceCount: nextServices.length,
      services: nextServices,
    } satisfies ConsoleGalleryProjectView;
  });

  return didChange ? nextProjects : projects;
}

function pruneOptimisticDeletingAppIds(
  current: Set<string>,
  projects: ConsoleGalleryProjectView[],
) {
  if (current.size === 0) {
    return current;
  }

  const next = new Set<string>();

  projects.forEach((project) => {
    project.services.forEach((service) => {
      if (
        service.kind === "app" &&
        current.has(service.id) &&
        !isDeletingLifecycleValue(service.phase)
      ) {
        next.add(service.id);
      }
    });
  });

  return next.size === current.size ? current : next;
}

function useOptimisticDeletingProjects(projects: ConsoleGalleryProjectView[]) {
  const [optimisticDeletingAppIds, setOptimisticDeletingAppIds] = useState<
    Set<string>
  >(() => new Set());

  useEffect(() => {
    setOptimisticDeletingAppIds((current) =>
      pruneOptimisticDeletingAppIds(current, projects),
    );
  }, [projects]);

  const markAppDeleting = useEffectEvent((appId: string) => {
    const normalizedAppId = appId.trim();

    if (!normalizedAppId) {
      return;
    }

    setOptimisticDeletingAppIds((current) => {
      if (current.has(normalizedAppId)) {
        return current;
      }

      const next = new Set(current);
      next.add(normalizedAppId);
      return next;
    });
  });

  return {
    markAppDeleting,
    optimisticProjects: applyOptimisticDeletingToProjects(
      projects,
      optimisticDeletingAppIds,
    ),
  };
}

function readServiceWorkbenchOptions(
  service: ConsoleGalleryServiceView | null,
) {
  if (!service) {
    return WORKBENCH_VIEW_OPTIONS;
  }

  if (service.kind === "backing-service") {
    return BACKING_SERVICE_WORKBENCH_OPTIONS;
  }

  if (service.serviceRole === "pending") {
    return ENV_ROUTE_AND_LOGS_WORKBENCH_OPTIONS;
  }

  if (isPausedAppService(service)) {
    return ENV_ROUTE_AND_LOGS_WORKBENCH_OPTIONS;
  }

  return WORKBENCH_VIEW_OPTIONS;
}

function readServiceLogViewOptions(
  service: ConsoleGalleryServiceView | null,
  _services: ConsoleGalleryProjectView["services"],
) {
  if (!service) {
    return LOG_VIEW_OPTIONS;
  }

  if (service.kind === "backing-service") {
    return RUNTIME_ONLY_LOG_VIEW_OPTIONS;
  }

  return LOG_VIEW_OPTIONS;
}

function normalizeLogsModeForService(
  service: ConsoleGalleryServiceView | null,
  services: ConsoleGalleryProjectView["services"],
  logsMode: LogsView,
) {
  const options = readServiceLogViewOptions(service, services);
  return options.some((option) => option.value === logsMode)
    ? logsMode
    : (options[0]?.value ?? "runtime");
}

function readServiceDefaultTab(
  service: ConsoleGalleryServiceView | null,
): WorkbenchView {
  if (!service) {
    return "env";
  }

  if (service.kind === "backing-service") {
    return "settings";
  }

  return service.serviceRole === "pending" ? "logs" : "env";
}

function readServiceDefaultLogsMode(
  service: ConsoleGalleryServiceView | null,
  services: ConsoleGalleryProjectView["services"],
): LogsView {
  const preferredMode =
    service?.kind === "app" &&
    includesLifecycleKeyword(service.phase, ["error", "fail", "stopped"])
      ? "runtime"
      : service?.kind === "app"
        ? "build"
        : "runtime";

  return normalizeLogsModeForService(
    service,
    services,
    preferredMode,
  );
}

function rowsFromEnv(env: Record<string, string>) {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        ({
          existing: true,
          id: createClientId("env"),
          key,
          originalKey: key,
          originalValue: value,
          removed: false,
          value,
        }) satisfies EnvRow,
    );
}

function readEnvRowKey(row: Pick<EnvRow, "key">) {
  return row.key.trim();
}

function entriesFromEnvRows(rows: EnvRow[]) {
  return rows.flatMap((row) => {
    if (row.removed) {
      return [];
    }

    const key = readEnvRowKey(row);

    if (!key) {
      return [];
    }

    return [{ key, value: row.value } satisfies EnvEntry];
  });
}

function rowsFromEnvDrafts(rows: EnvDraftRow[]) {
  return rows.map(
    (row) =>
      ({
        ...row,
        id: createClientId("env"),
      }) satisfies EnvRow,
  );
}

function buildEnvRawFeedback(
  rows: EnvRow[],
  ignoredLineCount = 0,
): EnvRawFeedback {
  const activeRows = rows.filter(
    (row) => !row.removed && readEnvRowKey(row).length > 0,
  );
  const addedCount = activeRows.filter((row) => !row.existing).length;
  const updatedCount = activeRows.filter(
    (row) =>
      row.existing &&
      (readEnvRowKey(row) !== row.originalKey ||
        row.value !== row.originalValue),
  ).length;
  const removedCount = rows.filter((row) => row.existing && row.removed).length;
  const changeCount = addedCount + updatedCount + removedCount;
  const ignoredLabel =
    ignoredLineCount > 0
      ? `${ignoredLineCount} comment${ignoredLineCount === 1 ? "" : "s"} or blank line${ignoredLineCount === 1 ? "" : "s"} ignored`
      : null;

  if (!activeRows.length) {
    const message =
      removedCount > 0
        ? `Raw input is empty. Saving will remove ${removedCount} existing variable${removedCount === 1 ? "" : "s"}.`
        : "Raw input is empty. Saving will keep the environment empty.";

    return {
      message,
      tone: "info",
      valid: true,
    };
  }

  const parts = [
    `${activeRows.length} variable${activeRows.length === 1 ? "" : "s"} parsed`,
  ];

  if (addedCount > 0) {
    parts.push(`${addedCount} new`);
  }

  if (updatedCount > 0) {
    parts.push(`${updatedCount} updated`);
  }

  if (removedCount > 0) {
    parts.push(`${removedCount} removed`);
  }

  if (changeCount === 0) {
    parts.push("matches current environment");
  }

  if (ignoredLabel) {
    parts.push(ignoredLabel);
  }

  return {
    message: `${parts.join(" · ")}.`,
    tone: changeCount > 0 ? "success" : "info",
    valid: true,
  };
}

function buildCachedEnvState(
  env: Record<string, string>,
  format: EnvironmentFormat = "table",
): CachedEnvState {
  const nextRows = rowsFromEnv(env);

  return {
    baseline: env,
    format,
    rawDraft: serializeEnvEntries(entriesFromEnvRecord(env)),
    rawFeedback: buildEnvRawFeedback(nextRows),
    rows: nextRows,
  };
}

async function fetchCachedEnvState(
  appId: string,
  options?: {
    signal?: AbortSignal;
  },
) {
  const normalizedAppId = appId.trim();

  if (!normalizedAppId) {
    throw new Error("App id is required.");
  }

  if (options?.signal?.aborted) {
    throw createAbortRequestError();
  }

  const cached = readCachedEnvState(normalizedAppId);

  if (cached) {
    return cached;
  }

  const pendingRequest = envStateRequestCache.get(normalizedAppId);

  if (pendingRequest) {
    return pendingRequest;
  }

  const request = requestJson<EnvResponse>(
    `/api/fugue/apps/${normalizedAppId}/env`,
    {
      cache: "no-store",
    },
  )
    .then((response) => {
      const nextState = buildCachedEnvState(response.env ?? {});
      writeCachedEnvState(normalizedAppId, nextState);
      return readCachedEnvState(normalizedAppId) ?? nextState;
    })
    .finally(() => {
      if (envStateRequestCache.get(normalizedAppId) === request) {
        envStateRequestCache.delete(normalizedAppId);
      }
    });

  envStateRequestCache.set(normalizedAppId, request);
  return request;
}

export async function warmConsoleAppEnvStates(
  appIds: string[],
  options?: {
    concurrency?: number;
    signal?: AbortSignal;
  },
) {
  const queue = Array.from(
    new Set(appIds.map((appId) => appId.trim()).filter(Boolean)),
  ).filter((appId) => !readCachedEnvState(appId));

  if (!queue.length) {
    return;
  }

  const concurrency = Math.max(
    1,
    Math.min(
      options?.concurrency ?? APP_ENV_PREFETCH_CONCURRENCY,
      queue.length,
    ),
  );
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (!options?.signal?.aborted) {
        const appId = queue[nextIndex];
        nextIndex += 1;

        if (!appId) {
          return;
        }

        try {
          await fetchCachedEnvState(appId);
        } catch (error) {
          if (options?.signal?.aborted || isAbortRequestError(error)) {
            return;
          }
        }
      }
    }),
  );
}

function humanizeUiLabel(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeComparableText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function readDistinctText(
  value?: string | null,
  comparisons: Array<string | null | undefined> = [],
) {
  const trimmedValue = value?.trim().replace(/\s+/g, " ") ?? "";

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = trimmedValue.toLowerCase();
  const duplicate = comparisons.some((comparison) => {
    const normalizedComparison = normalizeComparableText(comparison);
    return (
      normalizedComparison.length > 0 &&
      normalizedComparison === normalizedValue
    );
  });

  return duplicate ? null : trimmedValue;
}

function readPersistentStorageLabel(
  mounts: ConsoleGalleryPersistentStorageMountView[],
) {
  const paths = mounts
    .map((mount) => mount.path.trim())
    .filter((path) => path.length > 0);

  if (paths.length === 0) {
    return null;
  }

  if (paths.length === 1) {
    return paths[0];
  }

  return `${paths.length} mounts`;
}

function renderExternalText(
  label: string,
  href?: string | null,
  className?: string,
) {
  if (!href) {
    return <span className={className}>{label}</span>;
  }

  return (
    <a
      className={cx("fg-text-link", className)}
      href={href}
      rel="noreferrer"
      target="_blank"
      title={href}
    >
      {label}
    </a>
  );
}

function readServicePublicUrl(service: ConsoleGalleryServiceView | null) {
  if (!service || service.kind !== "app") {
    return null;
  }

  const routeHref = service.routeHref?.trim();

  if (routeHref) {
    return {
      href: routeHref,
      label: routeHref,
    };
  }

  const routeLabel = service.routeLabel?.trim();
  const normalizedRouteLabel = routeLabel?.toLowerCase() ?? "";

  if (
    !routeLabel ||
    normalizedRouteLabel === "unassigned" ||
    normalizedRouteLabel.startsWith("private /")
  ) {
    return null;
  }

  const inferredHref = routeLabel.includes("://")
    ? routeLabel
    : `https://${routeLabel}`;

  return {
    href: inferredHref,
    label: inferredHref,
  };
}

function renderCommitLink(
  commit: Pick<ConsoleGalleryCommitView, "exact" | "href" | "label">,
) {
  if (!commit.label) {
    return <span>—</span>;
  }

  if (!commit.href) {
    return <span title={commit.exact ?? undefined}>{commit.label}</span>;
  }

  return (
    <a
      className="fg-text-link"
      href={commit.href}
      rel="noreferrer"
      target="_blank"
      title={commit.exact ?? commit.href}
    >
      {commit.label}
    </a>
  );
}

function hasPendingCommitView(app: ConsoleGalleryAppView | null) {
  return app?.commitViews.some((commit) => commit.kind === "pending") ?? false;
}

function isGitHubTrackedApp(app: ConsoleGalleryAppView | null) {
  return isGitHubSourceType(app?.sourceType);
}

function hasInFlightCommitPhase(phase?: string | null) {
  const normalized = phase?.trim().toLowerCase() ?? "";

  return (
    normalized.length > 0 &&
    includesLifecycleKeyword(normalized, [
      "importing",
      "building",
      "deploying",
      "queued",
      "pending",
      "migrating",
    ])
  );
}

function hasActiveBuildLogsOperation(
  buildLogs:
    | Pick<BuildLogsResponse, "completedAt" | "operationStatus" | "startedAt">
    | null
    | undefined,
) {
  const normalizedStatus =
    buildLogs?.operationStatus?.trim().toLowerCase() ?? "";

  if (normalizedStatus) {
    return !TERMINAL_LOG_OPERATION_STATUSES.has(normalizedStatus);
  }

  return Boolean(buildLogs?.startedAt && !buildLogs.completedAt);
}

function parsePendingCommitFromBuildJobName(jobName?: string | null) {
  const normalized = jobName?.trim();

  if (!normalized) {
    return null;
  }

  const match = normalized.match(/([0-9a-f]{7,12})$/i);

  if (!match?.[1]) {
    return null;
  }

  const exact = match[1].toLowerCase();

  return {
    exact,
    label: exact.length > 8 ? exact.slice(0, 8) : exact,
  };
}

function readPendingCommitState(
  phase?: string | null,
  operationStatus?: string | null,
): Pick<ConsoleGalleryCommitView, "stateLabel" | "tone"> {
  const normalizedStatus = operationStatus?.trim().toLowerCase() ?? "";
  const hasActiveStatus = normalizedStatus
    ? !TERMINAL_LOG_OPERATION_STATUSES.has(normalizedStatus)
    : false;

  if (hasActiveStatus) {
    if (
      includesLifecycleKeyword(normalizedStatus, [
        "queued",
        "pending",
        "migrating",
      ])
    ) {
      return {
        stateLabel: "Queued",
        tone: "warning",
      };
    }

    if (includesLifecycleKeyword(normalizedStatus, ["deploy"])) {
      return {
        stateLabel: "Deploying",
        tone: "info",
      };
    }

    if (includesLifecycleKeyword(normalizedStatus, ["build", "import"])) {
      return {
        stateLabel: "Building",
        tone: "info",
      };
    }

    if (normalizedStatus.includes("running")) {
      return {
        stateLabel: "Updating",
        tone: "info",
      };
    }
  }

  const normalizedPhase = phase?.trim().toLowerCase() ?? "";

  if (
    includesLifecycleKeyword(normalizedPhase, [
      "queued",
      "pending",
      "migrating",
    ])
  ) {
    return {
      stateLabel: "Queued",
      tone: "warning",
    };
  }

  if (includesLifecycleKeyword(normalizedPhase, ["deploying"])) {
    return {
      stateLabel: "Deploying",
      tone: "info",
    };
  }

  if (includesLifecycleKeyword(normalizedPhase, ["importing", "building"])) {
    return {
      stateLabel: "Building",
      tone: "info",
    };
  }

  if (hasActiveStatus) {
    return {
      stateLabel: humanizeUiLabel(operationStatus),
      tone: "info",
    };
  }

  return {
    stateLabel: "Building",
    tone: "info",
  };
}

function buildPendingCommitHint(
  app: ConsoleGalleryAppView,
  options?: {
    committedAt?: string | null;
    exact?: string | null;
    label?: string | null;
    operationId?: string | null;
    operationStatus?: string | null;
  },
): ConsoleGalleryCommitView | null {
  if (!isGitHubTrackedApp(app) || hasPendingCommitView(app)) {
    return null;
  }

  const runningCommit = app.commitViews.find(
    (commit) => commit.kind === "running",
  );

  if (
    !runningCommit?.exact &&
    runningCommit?.label === "Pending first import"
  ) {
    return null;
  }

  const exact = options?.exact?.trim() || null;
  const label =
    options?.label?.trim() ||
    (exact ? (exact.length > 8 ? exact.slice(0, 8) : exact) : "Pending sync");
  const state = readPendingCommitState(app.phase, options?.operationStatus);

  return {
    committedAt: options?.committedAt?.trim() || null,
    exact,
    href: readGitHubCommitHref(app.sourceHref, exact),
    id: `pending-hint:${app.id}:${options?.operationId?.trim() || exact || label.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "pending",
    label,
    stateLabel: state.stateLabel,
    tone: state.tone,
  };
}

function inferPendingCommitHint(
  app: ConsoleGalleryAppView,
  buildLogs?: BuildLogsResponse | null,
) {
  const buildActive = hasActiveBuildLogsOperation(buildLogs);
  const phaseActive = hasInFlightCommitPhase(app.phase);

  if (!buildActive && !phaseActive) {
    return null;
  }

  const parsedCommit = parsePendingCommitFromBuildJobName(buildLogs?.jobName);

  return buildPendingCommitHint(app, {
    committedAt: buildLogs?.startedAt ?? null,
    exact: parsedCommit?.exact,
    label: parsedCommit?.label,
    operationId: buildLogs?.operationId,
    operationStatus: buildLogs?.operationStatus,
  });
}

function readDisplayedCommitView(
  app: ConsoleGalleryAppView,
  pendingCommitHint?: ConsoleGalleryCommitView | null,
) {
  if (app.serviceRole === "pending") {
    return (
      app.commitViews.find((commit) => commit.kind === "pending") ??
      pendingCommitHint ??
      app.commitViews[0] ??
      null
    );
  }

  return (
    app.commitViews.find((commit) => commit.kind === "running") ??
    app.commitViews[0] ??
    null
  );
}

function LocalDateTimeNote({
  className,
  prefix,
  value,
}: {
  className?: string;
  prefix?: string;
  value?: string | null;
}) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setFormatted(null);
      return;
    }

    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      setFormatted(null);
      return;
    }

    setFormatted(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(timestamp),
    );
  }, [value]);

  if (!formatted || !value) {
    return null;
  }

  return (
    <time className={className} dateTime={value} title={formatted}>
      {prefix ? `${prefix} ${formatted}` : formatted}
    </time>
  );
}

function renderCommitText(
  app: ConsoleGalleryAppView,
  pendingCommitHint?: ConsoleGalleryCommitView | null,
) {
  const commit = readDisplayedCommitView(app, pendingCommitHint);

  if (!commit) {
    return <span>—</span>;
  }

  return (
    <span className="fg-project-inspector__commit-list">
      <span className="fg-project-inspector__commit-entry" key={commit.id}>
        <span className="fg-project-inspector__commit-row">
          {renderCommitLink(commit)}
          <LocalDateTimeNote
            className="fg-project-inspector__meta-note"
            value={commit.committedAt}
          />
        </span>
      </span>
    </span>
  );
}

function readRuntimeLogsUnavailableState(
  app: ConsoleGalleryAppView | null,
  logsMode: LogsView,
): RuntimeLogsUnavailableState | null {
  if (!app || logsMode !== "runtime") {
    return null;
  }

  const phase = app.phase.trim().toLowerCase();

  if (includesLifecycleKeyword(phase, ["importing"])) {
    return {
      description:
        "Import is still running. Switch to Build to follow progress.",
      label: "Waiting for import",
      title: "Runtime logs are not ready",
    };
  }

  if (includesLifecycleKeyword(phase, ["building"])) {
    return {
      description:
        "Build is still running. Switch to Build to follow progress.",
      label: "Waiting for first start",
      title: "Runtime logs are not ready",
    };
  }

  if (
    includesLifecycleKeyword(phase, [
      "transfer",
      "transferring",
      "failing-over",
      "migrating",
    ])
  ) {
    return {
      description:
        "The destination runtime is still preparing. Runtime logs switch over once the transfer is live.",
      label: "Transfer in progress",
      title: "Runtime logs are not ready",
    };
  }

  if (includesLifecycleKeyword(phase, ["queued", "pending"])) {
    return {
      description:
        "This rollout has not reached a live runtime yet. Switch to Build to follow progress.",
      label: "Waiting in queue",
      title: "Runtime logs are not ready",
    };
  }

  if (isPausedAppService(app)) {
    return {
      description:
        "This app is paused. Start it to reopen runtime logs without rebuilding, or use Redeploy for a fresh build.",
      label: "Paused",
      title: "Runtime logs are unavailable",
    };
  }

  return null;
}

function readLogsStatusMessage(
  logsStatus: "error" | "idle" | "loading" | "ready",
  connectionState: LogsConnectionState,
) {
  if (
    logsStatus === "loading" ||
    (logsStatus === "idle" && connectionState === "idle")
  ) {
    if (connectionState === "snapshot") {
      return "Refreshing recent logs…";
    }

    return connectionState === "reconnecting"
      ? "Reconnecting to live logs…"
      : "Connecting to live logs…";
  }

  if (logsStatus === "error") {
    return "Unable to open the log stream.";
  }

  if (connectionState === "live" || connectionState === "reconnecting") {
    return "Waiting for log output…";
  }

  if (connectionState === "snapshot") {
    return "Showing refreshed log snapshots…";
  }

  if (connectionState === "ended") {
    return "No log lines were received before the stream closed.";
  }

  return "No logs available.";
}

function shouldShowLogsLoadingPlaceholder(
  logsStatus: "error" | "idle" | "loading" | "ready",
  connectionState: LogsConnectionState,
) {
  if (logsStatus === "error" || connectionState === "ended") {
    return false;
  }

  return (
    logsStatus === "loading" ||
    connectionState === "connecting" ||
    connectionState === "reconnecting" ||
    connectionState === "live" ||
    connectionState === "idle"
  );
}

function renderAnsiLogBody(value: string) {
  const segments = parseAnsiText(value);

  if (!segments.length) {
    return null;
  }

  return segments.map((segment, index) => (
    <span
      className={cx(
        "fg-log-output__segment",
        segment.bold && "is-bold",
        segment.dim && "is-dim",
        segment.italic && "is-italic",
        segment.underline && "is-underlined",
      )}
      data-ansi-tone={segment.tone ?? undefined}
      key={`${index}:${segment.text.slice(0, 24)}`}
      style={segment.color ? { color: segment.color } : undefined}
    >
      {segment.text}
    </span>
  ));
}

function readPlainLogBody(value: string) {
  return parseAnsiText(value)
    .map((segment) => segment.text)
    .join("");
}

type ConsoleLogsPanelProps = {
  effectiveLogsMode: LogsView;
  externalRefreshToken: number;
  onLogsModeChange: (nextMode: LogsView) => void;
  onPendingCommitHintChange: (nextValue: ConsoleGalleryCommitView | null) => void;
  runtimeLogsUnavailable: RuntimeLogsUnavailableState | null;
  selectedApp: ConsoleGalleryAppView;
  selectedAppNeedsPendingCommitHint: boolean;
  selectedService: ConsoleGalleryServiceView;
  selectedServiceApp: ConsoleGalleryAppView | null;
  selectedServiceLogViewOptions: readonly SegmentedControlOption<LogsView>[];
};

function ConsoleLogsPanel({
  effectiveLogsMode,
  externalRefreshToken,
  onLogsModeChange,
  onPendingCommitHintChange,
  runtimeLogsUnavailable,
  selectedApp,
  selectedAppNeedsPendingCommitHint,
  selectedService,
  selectedServiceApp,
  selectedServiceLogViewOptions,
}: ConsoleLogsPanelProps) {
  const { showToast } = useToast();
  const [logsConnectionState, setLogsConnectionState] =
    useState<LogsConnectionState>("idle");
  const [logsStatus, setLogsStatus] = useState<
    "error" | "idle" | "loading" | "ready"
  >("idle");
  const [logsErrorMessage, setLogsErrorMessage] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const deferredLogLines = useDeferredValue(logLines);
  const [logsCopyState, setLogsCopyState] = useState<
    "copied" | "idle" | "pending"
  >("idle");
  const [buildLogsOperationStatus, setBuildLogsOperationStatus] = useState<
    string | null
  >(null);
  const [manualRefreshToken, setManualRefreshToken] = useState(0);
  const logsAutoFollowRef = useRef(true);
  const logsCopyResetRef = useRef<number | null>(null);
  const logsViewportRef = useRef<HTMLPreElement | null>(null);
  const logsFlushFrameRef = useRef<number | null>(null);
  const logLinesRef = useRef<string[]>([]);
  const lastRenderedSourceIdRef = useRef<string | null>(null);
  const selectedServiceBuildLogsOperationId =
    selectedService.kind === "app"
      ? selectedService.buildLogsOperationId?.trim() || null
      : null;
  const logsRequestKey = `${serviceKey(selectedService)}:${effectiveLogsMode}:${effectiveLogsMode === "build" ? (selectedServiceBuildLogsOperationId ?? "latest") : "live"}`;
  const logsStreamInput =
    selectedService.kind === "backing-service"
      ? `/api/fugue/apps/${selectedApp.id}/runtime-logs/stream?component=postgres&follow=true&tail_lines=${LOG_TAIL_LINES}`
      : effectiveLogsMode === "build"
        ? `/api/fugue/apps/${selectedApp.id}/build-logs/stream?${new URLSearchParams(
            {
              ...(selectedServiceBuildLogsOperationId
                ? { operation_id: selectedServiceBuildLogsOperationId }
                : {}),
              follow: "true",
              tail_lines: String(LOG_TAIL_LINES),
            },
          ).toString()}`
        : `/api/fugue/apps/${selectedApp.id}/runtime-logs/stream?component=app&follow=true&tail_lines=${LOG_TAIL_LINES}`;
  const runtimeLogsSnapshotInput =
    selectedService.kind === "backing-service"
      ? `/api/fugue/apps/${selectedApp.id}/runtime-logs?component=postgres&tail_lines=${LOG_TAIL_LINES}`
      : `/api/fugue/apps/${selectedApp.id}/runtime-logs?component=app&tail_lines=${LOG_TAIL_LINES}`;
  const runtimeLogsUnavailableKey = runtimeLogsUnavailable
    ? `${selectedApp.id}:${runtimeLogsUnavailable.label}`
    : null;
  const logsBody = joinLogLines(deferredLogLines);
  const logsStatusMessage = readLogsStatusMessage(logsStatus, logsConnectionState);
  const hasBufferedLogOutput = logLines.length > 0;
  const showLogsPlaceholder = !logsBody;
  const showLogsLoadingPlaceholder =
    showLogsPlaceholder &&
    shouldShowLogsLoadingPlaceholder(logsStatus, logsConnectionState);
  const canCopyLogs =
    !runtimeLogsUnavailable && logLinesRef.current.length > 0;
  const logsStreamLabel = humanizeUiLabel(effectiveLogsMode).toLowerCase();
  const logsRefreshStateLabel = runtimeLogsUnavailable
    ? runtimeLogsUnavailable.label
    : logsConnectionState === "connecting"
      ? "Connecting"
      : logsConnectionState === "reconnecting"
        ? "Reconnecting"
        : logsConnectionState === "snapshot"
          ? "Snapshot"
        : logsConnectionState === "live"
          ? "Live"
          : logsConnectionState === "ended"
            ? effectiveLogsMode === "build" && buildLogsOperationStatus
              ? humanizeUiLabel(buildLogsOperationStatus)
              : "Ended"
            : logsConnectionState === "error"
              ? "Error"
              : "Idle";
  const logsRefreshStateDetail = runtimeLogsUnavailable
    ? null
    : logsConnectionState === "reconnecting" && hasBufferedLogOutput
      ? "Showing latest output"
      : logsConnectionState === "snapshot"
        ? "Refreshing every 3s"
      : logsConnectionState === "error" && hasBufferedLogOutput
        ? "Last output preserved"
        : logsConnectionState === "ended" && hasBufferedLogOutput
          ? "Showing latest snapshot"
          : null;
  const logsPanelNote = runtimeLogsUnavailable
    ? runtimeLogsUnavailable.description
    : logsConnectionState === "reconnecting"
      ? hasBufferedLogOutput
        ? `Connection dropped. Reconnecting to ${logsStreamLabel} output. Showing the latest received output.`
        : `Connection dropped. Reconnecting to ${logsStreamLabel} output.`
      : logsConnectionState === "snapshot"
        ? hasBufferedLogOutput
          ? `The live ${logsStreamLabel} stream is delayed at the edge. Refreshing recent snapshots every 3 seconds.`
          : `The live ${logsStreamLabel} stream is delayed at the edge. Loading recent snapshots instead.`
      : logsConnectionState === "ended"
        ? hasBufferedLogOutput
          ? `${humanizeUiLabel(effectiveLogsMode)} stream closed. Showing latest snapshot. Refresh to reopen the stream.`
          : `${humanizeUiLabel(effectiveLogsMode)} stream closed. Refresh to reopen the stream.`
        : logsConnectionState === "error"
          ? hasBufferedLogOutput
            ? `${logsErrorMessage ?? `Unable to open the ${logsStreamLabel} stream.`} Showing the latest received output. Refresh to try again.`
            : `${logsErrorMessage ?? `Unable to open the ${logsStreamLabel} stream.`} Refresh to try again.`
          : logsConnectionState === "connecting"
            ? `Opening live ${logsStreamLabel} output for ${selectedService.name}.`
            : `Live ${logsStreamLabel} output for ${selectedService.name}.`;
  const logsPanelNoteRole: "alert" | "status" | undefined =
    runtimeLogsUnavailable ||
    logsConnectionState === "idle" ||
    logsConnectionState === "live"
      ? undefined
      : logsConnectionState === "error"
        ? "alert"
        : "status";
  const logsPanelNoteLive = logsPanelNoteRole
    ? logsConnectionState === "error"
      ? "assertive"
      : "polite"
    : undefined;
  const syncPendingCommitHint = useEffectEvent(
    (buildStatus: BuildLogStreamStatus | null) => {
      if (effectiveLogsMode !== "build") {
        return;
      }

      onPendingCommitHintChange(
        selectedServiceApp && selectedAppNeedsPendingCommitHint
          ? inferPendingCommitHint(
              selectedServiceApp,
              buildStatus ? buildLogsResponseFromStatus(buildStatus) : null,
            )
          : null,
      );
    },
  );
  const isRetryableStreamError = useEffectEvent((error: unknown) =>
    isRetryableLogStreamError(error, effectiveLogsMode, selectedServiceApp),
  );

  function cancelScheduledLogCommit() {
    if (logsFlushFrameRef.current !== null) {
      window.cancelAnimationFrame(logsFlushFrameRef.current);
      logsFlushFrameRef.current = null;
    }
  }

  function scheduleLogCommit() {
    if (logsFlushFrameRef.current !== null) {
      return;
    }

    logsFlushFrameRef.current = window.requestAnimationFrame(() => {
      logsFlushFrameRef.current = null;
      startTransition(() => {
        setLogLines([...logLinesRef.current]);
      });
    });
  }

  function resetLogBuffer() {
    cancelScheduledLogCommit();
    logLinesRef.current = [];
    lastRenderedSourceIdRef.current = null;
    setLogLines([]);
  }

  function replaceLogBuffer(nextLines: string[]) {
    cancelScheduledLogCommit();
    logLinesRef.current = [...nextLines];
    lastRenderedSourceIdRef.current = null;
    startTransition(() => {
      setLogLines([...nextLines]);
    });
  }

  function clearLogsCopyResetTimer() {
    if (logsCopyResetRef.current !== null) {
      window.clearTimeout(logsCopyResetRef.current);
      logsCopyResetRef.current = null;
    }
  }

  function scrollLogsToBottom() {
    const viewport = logsViewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }

  function handleLogsViewportScroll() {
    const viewport = logsViewportRef.current;

    if (!viewport) {
      return;
    }

    logsAutoFollowRef.current = isLogViewportNearBottom(viewport);
  }

  function refreshLogs() {
    setManualRefreshToken((value) => value + 1);
  }

  async function handleCopyLogs() {
    if (!canCopyLogs || logsCopyState === "pending") {
      return;
    }

    clearLogsCopyResetTimer();
    setLogsCopyState("pending");

    try {
      const plainLogsBody = readPlainLogBody(joinLogLines(logLinesRef.current));

      if (!plainLogsBody.trim()) {
        setLogsCopyState("idle");
        return;
      }

      const copied = await copyText(plainLogsBody);

      if (!copied) {
        setLogsCopyState("idle");
        showToast({
          message: `${humanizeUiLabel(effectiveLogsMode)} logs are ready, but clipboard access failed.`,
          variant: "info",
        });
        return;
      }

      setLogsCopyState("copied");
      logsCopyResetRef.current = window.setTimeout(() => {
        setLogsCopyState("idle");
        logsCopyResetRef.current = null;
      }, 1400);
    } catch (error) {
      setLogsCopyState("idle");
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    }
  }

  useEffect(() => {
    logsAutoFollowRef.current = true;
  }, [externalRefreshToken, logsRequestKey, manualRefreshToken]);

  useLayoutEffect(() => {
    if (!logsAutoFollowRef.current) {
      return;
    }

    scrollLogsToBottom();
  }, [deferredLogLines]);

  useEffect(() => {
    setLogsCopyState("idle");
    clearLogsCopyResetTimer();
  }, [externalRefreshToken, logsRequestKey, manualRefreshToken]);

  useEffect(() => {
    return () => {
      clearLogsCopyResetTimer();
      cancelScheduledLogCommit();
    };
  }, []);

  useEffect(() => {
    if (runtimeLogsUnavailable) {
      resetLogBuffer();
      setLogsConnectionState("idle");
      setLogsStatus("idle");
      setLogsErrorMessage(null);
      setBuildLogsOperationStatus(null);

      syncPendingCommitHint(null);

      return;
    }

    let cancelled = false;
    let retryDelayMs = LOG_AUTO_REFRESH_INTERVAL_MS;
    let reconnectTimer: number | null = null;
    let runtimeSnapshotTimer: number | null = null;
    let activeController: AbortController | null = null;
    let snapshotController: AbortController | null = null;
    let latestCursor = "";
    let streamEnded = false;
    let firstEventTimeout: number | null = null;
    let usingRuntimeSnapshotFallback = false;

    function clearReconnectTimer() {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function clearRuntimeSnapshotTimer() {
      if (runtimeSnapshotTimer !== null) {
        window.clearTimeout(runtimeSnapshotTimer);
        runtimeSnapshotTimer = null;
      }
    }

    function clearFirstEventTimeout() {
      if (firstEventTimeout !== null) {
        window.clearTimeout(firstEventTimeout);
        firstEventTimeout = null;
      }
    }

    function clearSnapshotController() {
      snapshotController?.abort();
      snapshotController = null;
    }

    async function pollRuntimeLogSnapshot() {
      if (cancelled || effectiveLogsMode !== "runtime") {
        return;
      }

      clearRuntimeSnapshotTimer();
      clearSnapshotController();
      snapshotController = new AbortController();

      try {
        const snapshot = await requestJson<RuntimeLogsResponse>(
          runtimeLogsSnapshotInput,
          {
            cache: "no-store",
            signal: snapshotController.signal,
          },
        );

        if (cancelled || snapshotController.signal.aborted) {
          return;
        }

        replaceLogBuffer(buildRuntimeLogSnapshotLines(snapshot));
        setLogsConnectionState("snapshot");
        setLogsStatus("ready");
        setLogsErrorMessage(null);
      } catch (error) {
        if (
          cancelled ||
          snapshotController?.signal.aborted ||
          isAbortRequestError(error)
        ) {
          return;
        }

        setLogsConnectionState("error");
        setLogsStatus("error");
        setLogsErrorMessage(readLogStreamErrorMessage(error, effectiveLogsMode));
        return;
      }

      runtimeSnapshotTimer = window.setTimeout(() => {
        void pollRuntimeLogSnapshot();
      }, LOG_AUTO_REFRESH_INTERVAL_MS);
    }

    function startRuntimeSnapshotFallback() {
      if (
        cancelled ||
        usingRuntimeSnapshotFallback ||
        effectiveLogsMode !== "runtime"
      ) {
        return;
      }

      usingRuntimeSnapshotFallback = true;
      clearReconnectTimer();
      clearFirstEventTimeout();
      activeController?.abort();
      setLogsConnectionState("snapshot");
      setLogsStatus((current) => (current === "ready" ? "ready" : "loading"));
      setLogsErrorMessage(null);
      void pollRuntimeLogSnapshot();
    }

    function scheduleReconnect() {
      if (cancelled || streamEnded || usingRuntimeSnapshotFallback) {
        return;
      }

      clearReconnectTimer();
      setLogsConnectionState("reconnecting");
      setLogsStatus((current) => (current === "ready" ? "ready" : "loading"));
      reconnectTimer = window.setTimeout(() => {
        void openStream("reconnect");
      }, retryDelayMs);
    }

    async function openStream(mode: "initial" | "reconnect") {
      if (cancelled) {
        return;
      }

      clearReconnectTimer();
      clearRuntimeSnapshotTimer();
      clearFirstEventTimeout();
      clearSnapshotController();
      activeController?.abort();
      activeController = new AbortController();
      streamEnded = false;
      usingRuntimeSnapshotFallback = false;

      if (mode === "initial") {
        latestCursor = "";
        resetLogBuffer();
        setLogsStatus("loading");
        setLogsConnectionState("connecting");
        setLogsErrorMessage(null);
        setBuildLogsOperationStatus(null);
        syncPendingCommitHint(null);
      } else {
        setLogsConnectionState("reconnecting");
        setLogsStatus((current) => (current === "ready" ? "ready" : "loading"));
      }

      const streamUrl =
        mode === "reconnect" && latestCursor
          ? `${logsStreamInput}&cursor=${encodeURIComponent(latestCursor)}`
          : logsStreamInput;

      try {
        const response = await fetch(streamUrl, {
          cache: "no-store",
          headers: {
            Accept: "text/event-stream",
          },
          signal: activeController.signal,
        });

        if (!response.ok) {
          throw new LogStreamRequestError(
            response.status,
            await readResponseError(response),
          );
        }

        if (!response.body) {
          throw new Error("Streaming response body is unavailable.");
        }

        if (effectiveLogsMode === "runtime") {
          firstEventTimeout = window.setTimeout(() => {
            startRuntimeSnapshotFallback();
          }, LOG_STREAM_FIRST_EVENT_TIMEOUT_MS);
        }

        await consumeSSEStream(response, {
          onRetry(milliseconds) {
            if (milliseconds > 0) {
              retryDelayMs = milliseconds;
            }
          },
          onEvent(event) {
            clearFirstEventTimeout();

            if (event.id) {
              latestCursor = event.id;
            }

            switch (event.event) {
              case "ready":
                setLogsConnectionState("live");
                setLogsStatus("ready");
                setLogsErrorMessage(null);
                return;
              case "status": {
                const status = parseBuildLogStreamStatus(event);

                if (!status) {
                  return;
                }

                if (status.cursor) {
                  latestCursor = status.cursor;
                }

                setLogsConnectionState("live");
                setLogsStatus("ready");
                setLogsErrorMessage(null);
                setBuildLogsOperationStatus(status.operationStatus ?? null);
                syncPendingCommitHint(status);
                return;
              }
              case "state": {
                const state = parseRuntimeLogStreamState(event);

                if (!state) {
                  return;
                }

                if (state.cursor) {
                  latestCursor = state.cursor;
                }

                setLogsConnectionState("live");
                setLogsStatus("ready");
                setLogsErrorMessage(null);
                return;
              }
              case "log": {
                const logLine = parseLogStreamLogLine(event);

                if (!logLine) {
                  return;
                }

                if (logLine.cursor) {
                  latestCursor = logLine.cursor;
                }

                setLogsConnectionState("live");
                setLogsStatus("ready");
                setLogsErrorMessage(null);
                lastRenderedSourceIdRef.current = appendLogLine(
                  logLinesRef.current,
                  logLine.line,
                  logLine.source,
                  lastRenderedSourceIdRef.current,
                ).sourceId;
                scheduleLogCommit();
                return;
              }
              case "warning": {
                const warning = parseLogStreamWarning(event);

                if (!warning) {
                  return;
                }

                if (warning.cursor) {
                  latestCursor = warning.cursor;
                }

                setLogsConnectionState("live");
                setLogsStatus("ready");
                setLogsErrorMessage(null);
                lastRenderedSourceIdRef.current = appendLogWarning(
                  logLinesRef.current,
                  warning,
                  lastRenderedSourceIdRef.current,
                ).sourceId;
                scheduleLogCommit();
                return;
              }
              case "heartbeat":
                setLogsConnectionState("live");
                setLogsStatus("ready");
                setLogsErrorMessage(null);
                return;
              case "end": {
                const endEvent = parseLogStreamEnd(event);

                if (endEvent?.cursor) {
                  latestCursor = endEvent.cursor;
                }

                if (endEvent?.operationStatus) {
                  setBuildLogsOperationStatus(endEvent.operationStatus);
                }

                streamEnded = true;
                setLogsConnectionState("ended");
                setLogsStatus("ready");
                return;
              }
              default:
                return;
            }
          },
        });

        clearFirstEventTimeout();

        if (
          cancelled ||
          activeController.signal.aborted ||
          streamEnded ||
          usingRuntimeSnapshotFallback
        ) {
          return;
        }

        scheduleReconnect();
      } catch (error) {
        clearFirstEventTimeout();

        if (cancelled || activeController?.signal.aborted) {
          return;
        }

        if (
          !isRetryableStreamError(error)
        ) {
          syncPendingCommitHint(null);
          setLogsConnectionState("error");
          setLogsStatus("error");
          setLogsErrorMessage(
            readLogStreamErrorMessage(error, effectiveLogsMode),
          );
          return;
        }

        scheduleReconnect();
      }
    }

    void openStream("initial");

    return () => {
      cancelled = true;
      clearReconnectTimer();
      clearRuntimeSnapshotTimer();
      clearFirstEventTimeout();
      clearSnapshotController();
      activeController?.abort();
    };
  }, [
    effectiveLogsMode,
    externalRefreshToken,
    logsRequestKey,
    logsStreamInput,
    manualRefreshToken,
    runtimeLogsSnapshotInput,
    runtimeLogsUnavailableKey,
  ]);

  return (
    <div className="fg-workbench-section">
      <div className="fg-workbench-section__head">
        <div className="fg-workbench-section__copy">
          <p className="fg-label fg-panel__eyebrow">Logs</p>
          <p
            aria-live={logsPanelNoteLive}
            className="fg-console-note"
            role={logsPanelNoteRole}
          >
            {logsPanelNote}
          </p>
        </div>

        <div className="fg-workbench-section__actions">
          {selectedService.kind === "app" ? (
            <SegmentedControl
              ariaLabel="Log views"
              controlClassName="fg-console-nav"
              itemClassName="fg-console-nav__link"
              labelClassName="fg-console-nav__title"
              onChange={onLogsModeChange}
              options={selectedServiceLogViewOptions}
              value={effectiveLogsMode}
              variant="pill"
            />
          ) : null}

          <Button
            disabled={!canCopyLogs}
            loading={logsCopyState === "pending"}
            loadingLabel="Copying…"
            onClick={() => {
              void handleCopyLogs();
            }}
            size="compact"
            type="button"
            variant="secondary"
          >
            {logsCopyState === "copied" ? "Copied" : "Copy logs"}
          </Button>
          <Button
            onClick={refreshLogs}
            size="compact"
            type="button"
            variant="secondary"
          >
            Refresh now
          </Button>
        </div>
      </div>

      <ProofShell>
        <ProofShellRibbon>
          <span>{logsRefreshStateLabel}</span>
          {logsRefreshStateDetail ? <span>{logsRefreshStateDetail}</span> : null}
        </ProofShellRibbon>
        {runtimeLogsUnavailable ? (
          <ProofShellEmpty
            description={runtimeLogsUnavailable.description}
            title={runtimeLogsUnavailable.title}
          />
        ) : (
          <pre
            aria-busy={showLogsLoadingPlaceholder || undefined}
            aria-label={`${humanizeUiLabel(effectiveLogsMode)} logs for ${selectedService.name}`}
            aria-relevant={showLogsPlaceholder ? undefined : "additions text"}
            className={cx(
              "fg-log-output__viewport",
              showLogsPlaceholder && "is-placeholder",
            )}
            onScroll={handleLogsViewportScroll}
            ref={logsViewportRef}
            role={showLogsPlaceholder ? undefined : "log"}
          >
            <code
              className={cx(
                "fg-log-output",
                showLogsPlaceholder && "is-placeholder",
              )}
            >
              {showLogsPlaceholder ? (
                <span
                  aria-live={logsStatus === "error" ? "assertive" : "polite"}
                  className="fg-log-output__placeholder"
                  role={logsStatus === "error" ? "alert" : "status"}
                >
                  {showLogsLoadingPlaceholder ? (
                    <span
                      aria-hidden="true"
                      className="fg-log-output__spinner"
                    />
                  ) : null}
                  <span className="fg-log-output__placeholder-label">
                    {logsStatusMessage}
                  </span>
                </span>
              ) : (
                renderAnsiLogBody(logsBody)
              )}
            </code>
          </pre>
        )}
      </ProofShell>
    </div>
  );
}

function ProjectBadge({
  kind,
  label,
  meta,
}: {
  kind: ConsoleGalleryBadgeKind;
  label: string;
  meta: string;
}) {
  return (
    <div
      aria-label={`${label} / ${meta}`}
      className="fg-project-badge"
      data-kind={kind}
      role="img"
      title={`${label} / ${meta}`}
    >
      <span className="fg-project-badge__glyph">
        <TechStackLogo kind={kind} />
      </span>
      <span className="fg-project-badge__sr">{label}</span>
    </div>
  );
}

function projectTitle(project: ConsoleGalleryProjectView) {
  return `${project.appCount} app${project.appCount === 1 ? "" : "s"} · ${project.serviceCount} service${project.serviceCount === 1 ? "" : "s"}`;
}

function EnvironmentVariableTable({
  rows,
  onRemoveRow,
  onUpdateRow,
}: {
  rows: EnvRow[];
  onRemoveRow: (rowId: string) => void;
  onUpdateRow: (
    rowId: string,
    field: "key" | "value",
    value: string,
  ) => void;
}) {
  if (!rows.length) {
    return (
      <p className="fg-console-note">
        No environment variables yet. Add one manually or switch to Raw to
        paste a .env block.
      </p>
    );
  }

  return (
    <>
      <div aria-hidden="true" className="fg-env-table__head">
        <span>Key</span>
        <span>Value</span>
        <span>Action</span>
      </div>
      {rows.map((row, index) => {
        const rowTitle = row.key || row.originalKey || "New variable";
        const rowIndexLabel = `Variable ${index + 1}`;
        const actionLabel = row.existing
          ? row.removed
            ? "Undo"
            : "Remove"
          : "Discard";
        const actionAriaLabel = row.existing
          ? row.removed
            ? `${rowTitle} undo removal`
            : `${rowTitle} remove variable`
          : `${rowTitle} discard variable`;

        return (
          <div
            className={cx("fg-env-row", row.removed && "is-removed")}
            key={row.id}
          >
            <div aria-hidden="true" className="fg-env-row__header">
              <div className="fg-env-row__identity">
                <p className="fg-env-row__eyebrow">{rowIndexLabel}</p>
                <p className="fg-env-row__title">{rowTitle}</p>
              </div>
            </div>
            <label className="fg-env-row__field fg-env-row__field--key">
              <span className="fg-env-row__field-label">Variable name</span>
              <input
                aria-label={`${row.key || row.originalKey || "New variable"} Key`}
                autoCapitalize="off"
                autoCorrect="off"
                className="fg-input"
                disabled={row.removed}
                onChange={(event) =>
                  onUpdateRow(row.id, "key", event.target.value)
                }
                placeholder="Name"
                spellCheck={false}
                value={row.key}
              />
            </label>
            <label className="fg-env-row__field fg-env-row__field--value">
              <span className="fg-env-row__field-label">Value</span>
              <input
                aria-label={`${row.key || row.originalKey || "New variable"} Value`}
                autoCapitalize="off"
                autoCorrect="off"
                className="fg-input"
                disabled={row.removed}
                onChange={(event) =>
                  onUpdateRow(row.id, "value", event.target.value)
                }
                placeholder="Value"
                spellCheck={false}
                value={row.value}
              />
            </label>
            <div className="fg-env-row__action">
              <Button
                aria-label={actionAriaLabel}
                onClick={() => onRemoveRow(row.id)}
                type="button"
                variant="ghost"
              >
                {actionLabel}
              </Button>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function ConsoleProjectGallery({
  initialData,
  defaultCreateOpen = false,
}: {
  initialData: ConsoleProjectGalleryData;
  defaultCreateOpen?: boolean;
}) {
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [data, setData] = useState(initialData);
  const [projectImageUsageByProjectId, setProjectImageUsageByProjectId] =
    useState<Record<string, ProjectImageUsageSummary>>(() =>
      buildProjectImageUsageMap(readCachedProjectImageUsage() ?? []),
    );
  const [createOpen, setCreateOpen] = useState(defaultCreateOpen);
  const [createTargetProject, setCreateTargetProject] =
    useState<CreateDialogTarget | null>(null);
  const [projectName, setProjectName] = useState(
    buildSuggestedProjectName(initialData.projects),
  );
  const [importDraft, setImportDraft] = useState<ImportServiceDraft>(() =>
    createImportServiceDraft(
      readDefaultImportRuntimeId(initialData.runtimeTargets),
    ),
  );
  const [localUpload, setLocalUpload] = useState<LocalUploadState>(() =>
    createLocalUploadState(),
  );
  const [importCapabilities, setImportCapabilities] = useState({
    persistentStorageSupported: true,
    startupCommandSupported: true,
  });
  const {
    connectHref: githubConnectHref,
    connection: githubConnection,
    error: githubConnectionError,
    loading: githubConnectionLoading,
  } = useGitHubConnection({
    enabled: createOpen,
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedServiceKey, setSelectedServiceKey] = useState<string | null>(
    null,
  );
  const [selectedAppPendingCommitHint, setSelectedAppPendingCommitHint] =
    useState<ConsoleGalleryCommitView | null>(null);
  const [activeTab, setActiveTab] = useState<WorkbenchView>("env");
  const [isCreating, setIsCreating] = useState(false);
  const [busyAction, setBusyAction] = useState<AppAction | null>(null);
  const [busyProjectAction, setBusyProjectAction] =
    useState<ProjectAction | null>(null);
  const [envFormat, setEnvFormat] = useState<EnvironmentFormat>("table");
  const [envStatus, setEnvStatus] = useState<
    "error" | "idle" | "loading" | "ready"
  >("idle");
  const [envBaseline, setEnvBaseline] = useState<Record<string, string>>({});
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [envRawDraft, setEnvRawDraft] = useState("");
  const [envRawFeedback, setEnvRawFeedback] = useState<EnvRawFeedback>(
    createDefaultEnvRawFeedback,
  );
  const [envSaving, setEnvSaving] = useState(false);
  const [logsMode, setLogsMode] = useState<LogsView>("build");
  const [logsResetSignal, setLogsResetSignal] = useState(0);
  const [refreshWindowUntil, setRefreshWindowUntil] = useState(0);
  const galleryRefreshAbortRef = useRef<AbortController | null>(null);
  const galleryRefreshPendingRef = useRef(false);
  const pendingCommitHintRequestPendingRef = useRef(false);
  const { markAppDeleting, optimisticProjects } =
    useOptimisticDeletingProjects(data.projects);

  const selectedProject =
    optimisticProjects.find((project) => project.id === selectedProjectId) ??
    null;
  const selectedProjectServices = selectedProject?.services ?? [];
  const selectedProjectApps = selectedProject
    ? projectApps(selectedProject)
    : [];
  const selectedService =
    selectedProjectServices.find(
      (service) => serviceKey(service) === selectedServiceKey,
    ) ??
    readPreferredProjectService(selectedProjectServices) ??
    null;
  const selectedServiceApp =
    selectedService?.kind === "app" ? selectedService : null;
  const selectedApp =
    selectedServiceApp ??
    (selectedService?.kind === "backing-service"
      ? (selectedProjectApps.find(
          (app) => app.id === selectedService.ownerAppId,
        ) ??
        selectedProjectApps.find((app) => app.id === selectedAppId) ??
        selectedProjectApps[0] ??
        null)
      : (selectedProjectApps.find((app) => app.id === selectedAppId) ??
        selectedProjectApps[0] ??
        null));
  const selectedServiceWorkbenchOptions =
    readServiceWorkbenchOptions(selectedService);
  const selectedServiceLogViewOptions = readServiceLogViewOptions(
    selectedService,
    selectedProjectServices,
  );
  const effectiveLogsMode = normalizeLogsModeForService(
    selectedService,
    selectedProjectServices,
    logsMode,
  );
  const selectedAppNeedsPendingCommitHint =
    isGitHubTrackedApp(selectedServiceApp) &&
    !hasPendingCommitView(selectedServiceApp);
  const selectedAppUsesBuildLogStream =
    selectedServiceApp !== null &&
    activeTab === "logs" &&
    effectiveLogsMode === "build";
  const selectedServicePaused = isPausedAppService(selectedServiceApp);
  const selectedServiceFailed = isFailedAppService(selectedServiceApp);
  const selectedServiceLifecycleAction = selectedServicePaused
    ? "start"
    : "restart";
  const selectedServiceCanPause =
    !selectedServicePaused && !selectedServiceFailed;
  const selectedServiceCanForceDelete = canForceDeletePendingService(
    selectedServiceApp,
  );
  const selectedServiceDeleting = isDeletingLifecycleValue(
    selectedServiceApp?.phase,
  );
  const runtimeLogsUnavailable = readRuntimeLogsUnavailableState(
    selectedServiceApp,
    effectiveLogsMode,
  );
  useWorkbenchAnticipatoryWarmup(selectedProjectServices, selectedService);
  const dataErrorMessage = data.errors.length
    ? `Partial Fugue data: ${data.errors.join(" | ")}.`
    : null;
  const dataErrorVariant = data.errors.length >= 3 ? "error" : "info";
  const projectLifecycles = optimisticProjects.map((project) =>
    readProjectLifecycle(project),
  );
  const hasLiveProjects = projectLifecycles.some(
    (lifecycle) => lifecycle.syncMode === "active",
  );
  const hasPassiveSyncProjects = projectLifecycles.some(
    (lifecycle) => lifecycle.syncMode === "passive",
  );
  const projectRefreshIntervalMs =
    hasLiveProjects || refreshWindowUntil > Date.now()
      ? PROJECT_ACTIVE_REFRESH_INTERVAL_MS
      : hasPassiveSyncProjects
        ? PROJECT_PASSIVE_REFRESH_INTERVAL_MS
        : null;
  const isCreateServiceMode = createTargetProject !== null;
  const createDialogEyebrow = isCreateServiceMode
    ? "Add service"
    : "Create project";
  const createDialogTitle = isCreateServiceMode
    ? "Add service"
    : "Create project";
  const createDialogCopy = isCreateServiceMode
    ? importDraft.sourceMode === "github"
      ? `Paste a GitHub repository link for ${createTargetProject.name}. Adjust access or placement only if this service needs it.`
      : importDraft.sourceMode === "local-upload"
        ? `Drop a local folder or source files for ${createTargetProject.name}. Fugue packages them on the server before import.`
      : `Add a published Docker image to ${createTargetProject.name}. Adjust placement only if this service needs it.`
    : "Give the project a name, then point Fugue at the first GitHub repository, local folder, or Docker image.";
  const createDialogSubmitLabel = isCreating
    ? isCreateServiceMode
      ? "Adding…"
      : "Creating…"
    : isCreateServiceMode
      ? "Add service"
      : "Create project";
  const createDialogFormId = "fugue-create-project-form";

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

  const refreshGallery = useEffectEvent(
    async (options?: { silent?: boolean }) => {
      if (galleryRefreshPendingRef.current) {
        return false;
      }

      galleryRefreshPendingRef.current = true;
      const controller = new AbortController();
      galleryRefreshAbortRef.current = controller;

      try {
        const nextData = await requestJson<ConsoleProjectGalleryData>(
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
        return true;
      } catch (error) {
        if (controller.signal.aborted) {
          return false;
        }

        if (!options?.silent) {
          setFlash({
            message: readErrorMessage(error),
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
    if (!dataErrorMessage) {
      return;
    }

    showToast({
      message: dataErrorMessage,
      variant: dataErrorVariant,
    });
  }, [dataErrorMessage, dataErrorVariant, showToast]);

  useEffect(() => {
    galleryRefreshAbortRef.current?.abort();
    galleryRefreshAbortRef.current = null;
    galleryRefreshPendingRef.current = false;

    startTransition(() => {
      setData(initialData);
    });
  }, [initialData]);

  useEffect(() => {
    return () => {
      galleryRefreshAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setImportDraft((current) => ({
      ...current,
      runtimeId:
        current.runtimeId &&
        data.runtimeTargets.some((target) => target.id === current.runtimeId)
          ? current.runtimeId
          : readDefaultImportRuntimeId(data.runtimeTargets),
    }));
  }, [data.runtimeTargets]);

  useEffect(() => {
    if (!createOpen && !isCreating) {
      setProjectName(buildSuggestedProjectName(data.projects));
    }
  }, [createOpen, data.projects, isCreating]);

  useEffect(() => {
    if (!selectedProjectId) {
      if (selectedServiceKey) {
        setSelectedServiceKey(null);
      }
      if (selectedAppId) {
        setSelectedAppId(null);
      }
      return;
    }

    if (!selectedProject) {
      setSelectedProjectId(null);
      setSelectedServiceKey(null);
      setSelectedAppId(null);
      return;
    }

    if (!selectedService) {
      const defaultService = readPreferredProjectService(
        selectedProject.services,
      );

      if (!defaultService) {
        setSelectedAppId(null);
        return;
      }

      setSelectedServiceKey(serviceKey(defaultService));
      setSelectedAppId(
        defaultService.kind === "app"
          ? defaultService.id
          : (defaultService.ownerAppId ?? selectedProjectApps[0]?.id ?? null),
      );
      return;
    }

    if (
      selectedService.kind === "backing-service" &&
      selectedAppId !== selectedService.ownerAppId
    ) {
      setSelectedAppId(
        selectedService.ownerAppId ?? selectedProjectApps[0]?.id ?? null,
      );
    }
  }, [
    selectedAppId,
    selectedProject,
    selectedProjectApps,
    selectedProjectId,
    selectedService,
    selectedServiceKey,
  ]);

  useEffect(() => {
    if (!selectedService) {
      return;
    }

    const defaultTab = readServiceDefaultTab(selectedService);
    const supportsActiveTab = selectedServiceWorkbenchOptions.some(
      (option) => option.value === activeTab,
    );
    const nextLogsMode = normalizeLogsModeForService(
      selectedService,
      selectedProjectServices,
      logsMode,
    );

    if (!supportsActiveTab) {
      setActiveTab(
        selectedServiceWorkbenchOptions.some(
          (option) => option.value === defaultTab,
        )
          ? defaultTab
          : (selectedServiceWorkbenchOptions[0]?.value ?? "logs"),
      );
    }

    if (logsMode !== nextLogsMode) {
      setLogsMode(nextLogsMode);
    }
  }, [
    activeTab,
    logsMode,
    selectedProjectServices,
    selectedService,
    selectedServiceWorkbenchOptions,
  ]);

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
    const handleCreateProjectDialogOpen = () => {
      openCreate();
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
  }, [data.projects.length, data.runtimeTargets]);

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
    if (!selectedServiceApp) {
      setEnvStatus("idle");
      setEnvBaseline({});
      setEnvRows([]);
      setEnvRawDraft("");
      setEnvRawFeedback(createDefaultEnvRawFeedback());
      return;
    }

    const cachedState = readCachedEnvState(selectedServiceApp.id);

    if (cachedState) {
      setEnvBaseline(cachedState.baseline);
      setEnvRows(cachedState.rows);
      setEnvFormat(cachedState.format);
      setEnvRawDraft(cachedState.rawDraft);
      setEnvRawFeedback(cachedState.rawFeedback);
      setEnvStatus("ready");
      return;
    }

    setEnvStatus("idle");
    setEnvBaseline({});
    setEnvRows([]);
    setEnvRawDraft("");
    setEnvRawFeedback(createDefaultEnvRawFeedback());
  }, [selectedServiceApp?.id]);

  useEffect(() => {
    if (!selectedServiceApp || activeTab !== "env") {
      return;
    }

    if (readCachedEnvState(selectedServiceApp.id)) {
      return;
    }

    let cancelled = false;
    setEnvStatus("loading");

    fetchCachedEnvState(selectedServiceApp.id)
      .then((cachedState) => {
        if (cancelled) {
          return;
        }

        setEnvBaseline(cachedState.baseline);
        setEnvRows(cachedState.rows);
        setEnvFormat(cachedState.format);
        setEnvRawDraft(cachedState.rawDraft);
        setEnvRawFeedback(cachedState.rawFeedback);
        setEnvStatus("ready");
      })
      .catch((error) => {
        if (cancelled || isAbortRequestError(error)) {
          return;
        }

        setEnvStatus("error");
        setFlash({
          message: readErrorMessage(error),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedServiceApp]);

  useEffect(() => {
    if (!selectedServiceApp || envStatus !== "ready") {
      return;
    }

    writeCachedEnvState(selectedServiceApp.id, {
      baseline: envBaseline,
      format: envFormat,
      rawDraft: envRawDraft,
      rawFeedback: envRawFeedback,
      rows: envRows,
    });
  }, [
    envBaseline,
    envFormat,
    envRawDraft,
    envRawFeedback,
    envRows,
    envStatus,
    selectedServiceApp,
  ]);

  useEffect(() => {
    pendingCommitHintRequestPendingRef.current = false;
    setSelectedAppPendingCommitHint(null);
  }, [selectedServiceApp?.id, selectedServiceKey]);

  useEffect(() => {
    if (!selectedServiceApp || !selectedAppNeedsPendingCommitHint) {
      pendingCommitHintRequestPendingRef.current = false;
      setSelectedAppPendingCommitHint(null);
      return undefined;
    }

    if (selectedAppUsesBuildLogStream) {
      return undefined;
    }

    const app = selectedServiceApp;
    let cancelled = false;
    let activeController: AbortController | null = null;

    async function refreshPendingCommitHint() {
      if (
        document.visibilityState !== "visible" ||
        pendingCommitHintRequestPendingRef.current
      ) {
        return;
      }

      pendingCommitHintRequestPendingRef.current = true;
      const controller = new AbortController();
      activeController = controller;

      try {
        const buildLogs = await requestJson<BuildLogsResponse>(
          `/api/fugue/apps/${app.id}/build-logs?tail_lines=${PENDING_COMMIT_HINT_TAIL_LINES}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (cancelled) {
          return;
        }

        setSelectedAppPendingCommitHint(inferPendingCommitHint(app, buildLogs));
      } catch {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        setSelectedAppPendingCommitHint(inferPendingCommitHint(app, null));
      } finally {
        if (activeController === controller) {
          activeController = null;
        }

        pendingCommitHintRequestPendingRef.current = false;
      }
    }

    void refreshPendingCommitHint();

    const intervalId = window.setInterval(() => {
      void refreshPendingCommitHint();
    }, LOG_AUTO_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      pendingCommitHintRequestPendingRef.current = false;

      if (activeController) {
        activeController.abort();
      }

      window.clearInterval(intervalId);
    };
  }, [
    selectedServiceApp,
    selectedAppNeedsPendingCommitHint,
    selectedAppUsesBuildLogStream,
  ]);

  useEffect(() => {
    if (!projectRefreshIntervalMs) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const refreshWindowExpired =
        refreshWindowUntil > 0 && refreshWindowUntil <= Date.now();

      if (refreshWindowExpired) {
        setRefreshWindowUntil(0);
        if (!hasLiveProjects && !hasPassiveSyncProjects) {
          return;
        }
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshGallery({ silent: true });
    }, projectRefreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    hasLiveProjects,
    hasPassiveSyncProjects,
    projectRefreshIntervalMs,
    refreshWindowUntil,
    refreshGallery,
  ]);

  function resetCreateForm(nextProjectName: string) {
    setProjectName(nextProjectName);
    setImportDraft(
      createImportServiceDraft(readDefaultImportRuntimeId(data.runtimeTargets)),
    );
    setLocalUpload(createLocalUploadState());
  }

  function armRefreshWindow(durationMs = 90_000) {
    setRefreshWindowUntil(Date.now() + durationMs);
  }

  function syncEnvRawEditor(nextRows: EnvRow[]) {
    setEnvRawDraft(serializeEnvEntries(entriesFromEnvRows(nextRows)));
    setEnvRawFeedback(buildEnvRawFeedback(nextRows));
  }

  function openCreate() {
    setFlash(null);
    setCreateTargetProject(null);
    resetCreateForm(buildSuggestedProjectName(data.projects));
    setCreateOpen(true);
  }

  function openCreateService(project: ConsoleGalleryProjectView) {
    setFlash(null);
    setCreateTargetProject({
      id: project.id,
      name: project.name,
    });
    resetCreateForm(project.name);
    setCreateOpen(true);
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

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreating) {
      return;
    }

    const normalizedProjectName = projectName.trim();

    if (!createTargetProject) {
      if (!normalizedProjectName) {
        setFlash({
          message: "Project name is required when creating a new project.",
          variant: "error",
        });
        return;
      }

      if (findProjectByName(data.projects, normalizedProjectName)) {
        setFlash({
          message: DUPLICATE_PROJECT_NAME_MESSAGE,
          variant: "error",
        });
        return;
      }
    }

    const validationError = validateImportServiceDraft(importDraft, {
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
    setIsCreating(true);

    try {
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

      const response = await requestJson<CreateProjectResponse>(endpoint, requestInit);

      if (response.project?.id) {
        setSelectedProjectId(response.project.id);
      }

      if (response.app?.id) {
        setSelectedAppId(response.app.id);
        setSelectedServiceKey(`app:${response.app.id}:pending`);
      }

      setCreateOpen(false);
      setCreateTargetProject(null);
      armRefreshWindow();
      setFlash({
        message: response.requestInProgress
          ? "Import is already running."
          : createTargetProject
            ? "Service import queued."
            : "Project import queued.",
        variant: "success",
      });
      resetCreateForm(
        createTargetProject
          ? buildSuggestedProjectName(data.projects)
          : buildSuggestedProjectName([
              ...data.projects,
              {
                name: response.project?.name ?? normalizedProjectName,
              },
            ]),
      );
      clearCreateDialogUrl();
      void refreshGallery({ silent: true });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsCreating(false);
    }
  }

  function chooseProject(project: ConsoleGalleryProjectView) {
    if (selectedProjectId === project.id) {
      setSelectedProjectId(null);
      setSelectedServiceKey(null);
      setSelectedAppId(null);
      return;
    }

    const defaultService = readPreferredProjectService(project.services);
    setSelectedProjectId(project.id);
    setSelectedServiceKey(defaultService ? serviceKey(defaultService) : null);
    setSelectedAppId(
      defaultService
        ? defaultService.kind === "app"
          ? defaultService.id
          : (defaultService.ownerAppId ?? projectApps(project)[0]?.id ?? null)
        : null,
    );
    setActiveTab(readServiceDefaultTab(defaultService));
    setLogsMode(readServiceDefaultLogsMode(defaultService, project.services));
  }

  function chooseService(service: ConsoleGalleryServiceView) {
    setSelectedServiceKey(serviceKey(service));
    setSelectedAppId(
      service.kind === "app"
        ? service.id
        : (service.ownerAppId ?? selectedAppId),
    );
    if (readServiceDefaultTab(service) === "logs") {
      setActiveTab("logs");
    }
    setLogsMode(readServiceDefaultLogsMode(service, selectedProjectServices));
  }

  async function handleAppAction(action: AppAction) {
    if (!selectedServiceApp || busyAction) {
      return;
    }

    if (action === "redeploy" && !selectedServiceApp.canRedeploy) {
      setFlash({
        message:
          selectedServiceApp.redeployDisabledReason ??
          "Redeploy is not available for this app.",
        variant: "error",
      });
      return;
    }

    if (action === "delete" || action === "force-delete") {
      const forceDelete = action === "force-delete";
      const confirmed = await confirm({
        confirmLabel: forceDelete
          ? readForceDeleteActionLabel(selectedServiceApp.phase)
          : "Delete service",
        description: forceDelete
          ? `${selectedServiceApp.name} is currently ${selectedServiceApp.phase}. ${readForceDeleteActionDescription(selectedServiceApp.phase)}`
          : `${selectedServiceApp.name} will be queued for deletion from this project.`,
        textConfirmation: {
          hint: (
            <>
              Type{" "}
              <span className="fg-confirm-dialog__match-text">{selectedServiceApp.name}</span>{" "}
              exactly to enable deletion.
            </>
          ),
          label: "Service name",
          matchText: selectedServiceApp.name,
          mismatchMessage: "Enter the service name exactly as shown.",
        },
        title: forceDelete ? "Force delete service?" : "Delete service?",
      });

      if (!confirmed) {
        return;
      }
    }

    const nextAction =
      action === "restart" && isPausedAppService(selectedServiceApp)
        ? "start"
        : action;

    setBusyAction(nextAction);
    setFlash(null);

    try {
      let input = `/api/fugue/apps/${selectedServiceApp.id}`;
      let method = "POST";
      let successMessage = "Request queued.";
      let refreshWindowMs = 45_000;

      switch (nextAction) {
        case "redeploy":
          input = `/api/fugue/apps/${selectedServiceApp.id}/rebuild`;
          successMessage = selectedServiceApp.redeployQueuedMessage;
          refreshWindowMs = 90_000;
          break;
        case "start":
          input = `/api/fugue/apps/${selectedServiceApp.id}/start`;
          successMessage = "Start queued at 1 replica.";
          break;
        case "restart":
          input = `/api/fugue/apps/${selectedServiceApp.id}/restart`;
          successMessage = "Restart queued.";
          break;
        case "disable":
          input = `/api/fugue/apps/${selectedServiceApp.id}/disable`;
          successMessage = "Pause queued.";
          break;
        case "delete":
          method = "DELETE";
          successMessage = "Delete queued.";
          break;
        case "force-delete":
          input = `/api/fugue/apps/${selectedServiceApp.id}?force=true`;
          method = "DELETE";
          successMessage = "Force delete queued.";
          refreshWindowMs = 90_000;
          break;
      }

      const result = await requestJson<DeleteAppActionResult>(input, {
        method,
      });

      if (nextAction === "delete" || nextAction === "force-delete") {
        markAppDeleting(selectedServiceApp.id);
        successMessage = readDeleteActionSuccessMessage(
          nextAction,
          result,
          selectedServiceApp.phase,
        );
      }

      armRefreshWindow(refreshWindowMs);

      if (nextAction === "redeploy") {
        setActiveTab("logs");
        setLogsMode("build");
        setLogsResetSignal((value) => value + 1);
      }

      setFlash({
        message: successMessage,
        variant: "success",
      });
      void refreshGallery({ silent: true });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleProjectDelete(project: ConsoleGalleryProjectView) {
    if (busyProjectAction || project.serviceCount > 0) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Delete project",
      description: `${project.name} is empty and will be removed from the workspace.`,
      title: "Delete empty project?",
    });

    if (!confirmed) {
      return;
    }

    setBusyProjectAction("delete");
    setFlash(null);

    try {
      await requestJson(`/api/fugue/projects/${project.id}`, {
        method: "DELETE",
      });
      setSelectedProjectId((current) =>
        current === project.id ? null : current,
      );
      setSelectedServiceKey(null);
      setSelectedAppId(null);
      setFlash({
        message: "Project deleted.",
        variant: "success",
      });
      void refreshGallery({ silent: true });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyProjectAction(null);
    }
  }

  function addEnvRow() {
    setEnvRows((current) => [
      ...current,
      {
        existing: false,
        id: createClientId("env"),
        key: "",
        originalKey: "",
        originalValue: "",
        removed: false,
        value: "",
      },
    ]);
  }

  function changeEnvFormat(nextFormat: EnvironmentFormat) {
    if (nextFormat === "raw" && envFormat !== "raw") {
      syncEnvRawEditor(envRows);
    }

    setEnvFormat(nextFormat);
  }

  function resetEnvRawDraft() {
    syncEnvRawEditor(envRows);
  }

  function updateEnvRow(
    rowId: string,
    field: "key" | "value",
    nextValue: string,
  ) {
    setEnvRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, [field]: nextValue } : row,
      ),
    );
  }

  function removeEnvRow(rowId: string) {
    setEnvRows((current) =>
      current.flatMap((row) => {
        if (row.id !== rowId) {
          return [row];
        }

        if (!row.existing) {
          return [];
        }

        return [{ ...row, removed: !row.removed }];
      }),
    );
  }

  function updateEnvRaw(nextValue: string) {
    setEnvRawDraft(nextValue);

    const parsed = parseRawEnvInput(nextValue);

    if (!parsed.ok) {
      setEnvRawFeedback({
        message: `Line ${parsed.line}: ${parsed.message}`,
        tone: "error",
        valid: false,
      });
      return;
    }

    const nextRows = rowsFromEnvDrafts(
      buildEnvDraftRowsFromEntries(parsed.entries, envBaseline),
    );
    setEnvRows(nextRows);
    setEnvRawFeedback(buildEnvRawFeedback(nextRows, parsed.ignoredLineCount));
  }

  async function saveEnv() {
    if (!selectedServiceApp || envSaving) {
      return;
    }

    if (envFormat === "raw" && !envRawFeedback.valid) {
      setFlash({
        message: envRawFeedback.message,
        variant: "error",
      });
      return;
    }

    const activeRows = envRows.filter((row) => !row.removed);
    const emptyKeyRows = activeRows.filter(
      (row) =>
        readEnvRowKey(row).length === 0 &&
        (row.existing || row.value.length > 0),
    );
    const duplicateKeys = new Set<string>();
    const seenKeys = new Set<string>();

    if (emptyKeyRows.length > 0) {
      setFlash({
        message: "Environment variable names cannot be empty.",
        variant: "error",
      });
      return;
    }

    for (const row of activeRows) {
      const key = readEnvRowKey(row);

      if (!key) {
        continue;
      }

      if (seenKeys.has(key)) {
        duplicateKeys.add(key);
      }

      seenKeys.add(key);
    }

    if (duplicateKeys.size > 0) {
      setFlash({
        message: `Duplicate env keys: ${[...duplicateKeys].join(", ")}.`,
        variant: "error",
      });
      return;
    }

    const setPayload: Record<string, string> = {};
    const deleteSet = new Set<string>();

    for (const row of envRows) {
      if (row.existing) {
        if (row.removed) {
          deleteSet.add(row.originalKey);
          continue;
        }

        const key = readEnvRowKey(row);
        const keyChanged = key !== row.originalKey;

        if (keyChanged) {
          deleteSet.add(row.originalKey);
          setPayload[key] = row.value;
          continue;
        }

        if (row.value !== row.originalValue) {
          setPayload[row.originalKey] = row.value;
        }
        continue;
      }

      const key = readEnvRowKey(row);

      if (key) {
        setPayload[key] = row.value;
      }
    }

    for (const key of Object.keys(setPayload)) {
      deleteSet.delete(key);
    }

    const deletePayload = [...deleteSet].sort((left, right) =>
      left.localeCompare(right),
    );

    if (!Object.keys(setPayload).length && !deletePayload.length) {
      setFlash({
        message: "No environment changes.",
        variant: "info",
      });
      return;
    }

    setEnvSaving(true);

    try {
      const response = await requestJson<EnvResponse>(
        `/api/fugue/apps/${selectedServiceApp.id}/env`,
        {
          body: JSON.stringify({
            delete: deletePayload,
            set: setPayload,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      armRefreshWindow(45_000);
      const nextEnv = response.env ?? {};
      const nextRows = rowsFromEnv(nextEnv);
      const nextState = {
        baseline: nextEnv,
        format: envFormat,
        rawDraft: serializeEnvEntries(entriesFromEnvRecord(nextEnv)),
        rawFeedback: buildEnvRawFeedback(nextRows),
        rows: nextRows,
      } satisfies CachedEnvState;

      writeCachedEnvState(selectedServiceApp.id, nextState);
      setEnvBaseline(nextEnv);
      setEnvRows(nextRows);
      setEnvRawDraft(nextState.rawDraft);
      setEnvRawFeedback(nextState.rawFeedback);
      setEnvStatus("ready");
      setFlash({
        message: "Environment changes queued.",
        variant: "success",
      });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setEnvSaving(false);
    }
  }

  function renderProjectWorkbench(
    project: ConsoleGalleryProjectView,
    detailId: string,
  ) {
    if (selectedProject?.id !== project.id) {
      return null;
    }

    if (project.serviceCount === 0) {
      return (
        <div className="fg-project-card__detail" id={detailId}>
          <section className="fg-bezel fg-panel fg-project-workbench">
            <div className="fg-bezel__inner fg-project-workbench__inner">
              <aside className="fg-project-services fg-project-services--rail fg-project-workbench__rail">
                <PanelSection className="fg-project-services__head">
                  <div className="fg-project-services__title-row">
                    <p className="fg-label fg-panel__eyebrow">Services</p>
                    <Button
                      onClick={() => openCreateService(project)}
                      size="compact"
                      type="button"
                      variant="primary"
                    >
                      Add service
                    </Button>
                  </div>
                </PanelSection>

                <PanelSection>
                  <p className="fg-console-note">
                    No services are attached to this project yet.
                  </p>
                </PanelSection>
              </aside>

              <div className="fg-project-inspector fg-project-workbench__main">
                <PanelSection className="fg-project-inspector__head">
                  <div className="fg-project-inspector__header-row">
                    <div className="fg-project-inspector__hero">
                      <PanelTitle>{project.name}</PanelTitle>
                      <PanelCopy className="fg-project-inspector__copy">
                        This project still exists in Fugue, but it does not
                        currently have any running services or attached backing
                        services.
                      </PanelCopy>
                    </div>
                  </div>

                  <div className="fg-project-inspector__meta-grid">
                    <div>
                      <dt>Apps</dt>
                      <dd>{project.appCount}</dd>
                    </div>
                    <div>
                      <dt>Services</dt>
                      <dd>{project.serviceCount}</dd>
                    </div>
                    <div>
                      <dt>Project id</dt>
                      <dd>{project.id}</dd>
                    </div>
                    <div>
                      <dt>State</dt>
                      <dd>Empty</dd>
                    </div>
                  </div>
                </PanelSection>

                <PanelSection className="fg-project-inspector__controls">
                  <div className="fg-project-toolbar">
                    <div className="fg-project-toolbar__group">
                      <p className="fg-label fg-project-toolbar__label">
                        Actions
                      </p>
                      <div className="fg-project-actions">
                        <Button
                          onClick={() => openCreateService(project)}
                          size="compact"
                          type="button"
                          variant="primary"
                        >
                          Add service
                        </Button>
                        <Button
                          disabled={busyProjectAction === "delete"}
                          loading={busyProjectAction === "delete"}
                          loadingLabel="Deleting…"
                          onClick={() => handleProjectDelete(project)}
                          size="compact"
                          type="button"
                          variant="danger"
                        >
                          Delete project
                        </Button>
                      </div>
                    </div>
                  </div>
                </PanelSection>

                <PanelSection className="fg-project-pane">
                  <div className="fg-console-empty-state fg-project-empty-state">
                    <div>
                      <strong>Empty project</strong>
                      <p>
                        Empty projects used to be hidden from the gallery. They
                        now stay visible so you can reuse the shell or delete it
                        explicitly.
                      </p>
                    </div>

                    <div className="fg-console-empty-state__actions">
                      <Button
                        onClick={() => openCreateService(project)}
                        size="compact"
                        type="button"
                        variant="primary"
                      >
                        Import a new service
                      </Button>
                    </div>
                  </div>
                </PanelSection>
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (!selectedService || !selectedApp) {
      return null;
    }

    const selectedServiceSummary =
      selectedService.kind === "app"
        ? readDistinctText(selectedService.lastMessage, [selectedService.name])
        : readDistinctText(selectedService.description, [
            selectedService.name,
            selectedService.ownerAppLabel,
            selectedService.type,
            humanizeUiLabel(selectedService.type),
          ]);
    const selectedServiceStorageLabel =
      selectedService.kind === "app" &&
      selectedService.serviceRole === "running" &&
      !selectedServicePaused
        ? readPersistentStorageLabel(selectedService.persistentStorageMounts)
        : null;
    const backingServiceOwnerLabel =
      selectedService.kind === "backing-service"
        ? readDistinctText(selectedService.ownerAppLabel, [
            selectedService.name,
          ])
        : null;
    const backingServiceDescription =
      selectedService.kind === "backing-service"
        ? readDistinctText(selectedService.description, [
            selectedService.name,
            selectedService.ownerAppLabel,
            selectedService.type,
            humanizeUiLabel(selectedService.type),
          ])
        : null;
    const selectedServiceUrl = readServicePublicUrl(selectedService);
    const selectedServiceLocationLabel =
      selectedService.locationLabel ?? "Unavailable";

    return (
      <div className="fg-project-card__detail" id={detailId}>
        <section className="fg-bezel fg-panel fg-project-workbench">
          <div className="fg-bezel__inner fg-project-workbench__inner">
            <aside className="fg-project-services fg-project-services--rail fg-project-workbench__rail">
              <PanelSection className="fg-project-services__head">
                <div className="fg-project-services__title-row">
                  <p className="fg-label fg-panel__eyebrow">Services</p>
                  <Button
                    onClick={() => openCreateService(project)}
                    size="compact"
                    type="button"
                    variant="primary"
                  >
                    Add service
                  </Button>
                </div>
              </PanelSection>

              <PanelSection>
                <ul className="fg-project-service-list">
                  {project.services.map((service) => {
                    const active =
                      serviceKey(selectedService) === serviceKey(service);
                    const serviceStatus =
                      service.kind === "app" ? service.phase : service.status;
                    const serviceStatusTone =
                      service.kind === "app"
                        ? service.phaseTone
                        : service.statusTone;
                    const cardSecondaryLines =
                      service.kind === "app"
                        ? [
                            readAppServiceRoleLabel(service),
                            readDistinctText(service.sourceMeta, [
                              service.name,
                            ]),
                          ].filter((value): value is string => Boolean(value))
                        : [
                            readDistinctText(service.ownerAppLabel, [
                              service.name,
                            ]),
                            readDistinctText(service.description, [
                              service.name,
                              service.ownerAppLabel,
                              service.type,
                              humanizeUiLabel(service.type),
                            ]),
                          ].filter((value): value is string => Boolean(value));
                    const cardStatusMeta =
                      service.kind === "app" && service.serviceDurationLabel
                        ? `${service.serviceDurationLabel} elapsed`
                        : null;

                    return (
                      <li key={serviceKey(service)}>
                        <button
                          aria-label={`Inspect ${service.name}${service.kind === "app" ? ` (${service.phase})` : ` (${service.type})`}`}
                          aria-pressed={active}
                          className={cx(
                            "fg-project-service-card",
                            active && "is-active",
                          )}
                          onClick={() => chooseService(service)}
                          type="button"
                        >
                          <div className="fg-project-service-card__head">
                            <div className="fg-project-service-card__title-row">
                              <div className="fg-project-service-card__summary">
                                <span className="fg-project-service-card__primary-badge">
                                  <ProjectBadge
                                    kind={service.primaryBadge.kind}
                                    label={service.primaryBadge.label}
                                    meta={service.primaryBadge.meta}
                                  />
                                </span>
                                <div className="fg-project-service-card__identity">
                                  <strong>{service.name}</strong>
                                </div>
                              </div>

                              <div className="fg-project-service-card__status">
                                <StatusBadge
                                  live={shouldShowLiveStatusBadge(
                                    serviceStatus,
                                  )}
                                  tone={serviceStatusTone}
                                >
                                  {serviceStatus}
                                </StatusBadge>
                                {cardStatusMeta ? (
                                  <span className="fg-project-service-card__status-meta">
                                    {cardStatusMeta}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {cardSecondaryLines.length ? (
                              <div className="fg-project-service-card__meta">
                                {cardSecondaryLines.map((line) => (
                                  <span key={line}>{line}</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </PanelSection>
            </aside>

            <div className="fg-project-inspector fg-project-workbench__main">
              <PanelSection className="fg-project-inspector__head">
                <div className="fg-project-inspector__header-row">
                  <div className="fg-project-inspector__hero">
                    {selectedService.kind === "app" ? (
                      <p className="fg-label">
                        {readAppServiceRoleLabel(selectedService)}
                      </p>
                    ) : null}
                    <PanelTitle>{selectedService.name}</PanelTitle>
                    {selectedServiceSummary ? (
                      <PanelCopy className="fg-project-inspector__copy">
                        {selectedServiceSummary}
                      </PanelCopy>
                    ) : null}
                  </div>
                </div>

                <div className="fg-project-inspector__meta-grid">
                  {selectedService.kind === "app" ? (
                    <>
                      <div>
                        <dt>Release</dt>
                        <dd>{readAppServiceRoleLabel(selectedService)}</dd>
                      </div>
                      <div>
                        <dt>Commit</dt>
                        <dd>
                          {renderCommitText(
                            selectedService,
                            selectedAppPendingCommitHint,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Build</dt>
                        <dd>{selectedService.sourceMeta}</dd>
                      </div>
                      {selectedServiceUrl ? (
                        <div>
                          <dt>URL</dt>
                          <dd>
                            {renderExternalText(
                              selectedServiceUrl.label,
                              selectedServiceUrl.href,
                            )}
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Location</dt>
                        <dd>
                          <CountryFlagLabel
                            countryCode={selectedService.locationCountryCode}
                            label={selectedServiceLocationLabel}
                          />
                        </dd>
                      </div>
                      {selectedService.serviceRole === "running" &&
                      selectedServiceStorageLabel ? (
                        <div>
                          <dt>Persistent storage</dt>
                          <dd>{selectedServiceStorageLabel}</dd>
                        </div>
                      ) : null}
                      {selectedService.serviceRole === "pending" &&
                      selectedService.serviceDurationLabel ? (
                        <div>
                          <dt>Elapsed</dt>
                          <dd>{`${selectedService.serviceDurationLabel} elapsed`}</dd>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div>
                        <dt>Service</dt>
                        <dd>{selectedService.type}</dd>
                      </div>
                      <div>
                        <dt>Location</dt>
                        <dd>
                          <CountryFlagLabel
                            countryCode={selectedService.locationCountryCode}
                            label={selectedServiceLocationLabel}
                          />
                        </dd>
                      </div>
                      {backingServiceOwnerLabel ? (
                        <div>
                          <dt>Attached to</dt>
                          <dd>{backingServiceOwnerLabel}</dd>
                        </div>
                      ) : null}
                      {backingServiceDescription ? (
                        <div>
                          <dt>Description</dt>
                          <dd>{backingServiceDescription}</dd>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </PanelSection>

              <PanelSection className="fg-project-inspector__controls">
                <div className="fg-project-toolbar">
                  {selectedService.kind === "app" &&
                  !selectedServiceDeleting &&
                  (selectedService.serviceRole === "running" ||
                    selectedServiceCanForceDelete) ? (
                    <div className="fg-project-toolbar__group">
                      <p className="fg-label fg-project-toolbar__label">
                        Actions
                      </p>
                      <div className="fg-project-actions">
                        {selectedService.serviceRole === "running" ? (
                          <>
                            <Button
                              disabled={
                                !selectedService.canRedeploy ||
                                Boolean(
                                  busyAction && busyAction !== "redeploy",
                                )
                              }
                              loading={busyAction === "redeploy"}
                              loadingLabel={
                                selectedService.redeployActionLoadingLabel
                              }
                              onClick={() => handleAppAction("redeploy")}
                              size="compact"
                              title={
                                selectedService.canRedeploy
                                  ? selectedService.redeployActionDescription
                                  : (selectedService.redeployDisabledReason ??
                                    undefined)
                              }
                              type="button"
                              variant="primary"
                            >
                              {selectedService.redeployActionLabel}
                            </Button>
                            <Button
                              disabled={Boolean(
                                busyAction &&
                                  busyAction !== selectedServiceLifecycleAction,
                              )}
                              loading={
                                busyAction === selectedServiceLifecycleAction
                              }
                              loadingLabel={
                                selectedServicePaused
                                  ? "Starting…"
                                  : "Restarting…"
                              }
                              onClick={() =>
                                handleAppAction(selectedServiceLifecycleAction)
                              }
                              size="compact"
                              title={
                                selectedServicePaused
                                  ? "Start this paused app at 1 replica without rebuilding the image."
                                  : "Restart the current release without rebuilding the image. Persistent storage is preserved when configured."
                              }
                              type="button"
                              variant="secondary"
                            >
                              {selectedServicePaused ? "Start" : "Restart"}
                            </Button>
                            {selectedServiceCanPause ? (
                              <Button
                                disabled={Boolean(
                                  busyAction && busyAction !== "disable",
                                )}
                                loading={busyAction === "disable"}
                                loadingLabel="Pausing…"
                                onClick={() => handleAppAction("disable")}
                                size="compact"
                                type="button"
                                variant="secondary"
                              >
                                Pause
                              </Button>
                            ) : null}
                            <Button
                              disabled={Boolean(
                                busyAction && busyAction !== "delete",
                              )}
                              loading={busyAction === "delete"}
                              loadingLabel="Deleting…"
                              onClick={() => handleAppAction("delete")}
                              size="compact"
                              type="button"
                              variant="danger"
                            >
                              Delete
                            </Button>
                          </>
                        ) : null}
                        {selectedServiceCanForceDelete ? (
                          <Button
                            disabled={Boolean(
                              busyAction && busyAction !== "force-delete",
                            )}
                            loading={busyAction === "force-delete"}
                            loadingLabel="Aborting…"
                            onClick={() => handleAppAction("force-delete")}
                            size="compact"
                            title={readForceDeleteActionDescription(
                              selectedService.phase,
                            )}
                            type="button"
                            variant="danger"
                          >
                            {readForceDeleteActionLabel(selectedService.phase)}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="fg-project-toolbar__group fg-project-toolbar__group--tabs">
                    <p className="fg-label fg-project-toolbar__label">Panels</p>
                    <SegmentedControl
                      ariaLabel="Service panels"
                      className="fg-project-toolbar__panels-switch"
                      controlClassName="fg-console-nav"
                      itemClassName="fg-console-nav__link"
                      labelClassName="fg-console-nav__title"
                      onChange={setActiveTab}
                      options={selectedServiceWorkbenchOptions}
                      value={
                        selectedServiceWorkbenchOptions.some(
                          (option) => option.value === activeTab,
                        )
                          ? activeTab
                          : "logs"
                      }
                      variant="pill"
                    />
                  </div>
                </div>
              </PanelSection>

              <PanelSection className="fg-project-pane">
                {selectedService.kind === "app" && activeTab === "route" ? (
                  <AppRoutePanel
                    appId={selectedService.id}
                    appName={selectedService.name}
                    initialBaseDomain={selectedService.routeBaseDomain}
                    initialHostname={selectedService.routeHostname}
                    initialPublicUrl={selectedService.routePublicUrl}
                    key={selectedService.id}
                  />
                ) : null}

                {selectedService.kind === "app" && activeTab === "env" ? (
                  <div className="fg-workbench-section">
                    <div className="fg-workbench-section__head">
                      <div className="fg-workbench-section__copy fg-env-section__copy">
                        <p className="fg-label fg-panel__eyebrow">
                          Environment
                        </p>
                        <p className="fg-console-note">
                          {envFormat === "raw"
                            ? `Paste a .env block for ${selectedService.name}. Comments, blank lines, and export prefixes are ignored.`
                            : `Review variables for ${selectedService.name}, or switch to Raw to paste a .env block. Saving queues a deploy.`}
                        </p>
                      </div>

                      <div className="fg-workbench-section__actions fg-env-section__actions">
                        <SegmentedControl
                          ariaLabel="Environment formats"
                          controlClassName="fg-console-nav"
                          itemClassName="fg-console-nav__link"
                          labelClassName="fg-console-nav__title"
                          onChange={changeEnvFormat}
                          options={ENVIRONMENT_FORMAT_OPTIONS}
                          value={envFormat}
                          variant="pill"
                        />
                        {envFormat === "table" ? (
                          <Button
                            onClick={addEnvRow}
                            size="compact"
                            type="button"
                            variant="secondary"
                          >
                            Add variable
                          </Button>
                        ) : (
                          <Button
                            onClick={resetEnvRawDraft}
                            size="compact"
                            type="button"
                            variant="secondary"
                          >
                            Reset raw
                          </Button>
                        )}
                        <Button
                          disabled={
                            envStatus === "loading" ||
                            (envFormat === "raw" && !envRawFeedback.valid)
                          }
                          loading={envSaving}
                          loadingLabel="Saving…"
                          onClick={saveEnv}
                          size="compact"
                          type="button"
                          variant="primary"
                        >
                          Save
                        </Button>
                      </div>
                    </div>

                    {envStatus === "loading" ? (
                      <p className="fg-console-note">Loading environment…</p>
                    ) : envFormat === "table" ? (
                      <div className="fg-env-table">
                        <EnvironmentVariableTable
                          onRemoveRow={removeEnvRow}
                          onUpdateRow={updateEnvRow}
                          rows={envRows}
                        />
                      </div>
                    ) : (
                      <div className="fg-env-raw">
                        <FormField
                          hint="Paste KEY=value lines directly from a .env file. Quoted values, blank lines, comments, and export prefixes are supported."
                          htmlFor={`env-raw-${selectedService.id}`}
                          label="Raw environment"
                          optionalLabel="Paste .env"
                        >
                          <textarea
                            aria-invalid={
                              envRawFeedback.valid ? undefined : true
                            }
                            autoCapitalize="off"
                            autoCorrect="off"
                            className="fg-project-textarea fg-env-raw__textarea"
                            id={`env-raw-${selectedService.id}`}
                            onChange={(event) =>
                              updateEnvRaw(event.target.value)
                            }
                            placeholder={`DATABASE_URL=postgres://user:pass@host/db\nPUBLIC_API_BASE=https://api.example.com\n# comments are ignored`}
                            spellCheck={false}
                            value={envRawDraft}
                          />
                        </FormField>
                        <div
                          aria-live={
                            envRawFeedback.valid ? "polite" : "assertive"
                          }
                          className={cx(
                            "fg-inline-alert",
                            envRawFeedback.tone === "error" &&
                              "fg-inline-alert--error",
                            envRawFeedback.tone === "info" &&
                              "fg-inline-alert--info",
                            envRawFeedback.tone === "success" &&
                              "fg-inline-alert--success",
                          )}
                          role={envRawFeedback.valid ? "status" : "alert"}
                        >
                          {envRawFeedback.message}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {selectedService.kind === "app" &&
                selectedService.serviceRole === "running" &&
                !selectedServicePaused &&
                activeTab === "files" ? (
                  <ConsoleFilesWorkbench
                    appId={selectedService.id}
                    appName={selectedService.name}
                    key={selectedService.id}
                    persistentStorageMounts={
                      selectedService.persistentStorageMounts
                    }
                  />
                ) : null}

                {selectedService.kind === "app" && activeTab === "images" ? (
                  <AppImagesPanel
                    appId={selectedService.id}
                    appName={selectedService.name}
                    key={selectedService.id}
                    onRequestRefreshWindow={armRefreshWindow}
                  />
                ) : null}

                {activeTab === "logs" ? (
                  <ConsoleLogsPanel
                    effectiveLogsMode={effectiveLogsMode}
                    externalRefreshToken={logsResetSignal}
                    onLogsModeChange={setLogsMode}
                    onPendingCommitHintChange={setSelectedAppPendingCommitHint}
                    runtimeLogsUnavailable={runtimeLogsUnavailable}
                    selectedApp={selectedApp}
                    selectedAppNeedsPendingCommitHint={
                      selectedAppNeedsPendingCommitHint
                    }
                    selectedService={selectedService}
                    selectedServiceApp={selectedServiceApp}
                    selectedServiceLogViewOptions={
                      selectedServiceLogViewOptions
                    }
                  />
                ) : null}

                {selectedService.kind === "app" && activeTab === "settings" ? (
                  <AppSettingsPanel
                    app={selectedService}
                    onOpenFiles={
                      selectedService.serviceRole === "running" &&
                      !selectedServicePaused
                        ? () => setActiveTab("files")
                        : null
                    }
                    projectCatalog={data.projects.map((item) => ({
                      id: item.id,
                      name: item.name,
                    }))}
                    projectId={project.id}
                    projectManaged={project.id !== "unassigned"}
                    projectName={project.name}
                    runtimeTargetInventoryError={
                      data.runtimeTargetInventoryError
                    }
                    runtimeTargets={data.runtimeTargets}
                    serviceCount={project.serviceCount}
                  />
                ) : selectedService.kind === "backing-service" &&
                  activeTab === "settings" ? (
                  <BackingServiceSettingsPanel
                    ownerAppRuntimeId={selectedApp?.runtimeId ?? null}
                    runtimeTargetInventoryError={
                      data.runtimeTargetInventoryError
                    }
                    runtimeTargets={data.runtimeTargets}
                    service={selectedService}
                  />
                ) : null}
              </PanelSection>
            </div>
          </div>
        </section>
      </div>
    );
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
          {optimisticProjects.length ? (
            <div className="fg-project-gallery__stack">
              {optimisticProjects.map((project) => {
                const expanded = selectedProjectId === project.id;
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
                      type="button"
                    >
                      <div className="fg-project-card__summary-head">
                        <div className="fg-project-card__summary-copy">
                          <strong>{project.name}</strong>
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
                                  <ProjectBadge
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
                            <CompactResourceMeter
                              item={resource}
                              key={resource.id}
                            />
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

                    {expanded
                      ? renderProjectWorkbench(project, detailId)
                      : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="fg-project-gallery__empty-state">
              <Button onClick={openCreate} type="button" variant="primary">
                Create project
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
            className="fg-console-dialog-shell fg-project-dialog-shell"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <Panel className="fg-console-dialog-panel">
              <PanelSection>
                <p className="fg-label fg-panel__eyebrow">
                  {createDialogEyebrow}
                </p>
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
                      <FormField
                        htmlFor="create-project-current"
                        label="Project"
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
                        hint="Shown in the project list."
                        htmlFor="create-project-name"
                        label="Project name"
                      >
                        <input
                          className="fg-input"
                          id="create-project-name"
                          name="projectName"
                          onChange={(event) =>
                            setProjectName(event.target.value)
                          }
                          placeholder="Project 1"
                          required
                          value={projectName}
                        />
                      </FormField>
                    )}

                    <ImportServiceFields
                      draft={importDraft}
                      githubConnectHref={githubConnectHref}
                      githubConnection={githubConnection}
                      githubConnectionError={githubConnectionError}
                      githubConnectionLoading={githubConnectionLoading}
                      idPrefix="create-service"
                      includeWrapper={false}
                      inventoryError={data.runtimeTargetInventoryError}
                      localUpload={localUpload}
                      onCapabilitiesChange={setImportCapabilities}
                      onDraftChange={setImportDraft}
                      onLocalUploadChange={setLocalUpload}
                      runtimeTargets={data.runtimeTargets}
                    />
                  </div>
                </form>
              </PanelSection>

              <PanelSection className="fg-console-dialog__footer">
                <div className="fg-console-dialog__actions">
                  <Button
                    onClick={closeCreate}
                    type="button"
                    variant="secondary"
                  >
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

export function ConsoleProjectWorkbench({
  detailId,
  onProjectDeleted,
  onProjectMutation,
  onRequestCreateService,
  projectCatalog,
  project,
  refreshToken,
}: {
  detailId: string;
  onProjectDeleted: (projectId: string) => void;
  onProjectMutation: (
    options?:
      | number
      | {
          optimisticDeletingProjectId?: string;
          optimisticDeletingServiceCount?: number;
        },
  ) => void;
  onRequestCreateService: (project: ConsoleProjectSummaryView) => void;
  projectCatalog: Array<{
    id: string;
    name: string;
  }>;
  project: ConsoleProjectSummaryView;
  refreshToken: number;
}) {
  const initialDetail = readCachedConsoleProjectDetail(project.id);
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [detailStatus, setDetailStatus] = useState<
    "error" | "loading" | "ready"
  >(() => (initialDetail ? "ready" : "loading"));
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConsoleProjectDetailData | null>(
    () => initialDetail,
  );
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedServiceKey, setSelectedServiceKey] = useState<string | null>(
    null,
  );
  const [selectedAppPendingCommitHint, setSelectedAppPendingCommitHint] =
    useState<ConsoleGalleryCommitView | null>(null);
  const [activeTab, setActiveTab] = useState<WorkbenchView>("env");
  const [busyAction, setBusyAction] = useState<AppAction | null>(null);
  const [busyProjectAction, setBusyProjectAction] =
    useState<ProjectAction | null>(null);
  const [envFormat, setEnvFormat] = useState<EnvironmentFormat>("table");
  const [envStatus, setEnvStatus] = useState<
    "error" | "idle" | "loading" | "ready"
  >("idle");
  const [envBaseline, setEnvBaseline] = useState<Record<string, string>>({});
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [envRawDraft, setEnvRawDraft] = useState("");
  const [envRawFeedback, setEnvRawFeedback] = useState<EnvRawFeedback>(
    createDefaultEnvRawFeedback,
  );
  const [envSaving, setEnvSaving] = useState(false);
  const [logsMode, setLogsMode] = useState<LogsView>("build");
  const [logsResetSignal, setLogsResetSignal] = useState(0);
  const detailRefreshAbortRef = useRef<AbortController | null>(null);
  const lastRefreshTokenRef = useRef(refreshToken);
  const runtimeInventory = useConsoleRuntimeTargetInventory(
    activeTab === "settings",
  );
  const { markAppDeleting, optimisticProjects } =
    useOptimisticDeletingProjects(detail?.project ? [detail.project] : []);

  const detailProject = optimisticProjects[0] ?? null;
  const detailProjectServices = detailProject?.services ?? [];
  const detailProjectApps = detailProject ? projectApps(detailProject) : [];
  const selectedService =
    detailProjectServices.find(
      (service) => serviceKey(service) === selectedServiceKey,
    ) ??
    readPreferredProjectService(detailProjectServices) ??
    null;
  const selectedServiceApp =
    selectedService?.kind === "app" ? selectedService : null;
  const selectedServiceAppId = selectedServiceApp?.id ?? null;
  const selectedApp =
    selectedServiceApp ??
    (selectedService?.kind === "backing-service"
      ? (detailProjectApps.find((app) => app.id === selectedService.ownerAppId) ??
        detailProjectApps.find((app) => app.id === selectedAppId) ??
        detailProjectApps[0] ??
        null)
      : (detailProjectApps.find((app) => app.id === selectedAppId) ??
        detailProjectApps[0] ??
        null));
  const selectedServiceWorkbenchOptions =
    readServiceWorkbenchOptions(selectedService);
  const selectedServiceLogViewOptions = readServiceLogViewOptions(
    selectedService,
    detailProjectServices,
  );
  const effectiveLogsMode = normalizeLogsModeForService(
    selectedService,
    detailProjectServices,
    logsMode,
  );
  const selectedAppNeedsPendingCommitHint =
    isGitHubTrackedApp(selectedServiceApp) &&
    !hasPendingCommitView(selectedServiceApp);
  const selectedServicePaused = isPausedAppService(selectedServiceApp);
  const selectedServiceFailed = isFailedAppService(selectedServiceApp);
  const selectedServiceLifecycleAction = selectedServicePaused
    ? "start"
    : "restart";
  const selectedServiceCanPause =
    !selectedServicePaused && !selectedServiceFailed;
  const selectedServiceCanForceDelete = canForceDeletePendingService(
    selectedServiceApp,
  );
  const selectedServiceDeleting = isDeletingLifecycleValue(
    selectedServiceApp?.phase,
  );
  const runtimeLogsUnavailable = readRuntimeLogsUnavailableState(
    selectedServiceApp,
    effectiveLogsMode,
  );
  useWorkbenchAnticipatoryWarmup(detailProjectServices, selectedService);

  const refreshDetail = useEffectEvent(
    async (options?: { force?: boolean; silent?: boolean }) => {
      const controller = new AbortController();
      detailRefreshAbortRef.current?.abort();
      detailRefreshAbortRef.current = controller;

      if (!detail?.project) {
        setDetailStatus("loading");
      }

      setDetailError(null);

      try {
        const nextDetail = await fetchConsoleProjectDetail(project.id, {
          force: options?.force,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return false;
        }

        startTransition(() => {
          setDetail(nextDetail);
        });
        setDetailStatus("ready");
        return true;
      } catch (error) {
        if (controller.signal.aborted || isAbortRequestError(error)) {
          return false;
        }

        setDetailStatus("error");
        setDetailError(readErrorMessage(error));

        if (!options?.silent) {
          setFlash({
            message: readErrorMessage(error),
            variant: "error",
          });
        }

        return false;
      }
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
    const forceRefresh = lastRefreshTokenRef.current !== refreshToken;
    lastRefreshTokenRef.current = refreshToken;

    void refreshDetail({
      force: forceRefresh,
      silent: Boolean(detail?.project ?? initialDetail),
    });
  }, [project.id, refreshDetail, refreshToken]);

  useEffect(() => {
    return () => {
      detailRefreshAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedServiceApp || !selectedAppNeedsPendingCommitHint) {
      setSelectedAppPendingCommitHint(null);
      return;
    }

    setSelectedAppPendingCommitHint(buildPendingCommitHint(selectedServiceApp));
  }, [selectedAppNeedsPendingCommitHint, selectedServiceApp]);

  useEffect(() => {
    if (!detailProject) {
      return;
    }

    if (!selectedService) {
      const defaultService = readPreferredProjectService(detailProject.services);

      if (!defaultService) {
        setSelectedAppId(null);
        return;
      }

      setSelectedServiceKey(serviceKey(defaultService));
      setSelectedAppId(
        defaultService.kind === "app"
          ? defaultService.id
          : (defaultService.ownerAppId ?? detailProjectApps[0]?.id ?? null),
      );
      return;
    }

    if (
      selectedService.kind === "backing-service" &&
      selectedAppId !== selectedService.ownerAppId
    ) {
      setSelectedAppId(
        selectedService.ownerAppId ?? detailProjectApps[0]?.id ?? null,
      );
    }
  }, [detailProject, detailProjectApps, selectedAppId, selectedService]);

  useEffect(() => {
    if (!selectedService) {
      return;
    }

    const defaultTab = readServiceDefaultTab(selectedService);
    const supportsActiveTab = selectedServiceWorkbenchOptions.some(
      (option) => option.value === activeTab,
    );
    const nextLogsMode = normalizeLogsModeForService(
      selectedService,
      detailProjectServices,
      logsMode,
    );

    if (!supportsActiveTab) {
      setActiveTab(
        selectedServiceWorkbenchOptions.some(
          (option) => option.value === defaultTab,
        )
          ? defaultTab
          : (selectedServiceWorkbenchOptions[0]?.value ?? "logs"),
      );
    }

    if (logsMode !== nextLogsMode) {
      setLogsMode(nextLogsMode);
    }
  }, [
    activeTab,
    detailProjectServices,
    logsMode,
    selectedService,
    selectedServiceWorkbenchOptions,
  ]);

  useEffect(() => {
    if (!selectedServiceAppId) {
      setEnvStatus("idle");
      setEnvBaseline({});
      setEnvRows([]);
      setEnvRawDraft("");
      setEnvRawFeedback(createDefaultEnvRawFeedback());
      return;
    }

    const cachedState = readCachedEnvState(selectedServiceAppId);

    if (cachedState) {
      setEnvBaseline(cachedState.baseline);
      setEnvRows(cachedState.rows);
      setEnvFormat(cachedState.format);
      setEnvRawDraft(cachedState.rawDraft);
      setEnvRawFeedback(cachedState.rawFeedback);
      setEnvStatus("ready");
      return;
    }

    setEnvStatus("idle");
    setEnvBaseline({});
    setEnvRows([]);
    setEnvRawDraft("");
    setEnvRawFeedback(createDefaultEnvRawFeedback());
  }, [selectedServiceAppId]);

  useEffect(() => {
    if (!selectedServiceAppId || activeTab !== "env") {
      return;
    }

    if (readCachedEnvState(selectedServiceAppId)) {
      return;
    }

    let cancelled = false;
    setEnvStatus("loading");

    fetchCachedEnvState(selectedServiceAppId)
      .then((cachedState) => {
        if (cancelled) {
          return;
        }

        setEnvBaseline(cachedState.baseline);
        setEnvRows(cachedState.rows);
        setEnvFormat(cachedState.format);
        setEnvRawDraft(cachedState.rawDraft);
        setEnvRawFeedback(cachedState.rawFeedback);
        setEnvStatus("ready");
      })
      .catch((error) => {
        if (cancelled || isAbortRequestError(error)) {
          return;
        }

        setEnvStatus("error");
        setFlash({
          message: readErrorMessage(error),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedServiceAppId]);

  useEffect(() => {
    if (!selectedServiceAppId || envStatus !== "ready") {
      return;
    }

    writeCachedEnvState(selectedServiceAppId, {
      baseline: envBaseline,
      format: envFormat,
      rawDraft: envRawDraft,
      rawFeedback: envRawFeedback,
      rows: envRows,
    });
  }, [
    envBaseline,
    envFormat,
    envRawDraft,
    envRawFeedback,
    envRows,
    envStatus,
    selectedServiceAppId,
  ]);

  function chooseService(service: ConsoleGalleryServiceView) {
    setSelectedServiceKey(serviceKey(service));
    setSelectedAppId(
      service.kind === "app" ? service.id : (service.ownerAppId ?? selectedAppId),
    );
    if (readServiceDefaultTab(service) === "logs") {
      setActiveTab("logs");
    }
    setLogsMode(readServiceDefaultLogsMode(service, detailProjectServices));
  }

  async function handleAppAction(action: AppAction) {
    if (!selectedServiceApp || busyAction) {
      return;
    }

    if (action === "redeploy" && !selectedServiceApp.canRedeploy) {
      setFlash({
        message:
          selectedServiceApp.redeployDisabledReason ??
          "Redeploy is not available for this app.",
        variant: "error",
      });
      return;
    }

    if (action === "delete" || action === "force-delete") {
      const forceDelete = action === "force-delete";
      const confirmed = await confirm({
        confirmLabel: forceDelete
          ? readForceDeleteActionLabel(selectedServiceApp.phase)
          : "Delete service",
        description: forceDelete
          ? `${selectedServiceApp.name} is currently ${selectedServiceApp.phase}. ${readForceDeleteActionDescription(selectedServiceApp.phase)}`
          : `${selectedServiceApp.name} will be queued for deletion from this project.`,
        textConfirmation: {
          hint: (
            <>
              Type{" "}
              <span className="fg-confirm-dialog__match-text">
                {selectedServiceApp.name}
              </span>{" "}
              exactly to enable deletion.
            </>
          ),
          label: "Service name",
          matchText: selectedServiceApp.name,
          mismatchMessage: "Enter the service name exactly as shown.",
        },
        title: forceDelete ? "Force delete service?" : "Delete service?",
      });

      if (!confirmed) {
        return;
      }
    }

    const nextAction =
      action === "restart" && isPausedAppService(selectedServiceApp)
        ? "start"
        : action;

    setBusyAction(nextAction);
    setFlash(null);

    try {
      let input = `/api/fugue/apps/${selectedServiceApp.id}`;
      let method = "POST";
      let successMessage = "Request queued.";

      switch (nextAction) {
        case "redeploy":
          input = `/api/fugue/apps/${selectedServiceApp.id}/rebuild`;
          successMessage = selectedServiceApp.redeployQueuedMessage;
          break;
        case "start":
          input = `/api/fugue/apps/${selectedServiceApp.id}/start`;
          successMessage = "Start queued at 1 replica.";
          break;
        case "restart":
          input = `/api/fugue/apps/${selectedServiceApp.id}/restart`;
          successMessage = "Restart queued.";
          break;
        case "disable":
          input = `/api/fugue/apps/${selectedServiceApp.id}/disable`;
          successMessage = "Pause queued.";
          break;
        case "delete":
          method = "DELETE";
          successMessage = "Delete queued.";
          break;
        case "force-delete":
          input = `/api/fugue/apps/${selectedServiceApp.id}?force=true`;
          method = "DELETE";
          successMessage = "Force delete queued.";
          break;
      }

      const result = await requestJson<DeleteAppActionResult>(input, {
        method,
      });

      if (nextAction === "delete" || nextAction === "force-delete") {
        markAppDeleting(selectedServiceApp.id);
        successMessage = readDeleteActionSuccessMessage(
          nextAction,
          result,
          selectedServiceApp.phase,
        );
      }

      if (nextAction === "redeploy") {
        setActiveTab("logs");
        setLogsMode("build");
        setLogsResetSignal((value) => value + 1);
      }

      setFlash({
        message: successMessage,
        variant: "success",
      });
      lastRefreshTokenRef.current = refreshToken + 1;
      onProjectMutation(
        nextAction === "delete" || nextAction === "force-delete"
          ? {
              optimisticDeletingProjectId: project.id,
              optimisticDeletingServiceCount:
                detailProject?.serviceCount ?? project.serviceCount,
            }
          : undefined,
      );
      void refreshDetail({ force: true, silent: true });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleProjectDelete() {
    if (busyProjectAction || !detailProject || detailProject.serviceCount > 0) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Delete project",
      description: `${detailProject.name} is empty and will be removed from the workspace.`,
      title: "Delete empty project?",
    });

    if (!confirmed) {
      return;
    }

    setBusyProjectAction("delete");

    try {
      await requestJson(`/api/fugue/projects/${detailProject.id}`, {
        method: "DELETE",
      });
      showToast({
        message: "Project deleted.",
        variant: "success",
      });
      onProjectDeleted(detailProject.id);
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyProjectAction(null);
    }
  }

  function addEnvRow() {
    setEnvRows((current) => [
      ...current,
      {
        existing: false,
        id: createClientId("env"),
        key: "",
        originalKey: "",
        originalValue: "",
        removed: false,
        value: "",
      },
    ]);
  }

  function changeEnvFormat(nextFormat: EnvironmentFormat) {
    if (nextFormat === "raw" && envFormat !== "raw") {
      const nextRows = envRows;
      setEnvRawDraft(serializeEnvEntries(entriesFromEnvRows(nextRows)));
      setEnvRawFeedback(buildEnvRawFeedback(nextRows));
    }

    setEnvFormat(nextFormat);
  }

  function resetEnvRawDraft() {
    setEnvRawDraft(serializeEnvEntries(entriesFromEnvRows(envRows)));
    setEnvRawFeedback(buildEnvRawFeedback(envRows));
  }

  function updateEnvRow(
    rowId: string,
    field: "key" | "value",
    nextValue: string,
  ) {
    setEnvRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, [field]: nextValue } : row,
      ),
    );
  }

  function removeEnvRow(rowId: string) {
    setEnvRows((current) =>
      current.flatMap((row) => {
        if (row.id !== rowId) {
          return [row];
        }

        if (!row.existing) {
          return [];
        }

        return [{ ...row, removed: !row.removed }];
      }),
    );
  }

  function updateEnvRaw(nextValue: string) {
    setEnvRawDraft(nextValue);

    const parsed = parseRawEnvInput(nextValue);

    if (!parsed.ok) {
      setEnvRawFeedback({
        message: `Line ${parsed.line}: ${parsed.message}`,
        tone: "error",
        valid: false,
      });
      return;
    }

    const nextRows = rowsFromEnvDrafts(
      buildEnvDraftRowsFromEntries(parsed.entries, envBaseline),
    );
    setEnvRows(nextRows);
    setEnvRawFeedback(buildEnvRawFeedback(nextRows, parsed.ignoredLineCount));
  }

  async function saveEnv() {
    if (!selectedServiceApp || envSaving) {
      return;
    }

    if (envFormat === "raw" && !envRawFeedback.valid) {
      setFlash({
        message: envRawFeedback.message,
        variant: "error",
      });
      return;
    }

    const activeRows = envRows.filter((row) => !row.removed);
    const emptyKeyRows = activeRows.filter(
      (row) =>
        readEnvRowKey(row).length === 0 &&
        (row.existing || row.value.length > 0),
    );
    const duplicateKeys = new Set<string>();
    const seenKeys = new Set<string>();

    if (emptyKeyRows.length > 0) {
      setFlash({
        message: "Environment variable names cannot be empty.",
        variant: "error",
      });
      return;
    }

    for (const row of activeRows) {
      const key = readEnvRowKey(row);

      if (!key) {
        continue;
      }

      if (seenKeys.has(key)) {
        duplicateKeys.add(key);
      }

      seenKeys.add(key);
    }

    if (duplicateKeys.size > 0) {
      setFlash({
        message: `Duplicate env keys: ${[...duplicateKeys].join(", ")}.`,
        variant: "error",
      });
      return;
    }

    const setPayload: Record<string, string> = {};
    const deleteSet = new Set<string>();

    for (const row of envRows) {
      if (row.existing) {
        if (row.removed) {
          deleteSet.add(row.originalKey);
          continue;
        }

        const key = readEnvRowKey(row);
        const keyChanged = key !== row.originalKey;

        if (keyChanged) {
          deleteSet.add(row.originalKey);
          setPayload[key] = row.value;
          continue;
        }

        if (row.value !== row.originalValue) {
          setPayload[row.originalKey] = row.value;
        }
        continue;
      }

      const key = readEnvRowKey(row);

      if (key) {
        setPayload[key] = row.value;
      }
    }

    for (const key of Object.keys(setPayload)) {
      deleteSet.delete(key);
    }

    const deletePayload = [...deleteSet].sort((left, right) =>
      left.localeCompare(right),
    );

    if (!Object.keys(setPayload).length && !deletePayload.length) {
      setFlash({
        message: "No environment changes.",
        variant: "info",
      });
      return;
    }

    setEnvSaving(true);

    try {
      const response = await requestJson<EnvResponse>(
        `/api/fugue/apps/${selectedServiceApp.id}/env`,
        {
          body: JSON.stringify({
            delete: deletePayload,
            set: setPayload,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      const nextEnv = response.env ?? {};
      const nextRows = rowsFromEnv(nextEnv);
      const nextState = {
        baseline: nextEnv,
        format: envFormat,
        rawDraft: serializeEnvEntries(entriesFromEnvRecord(nextEnv)),
        rawFeedback: buildEnvRawFeedback(nextRows),
        rows: nextRows,
      } satisfies CachedEnvState;

      writeCachedEnvState(selectedServiceApp.id, nextState);
      setEnvBaseline(nextEnv);
      setEnvRows(nextRows);
      setEnvRawDraft(nextState.rawDraft);
      setEnvRawFeedback(nextState.rawFeedback);
      setEnvStatus("ready");
      setFlash({
        message: "Environment changes queued.",
        variant: "success",
      });
      lastRefreshTokenRef.current = refreshToken + 1;
      onProjectMutation();
      void refreshDetail({ force: true, silent: true });
    } catch (error) {
      setFlash({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setEnvSaving(false);
    }
  }

  if (detailStatus === "loading" && !detailProject) {
    return <ConsoleProjectWorkbenchSkeleton detailId={detailId} />;
  }

  if (detailStatus === "error" || !detailProject) {
    return (
      <div className="fg-project-card__detail" id={detailId}>
        <section className="fg-bezel fg-panel fg-project-workbench">
          <div className="fg-bezel__inner fg-project-workbench__inner">
            <div className="fg-workbench-section">
              <p className="fg-console-note">
                {detailError ?? "Unable to load this project right now."}
              </p>
              <div className="fg-project-actions">
                <Button
                  onClick={() => {
                    void refreshDetail();
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
    );
  }

  if (detailProject.serviceCount === 0) {
    return (
      <div className="fg-project-card__detail" id={detailId}>
        <section className="fg-bezel fg-panel fg-project-workbench">
          <div className="fg-bezel__inner fg-project-workbench__inner">
            <aside className="fg-project-services fg-project-services--rail fg-project-workbench__rail">
              <PanelSection className="fg-project-services__head">
                <div className="fg-project-services__title-row">
                  <p className="fg-label fg-panel__eyebrow">Services</p>
                  <Button
                    onClick={() => onRequestCreateService(project)}
                    size="compact"
                    type="button"
                    variant="primary"
                  >
                    Add service
                  </Button>
                </div>
              </PanelSection>

              <PanelSection>
                <p className="fg-console-note">
                  No services are attached to this project yet.
                </p>
              </PanelSection>
            </aside>

            <div className="fg-project-inspector fg-project-workbench__main">
              <PanelSection className="fg-project-inspector__head">
                <div className="fg-project-inspector__header-row">
                  <div className="fg-project-inspector__hero">
                    <PanelTitle>{detailProject.name}</PanelTitle>
                    <PanelCopy className="fg-project-inspector__copy">
                      This project still exists in Fugue, but it does not
                      currently have any running services or attached backing
                      services.
                    </PanelCopy>
                  </div>
                </div>

                <div className="fg-project-inspector__meta-grid">
                  <div>
                    <dt>Apps</dt>
                    <dd>{detailProject.appCount}</dd>
                  </div>
                  <div>
                    <dt>Services</dt>
                    <dd>{detailProject.serviceCount}</dd>
                  </div>
                  <div>
                    <dt>Project id</dt>
                    <dd>{detailProject.id}</dd>
                  </div>
                  <div>
                    <dt>State</dt>
                    <dd>Empty</dd>
                  </div>
                </div>
              </PanelSection>

              <PanelSection className="fg-project-inspector__controls">
                <div className="fg-project-toolbar">
                  <div className="fg-project-toolbar__group">
                    <p className="fg-label fg-project-toolbar__label">
                      Actions
                    </p>
                    <div className="fg-project-actions">
                      <Button
                        onClick={() => onRequestCreateService(project)}
                        size="compact"
                        type="button"
                        variant="primary"
                      >
                        Add service
                      </Button>
                      <Button
                        disabled={busyProjectAction === "delete"}
                        loading={busyProjectAction === "delete"}
                        loadingLabel="Deleting…"
                        onClick={() => {
                          void handleProjectDelete();
                        }}
                        size="compact"
                        type="button"
                        variant="danger"
                      >
                        Delete project
                      </Button>
                    </div>
                  </div>
                </div>
              </PanelSection>

              <PanelSection className="fg-project-pane">
                <div className="fg-console-empty-state fg-project-empty-state">
                  <div>
                    <strong>Empty project</strong>
                    <p>
                      Empty projects stay visible so you can reuse the shell or
                      delete it explicitly.
                    </p>
                  </div>

                  <div className="fg-console-empty-state__actions">
                    <Button
                      onClick={() => onRequestCreateService(project)}
                      size="compact"
                      type="button"
                      variant="primary"
                    >
                      Import a new service
                    </Button>
                  </div>
                </div>
              </PanelSection>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!selectedService || !selectedApp) {
    return <ConsoleProjectWorkbenchSkeleton detailId={detailId} />;
  }

  const selectedServiceSummary =
    selectedService.kind === "app"
      ? readDistinctText(selectedService.lastMessage, [selectedService.name])
      : readDistinctText(selectedService.description, [
          selectedService.name,
          selectedService.ownerAppLabel,
          selectedService.type,
          humanizeUiLabel(selectedService.type),
        ]);
  const selectedServiceStorageLabel =
    selectedService.kind === "app" &&
    selectedService.serviceRole === "running" &&
    !selectedServicePaused
      ? readPersistentStorageLabel(selectedService.persistentStorageMounts)
      : null;
  const backingServiceOwnerLabel =
    selectedService.kind === "backing-service"
      ? readDistinctText(selectedService.ownerAppLabel, [selectedService.name])
      : null;
  const backingServiceDescription =
    selectedService.kind === "backing-service"
      ? readDistinctText(selectedService.description, [
          selectedService.name,
          selectedService.ownerAppLabel,
          selectedService.type,
          humanizeUiLabel(selectedService.type),
        ])
      : null;
  const selectedServiceUrl = readServicePublicUrl(selectedService);
  const selectedServiceLocationLabel = selectedService.locationLabel ?? "Unavailable";

  return (
    <div className="fg-project-card__detail" id={detailId}>
      <section className="fg-bezel fg-panel fg-project-workbench">
        <div className="fg-bezel__inner fg-project-workbench__inner">
          <aside className="fg-project-services fg-project-services--rail fg-project-workbench__rail">
            <PanelSection className="fg-project-services__head">
              <div className="fg-project-services__title-row">
                <p className="fg-label fg-panel__eyebrow">Services</p>
                <Button
                  onClick={() => onRequestCreateService(project)}
                  size="compact"
                  type="button"
                  variant="primary"
                >
                  Add service
                </Button>
              </div>
            </PanelSection>

            <PanelSection>
              <ul className="fg-project-service-list">
                {detailProject.services.map((service) => {
                  const active =
                    serviceKey(selectedService) === serviceKey(service);
                  const serviceStatus =
                    service.kind === "app" ? service.phase : service.status;
                  const serviceStatusTone =
                    service.kind === "app"
                      ? service.phaseTone
                      : service.statusTone;
                  const cardSecondaryLines =
                    service.kind === "app"
                      ? [
                          readAppServiceRoleLabel(service),
                          readDistinctText(service.sourceMeta, [service.name]),
                        ].filter((value): value is string => Boolean(value))
                      : [
                          readDistinctText(service.ownerAppLabel, [service.name]),
                          readDistinctText(service.description, [
                            service.name,
                            service.ownerAppLabel,
                            service.type,
                            humanizeUiLabel(service.type),
                          ]),
                        ].filter((value): value is string => Boolean(value));
                  const cardStatusMeta =
                    service.kind === "app" && service.serviceDurationLabel
                      ? `${service.serviceDurationLabel} elapsed`
                      : null;

                  return (
                    <li key={serviceKey(service)}>
                      <button
                        aria-label={`Inspect ${service.name}${service.kind === "app" ? ` (${service.phase})` : ` (${service.type})`}`}
                        aria-pressed={active}
                        className={cx(
                          "fg-project-service-card",
                          active && "is-active",
                        )}
                        onClick={() => chooseService(service)}
                        type="button"
                      >
                        <div className="fg-project-service-card__head">
                          <div className="fg-project-service-card__title-row">
                            <div className="fg-project-service-card__summary">
                              <span className="fg-project-service-card__primary-badge">
                                <ProjectBadge
                                  kind={service.primaryBadge.kind}
                                  label={service.primaryBadge.label}
                                  meta={service.primaryBadge.meta}
                                />
                              </span>
                              <div className="fg-project-service-card__identity">
                                <strong>{service.name}</strong>
                              </div>
                            </div>

                            <div className="fg-project-service-card__status">
                              <StatusBadge
                                live={shouldShowLiveStatusBadge(serviceStatus)}
                                tone={serviceStatusTone}
                              >
                                {serviceStatus}
                              </StatusBadge>
                              {cardStatusMeta ? (
                                <span className="fg-project-service-card__status-meta">
                                  {cardStatusMeta}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {cardSecondaryLines.length ? (
                            <div className="fg-project-service-card__meta">
                              {cardSecondaryLines.map((line) => (
                                <span key={line}>{line}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PanelSection>
          </aside>

          <div className="fg-project-inspector fg-project-workbench__main">
            <PanelSection className="fg-project-inspector__head">
              <div className="fg-project-inspector__header-row">
                <div className="fg-project-inspector__hero">
                  {selectedService.kind === "app" ? (
                    <p className="fg-label">
                      {readAppServiceRoleLabel(selectedService)}
                    </p>
                  ) : null}
                  <PanelTitle>{selectedService.name}</PanelTitle>
                  {selectedServiceSummary ? (
                    <PanelCopy className="fg-project-inspector__copy">
                      {selectedServiceSummary}
                    </PanelCopy>
                  ) : null}
                </div>
              </div>

              <div className="fg-project-inspector__meta-grid">
                {selectedService.kind === "app" ? (
                  <>
                    <div>
                      <dt>Release</dt>
                      <dd>{readAppServiceRoleLabel(selectedService)}</dd>
                    </div>
                    <div>
                      <dt>Commit</dt>
                      <dd>
                        {renderCommitText(
                          selectedService,
                          selectedAppPendingCommitHint,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Build</dt>
                      <dd>{selectedService.sourceMeta}</dd>
                    </div>
                    {selectedServiceUrl ? (
                      <div>
                        <dt>URL</dt>
                        <dd>
                          {renderExternalText(
                            selectedServiceUrl.label,
                            selectedServiceUrl.href,
                          )}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Location</dt>
                      <dd>
                        <CountryFlagLabel
                          countryCode={selectedService.locationCountryCode}
                          label={selectedServiceLocationLabel}
                        />
                      </dd>
                    </div>
                    {selectedService.serviceRole === "running" &&
                    selectedServiceStorageLabel ? (
                      <div>
                        <dt>Persistent storage</dt>
                        <dd>{selectedServiceStorageLabel}</dd>
                      </div>
                    ) : null}
                    {selectedService.serviceRole === "pending" &&
                    selectedService.serviceDurationLabel ? (
                      <div>
                        <dt>Elapsed</dt>
                        <dd>{`${selectedService.serviceDurationLabel} elapsed`}</dd>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div>
                      <dt>Service</dt>
                      <dd>{selectedService.type}</dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>
                        <CountryFlagLabel
                          countryCode={selectedService.locationCountryCode}
                          label={selectedServiceLocationLabel}
                        />
                      </dd>
                    </div>
                    {backingServiceOwnerLabel ? (
                      <div>
                        <dt>Attached to</dt>
                        <dd>{backingServiceOwnerLabel}</dd>
                      </div>
                    ) : null}
                    {backingServiceDescription ? (
                      <div>
                        <dt>Description</dt>
                        <dd>{backingServiceDescription}</dd>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </PanelSection>

            <PanelSection className="fg-project-inspector__controls">
              <div className="fg-project-toolbar">
                {selectedService.kind === "app" &&
                !selectedServiceDeleting &&
                (selectedService.serviceRole === "running" ||
                  selectedServiceCanForceDelete) ? (
                  <div className="fg-project-toolbar__group">
                    <p className="fg-label fg-project-toolbar__label">
                      Actions
                    </p>
                    <div className="fg-project-actions">
                      {selectedService.serviceRole === "running" ? (
                        <>
                          <Button
                            disabled={
                              !selectedService.canRedeploy ||
                              Boolean(busyAction && busyAction !== "redeploy")
                            }
                            loading={busyAction === "redeploy"}
                            loadingLabel={
                              selectedService.redeployActionLoadingLabel
                            }
                            onClick={() => {
                              void handleAppAction("redeploy");
                            }}
                            size="compact"
                            title={
                              selectedService.canRedeploy
                                ? selectedService.redeployActionDescription
                                : (selectedService.redeployDisabledReason ??
                                  undefined)
                            }
                            type="button"
                            variant="primary"
                          >
                            {selectedService.redeployActionLabel}
                          </Button>
                          <Button
                            disabled={Boolean(
                              busyAction &&
                                busyAction !== selectedServiceLifecycleAction,
                            )}
                            loading={
                              busyAction === selectedServiceLifecycleAction
                            }
                            loadingLabel={
                              selectedServicePaused
                                ? "Starting…"
                                : "Restarting…"
                            }
                            onClick={() => {
                              void handleAppAction(selectedServiceLifecycleAction);
                            }}
                            size="compact"
                            title={
                              selectedServicePaused
                                ? "Start this paused app at 1 replica without rebuilding the image."
                                : "Restart the current release without rebuilding the image. Persistent storage is preserved when configured."
                            }
                            type="button"
                            variant="secondary"
                          >
                            {selectedServicePaused ? "Start" : "Restart"}
                          </Button>
                          {selectedServiceCanPause ? (
                            <Button
                              disabled={Boolean(
                                busyAction && busyAction !== "disable",
                              )}
                              loading={busyAction === "disable"}
                              loadingLabel="Pausing…"
                              onClick={() => {
                                void handleAppAction("disable");
                              }}
                              size="compact"
                              type="button"
                              variant="secondary"
                            >
                              Pause
                            </Button>
                          ) : null}
                          <Button
                            disabled={Boolean(
                              busyAction && busyAction !== "delete",
                            )}
                            loading={busyAction === "delete"}
                            loadingLabel="Deleting…"
                            onClick={() => {
                              void handleAppAction("delete");
                            }}
                            size="compact"
                            type="button"
                            variant="danger"
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                      {selectedServiceCanForceDelete ? (
                        <Button
                          disabled={Boolean(
                            busyAction && busyAction !== "force-delete",
                          )}
                          loading={busyAction === "force-delete"}
                          loadingLabel="Aborting…"
                          onClick={() => {
                            void handleAppAction("force-delete");
                          }}
                          size="compact"
                          title={readForceDeleteActionDescription(
                            selectedService.phase,
                          )}
                          type="button"
                          variant="danger"
                        >
                          {readForceDeleteActionLabel(selectedService.phase)}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="fg-project-toolbar__group fg-project-toolbar__group--tabs">
                  <p className="fg-label fg-project-toolbar__label">Panels</p>
                  <SegmentedControl
                    ariaLabel="Service panels"
                    className="fg-project-toolbar__panels-switch"
                    controlClassName="fg-console-nav"
                    itemClassName="fg-console-nav__link"
                    labelClassName="fg-console-nav__title"
                    onChange={setActiveTab}
                    options={selectedServiceWorkbenchOptions}
                    value={
                      selectedServiceWorkbenchOptions.some(
                        (option) => option.value === activeTab,
                      )
                        ? activeTab
                        : "logs"
                    }
                    variant="pill"
                  />
                </div>
              </div>
            </PanelSection>

            <PanelSection className="fg-project-pane">
              {selectedService.kind === "app" && activeTab === "route" ? (
                <AppRoutePanel
                  appId={selectedService.id}
                  appName={selectedService.name}
                  initialBaseDomain={selectedService.routeBaseDomain}
                  initialHostname={selectedService.routeHostname}
                  initialPublicUrl={selectedService.routePublicUrl}
                  key={selectedService.id}
                />
              ) : null}

              {selectedService.kind === "app" && activeTab === "env" ? (
                <div className="fg-workbench-section">
                  <div className="fg-workbench-section__head">
                    <div className="fg-workbench-section__copy fg-env-section__copy">
                      <p className="fg-label fg-panel__eyebrow">Environment</p>
                      <p className="fg-console-note">
                        {envFormat === "raw"
                          ? `Paste a .env block for ${selectedService.name}. Comments, blank lines, and export prefixes are ignored.`
                          : `Review variables for ${selectedService.name}, or switch to Raw to paste a .env block. Saving queues a deploy.`}
                      </p>
                    </div>

                    <div className="fg-workbench-section__actions fg-env-section__actions">
                      <SegmentedControl
                        ariaLabel="Environment formats"
                        controlClassName="fg-console-nav"
                        itemClassName="fg-console-nav__link"
                        labelClassName="fg-console-nav__title"
                        onChange={changeEnvFormat}
                        options={ENVIRONMENT_FORMAT_OPTIONS}
                        value={envFormat}
                        variant="pill"
                      />
                      {envFormat === "table" ? (
                        <Button
                          onClick={addEnvRow}
                          size="compact"
                          type="button"
                          variant="secondary"
                        >
                          Add variable
                        </Button>
                      ) : (
                        <Button
                          onClick={resetEnvRawDraft}
                          size="compact"
                          type="button"
                          variant="secondary"
                        >
                          Reset raw
                        </Button>
                      )}
                      <Button
                        disabled={
                          envStatus === "loading" ||
                          (envFormat === "raw" && !envRawFeedback.valid)
                        }
                        loading={envSaving}
                        loadingLabel="Saving…"
                        onClick={() => {
                          void saveEnv();
                        }}
                        size="compact"
                        type="button"
                        variant="primary"
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  {envStatus === "loading" ? (
                    <p className="fg-console-note">Loading environment…</p>
                  ) : envFormat === "table" ? (
                    <div className="fg-env-table">
                      <EnvironmentVariableTable
                        onRemoveRow={removeEnvRow}
                        onUpdateRow={updateEnvRow}
                        rows={envRows}
                      />
                    </div>
                  ) : (
                    <div className="fg-env-raw">
                      <FormField
                        hint="Paste KEY=value lines directly from a .env file. Quoted values, blank lines, comments, and export prefixes are supported."
                        htmlFor={`env-raw-${selectedService.id}`}
                        label="Raw environment"
                        optionalLabel="Paste .env"
                      >
                        <textarea
                          aria-invalid={envRawFeedback.valid ? undefined : true}
                          autoCapitalize="off"
                          autoCorrect="off"
                          className="fg-project-textarea fg-env-raw__textarea"
                          id={`env-raw-${selectedService.id}`}
                          onChange={(event) => updateEnvRaw(event.target.value)}
                          placeholder={`DATABASE_URL=postgres://user:pass@host/db\nPUBLIC_API_BASE=https://api.example.com\n# comments are ignored`}
                          spellCheck={false}
                          value={envRawDraft}
                        />
                      </FormField>
                      <div
                        aria-live={envRawFeedback.valid ? "polite" : "assertive"}
                        className={cx(
                          "fg-inline-alert",
                          envRawFeedback.tone === "error" &&
                            "fg-inline-alert--error",
                          envRawFeedback.tone === "info" &&
                            "fg-inline-alert--info",
                          envRawFeedback.tone === "success" &&
                            "fg-inline-alert--success",
                        )}
                        role={envRawFeedback.valid ? "status" : "alert"}
                      >
                        {envRawFeedback.message}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {selectedService.kind === "app" &&
              selectedService.serviceRole === "running" &&
              !selectedServicePaused &&
              activeTab === "files" ? (
                <ConsoleFilesWorkbench
                  appId={selectedService.id}
                  appName={selectedService.name}
                  key={selectedService.id}
                  persistentStorageMounts={
                    selectedService.persistentStorageMounts
                  }
                />
              ) : null}

              {selectedService.kind === "app" && activeTab === "images" ? (
                <AppImagesPanel
                  appId={selectedService.id}
                  appName={selectedService.name}
                  key={selectedService.id}
                  onRequestRefreshWindow={onProjectMutation}
                />
              ) : null}

              {activeTab === "logs" ? (
                <ConsoleLogsPanel
                  effectiveLogsMode={effectiveLogsMode}
                  externalRefreshToken={logsResetSignal}
                  onLogsModeChange={setLogsMode}
                  onPendingCommitHintChange={setSelectedAppPendingCommitHint}
                  runtimeLogsUnavailable={runtimeLogsUnavailable}
                  selectedApp={selectedApp}
                  selectedAppNeedsPendingCommitHint={
                    selectedAppNeedsPendingCommitHint
                  }
                  selectedService={selectedService}
                  selectedServiceApp={selectedServiceApp}
                  selectedServiceLogViewOptions={selectedServiceLogViewOptions}
                />
              ) : null}

              {selectedService.kind === "app" && activeTab === "settings" ? (
                <AppSettingsPanel
                  app={selectedService}
                  onOpenFiles={
                    selectedService.serviceRole === "running" &&
                    !selectedServicePaused
                      ? () => setActiveTab("files")
                      : null
                  }
                  projectCatalog={projectCatalog}
                  projectId={detailProject.id}
                  projectManaged={detailProject.id !== "unassigned"}
                  projectName={detailProject.name}
                  runtimeTargetInventoryError={
                    runtimeInventory.runtimeTargetInventoryError
                  }
                  runtimeTargets={runtimeInventory.runtimeTargets}
                  serviceCount={detailProject.serviceCount}
                />
              ) : selectedService.kind === "backing-service" &&
                activeTab === "settings" ? (
                <BackingServiceSettingsPanel
                  ownerAppRuntimeId={selectedApp?.runtimeId ?? null}
                  runtimeTargetInventoryError={
                    runtimeInventory.runtimeTargetInventoryError
                  }
                  runtimeTargets={runtimeInventory.runtimeTargets}
                  service={selectedService}
                />
              ) : null}
            </PanelSection>
          </div>
        </div>
      </section>
    </div>
  );
}
