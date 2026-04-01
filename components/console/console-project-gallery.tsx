"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";

import { CompactResourceMeter } from "@/components/console/compact-resource-meter";
import { ImportServiceFields } from "@/components/console/import-service-fields";
import { StatusBadge } from "@/components/console/status-badge";
import { AppSettingsPanel } from "@/components/console/app-settings-panel";
import { AppRoutePanel } from "@/components/console/app-route-panel";
import { ConsoleFilesWorkbench } from "@/components/console/console-files-workbench";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { CountryFlagLabel } from "@/components/ui/country-flag-label";
import { FormField } from "@/components/ui/form-field";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { ProofShell, ProofShellEmpty, ProofShellRibbon } from "@/components/ui/proof-shell";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
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
  ConsoleGalleryProjectView,
  ConsoleProjectGalleryData,
} from "@/lib/console/gallery-types";
import { OPEN_CREATE_PROJECT_DIALOG_EVENT } from "@/lib/console/dialog-events";
import { readDefaultImportRuntimeId } from "@/lib/console/runtime-targets";
import {
  buildImportServicePayload,
  createImportServiceDraft,
  validateImportServiceDraft,
  type ImportServiceDraft,
} from "@/lib/fugue/import-source";
import { readGitHubCommitHref } from "@/lib/fugue/source-links";
import { isGitHubSourceType } from "@/lib/github/repository";
import type { ConsoleTone } from "@/lib/console/types";
import { parseAnsiText } from "@/lib/ui/ansi";
import { copyText } from "@/lib/ui/clipboard";
import { cx } from "@/lib/ui/cx";
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

type LogsConnectionState = "connecting" | "ended" | "error" | "idle" | "live" | "reconnecting";

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

type AppAction = "delete" | "disable" | "redeploy" | "restart" | "start";
type ProjectAction = "delete";
type WorkbenchView = "env" | "files" | "logs" | "route" | "settings";
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

type ConsoleGalleryServiceView = ConsoleGalleryProjectView["services"][number];

const WORKBENCH_VIEW_OPTIONS: readonly SegmentedControlOption<WorkbenchView>[] = [
  { value: "env", label: "Environment" },
  { value: "route", label: "Route" },
  { value: "files", label: "Files" },
  { value: "logs", label: "Logs" },
  { value: "settings", label: "Settings" },
];

const ENV_ROUTE_AND_LOGS_WORKBENCH_OPTIONS: readonly SegmentedControlOption<WorkbenchView>[] = [
  { value: "env", label: "Environment" },
  { value: "route", label: "Route" },
  { value: "logs", label: "Logs" },
  { value: "settings", label: "Settings" },
];

const LOGS_ONLY_WORKBENCH_OPTIONS: readonly SegmentedControlOption<WorkbenchView>[] = [
  { value: "logs", label: "Logs" },
];

const ENVIRONMENT_FORMAT_OPTIONS: readonly SegmentedControlOption<EnvironmentFormat>[] = [
  { value: "table", label: "Variables" },
  { value: "raw", label: "Raw" },
];

const LOG_VIEW_OPTIONS: readonly SegmentedControlOption<LogsView>[] = [
  { value: "build", label: "Build" },
  { value: "runtime", label: "Runtime" },
];

const RUNTIME_ONLY_LOG_VIEW_OPTIONS: readonly SegmentedControlOption<LogsView>[] = [
  { value: "runtime", label: "Runtime" },
];

const LOG_AUTO_REFRESH_INTERVAL_MS = 3_000;
const PROJECT_ACTIVE_REFRESH_INTERVAL_MS = 3_000;
const PROJECT_PASSIVE_REFRESH_INTERVAL_MS = 6_000;
const LOG_TAIL_LINES = 200;
const LOG_AUTO_FOLLOW_THRESHOLD_PX = 32;
const LOG_MAX_VISIBLE_LINES = 1_000;
const PENDING_COMMIT_HINT_TAIL_LINES = 1;
const TERMINAL_LOG_OPERATION_STATUSES = new Set(["canceled", "cancelled", "completed", "failed"]);

function createClientId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSuggestedProjectName(existingProjectsCount: number) {
  return `Project ${Math.max(existingProjectsCount + 1, 1)}`;
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

  return normalized.length > 0 && includesLifecycleKeyword(normalized, ["disabled", "paused"]);
}

function isPausedAppService(app?: ConsoleGalleryAppView | null) {
  return isPausedLifecycleValue(app?.phase);
}

function shouldShowLiveStatusBadge(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  return LIVE_STATUS_BADGE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function readProjectLifecycle(project: ConsoleGalleryProjectView): ProjectLifecycle {
  const tracksGitHubBranch = project.services.some(
    (service) =>
      service.kind === "app" && isGitHubSourceType(service.sourceType),
  );
  const statuses = project.services
    .map((service) =>
      service.kind === "app" ? service.phase : service.status,
    )
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (statuses.some((status) => includesLifecycleKeyword(status, ["deleting"]))) {
    return { label: "Deleting", tone: "danger", live: true, syncMode: "active" };
  }

  if (statuses.some((status) => includesLifecycleKeyword(status, ["error", "fail", "stopped"]))) {
    return { label: "Error", tone: "danger", live: false, syncMode: "passive" };
  }

  if (statuses.some((status) => includesLifecycleKeyword(status, ["importing"]))) {
    return { label: "Importing", tone: "positive", live: true, syncMode: "active" };
  }

  if (statuses.some((status) => includesLifecycleKeyword(status, ["building"]))) {
    return { label: "Building", tone: "positive", live: true, syncMode: "active" };
  }

  if (statuses.some((status) => includesLifecycleKeyword(status, ["deploying"]))) {
    return { label: "Deploying", tone: "positive", live: true, syncMode: "active" };
  }

  if (statuses.some((status) => includesLifecycleKeyword(status, ["queued", "pending", "migrating"]))) {
    return { label: "Queued", tone: "positive", live: true, syncMode: "active" };
  }

  if (statuses.length > 0 && statuses.every((status) => isPausedLifecycleValue(status))) {
    return { label: "Paused", tone: "warning", live: false, syncMode: "idle" };
  }

  if (project.appCount > 0) {
    return {
      label: "Running",
      tone: "positive",
      live: false,
      syncMode: tracksGitHubBranch ? "passive" : "idle",
    };
  }

  if (project.serviceCount > 0) {
    return { label: "Ready", tone: "positive", live: false, syncMode: "idle" };
  }

  return { label: "Idle", tone: "neutral", live: false, syncMode: "idle" };
}

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

function readStringArrayValue(record: Record<string, unknown> | null, key: string) {
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

function parseBuildLogStreamStatus(event: ParsedSSEEvent): BuildLogStreamStatus | null {
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

function parseRuntimeLogStreamState(event: ParsedSSEEvent): RuntimeLogStreamState | null {
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

function buildLogsResponseFromStatus(status: BuildLogStreamStatus): BuildLogsResponse {
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

function trimLogBody(body: string) {
  const lines = body.split("\n");

  if (lines.length <= LOG_MAX_VISIBLE_LINES) {
    return body;
  }

  return lines.slice(lines.length - LOG_MAX_VISIBLE_LINES).join("\n");
}

function isLogViewportNearBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= LOG_AUTO_FOLLOW_THRESHOLD_PX;
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
    return [source.pod, source.container].filter(Boolean).join("/") || source.jobName || "build";
  }

  return source.pod || source.container || source.component || source.stream || "runtime";
}

function appendLogBodyLine(
  currentBody: string,
  line: string,
  source: LogStreamSource | null,
  previousSourceId: string | null,
) {
  const sourceId = readLogStreamSourceId(source);
  const sourceLabel = sourceId && sourceId !== previousSourceId ? readLogStreamSourceLabel(source) : null;
  const parts = currentBody ? [currentBody] : [];

  if (sourceLabel) {
    if (currentBody) {
      parts.push("");
    }

    parts.push(`==> ${sourceLabel} <==`);
  }

  parts.push(line);

  return {
    body: trimLogBody(parts.join("\n")),
    sourceId: sourceId ?? previousSourceId,
  };
}

function appendLogBodyWarning(
  currentBody: string,
  warning: LogStreamWarning,
  previousSourceId: string | null,
) {
  const message = warning.message?.trim();

  if (!message) {
    return {
      body: currentBody,
      sourceId: previousSourceId,
    };
  }

  return appendLogBodyLine(currentBody, `[warning] ${message}`, warning.source, previousSourceId);
}

class LogStreamRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LogStreamRequestError";
    this.status = status;
  }
}

function isRetryableLogStreamError(error: unknown) {
  return !(error instanceof LogStreamRequestError) || error.status >= 500;
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

function readPreferredProjectService(services: ConsoleGalleryProjectView["services"]) {
  return (
    services.find(
      (service) => service.kind === "app" && service.serviceRole === "pending",
    ) ??
    services[0] ??
    null
  );
}

function readServiceWorkbenchOptions(
  service: ConsoleGalleryServiceView | null,
) {
  if (!service) {
    return WORKBENCH_VIEW_OPTIONS;
  }

  if (service.kind === "backing-service") {
    return LOGS_ONLY_WORKBENCH_OPTIONS;
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

function readServiceDefaultTab(service: ConsoleGalleryServiceView | null): WorkbenchView {
  if (!service) {
    return "env";
  }

  if (service.kind === "backing-service") {
    return "logs";
  }

  return service.serviceRole === "pending" ? "logs" : "env";
}

function readServiceDefaultLogsMode(
  service: ConsoleGalleryServiceView | null,
  services: ConsoleGalleryProjectView["services"],
): LogsView {
  return normalizeLogsModeForService(service, services, service?.kind === "app" ? "build" : "runtime");
}

function rowsFromEnv(env: Record<string, string>) {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      existing: true,
      id: createClientId("env"),
      key,
      originalKey: key,
      originalValue: value,
      removed: false,
      value,
    }) satisfies EnvRow);
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
  return rows.map((row) => ({
    ...row,
    id: createClientId("env"),
  }) satisfies EnvRow);
}

function buildEnvRawFeedback(rows: EnvRow[], ignoredLineCount = 0): EnvRawFeedback {
  const activeRows = rows.filter((row) => !row.removed && readEnvRowKey(row).length > 0);
  const addedCount = activeRows.filter((row) => !row.existing).length;
  const updatedCount = activeRows.filter(
    (row) => row.existing && (readEnvRowKey(row) !== row.originalKey || row.value !== row.originalValue),
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

  const parts = [`${activeRows.length} variable${activeRows.length === 1 ? "" : "s"} parsed`];

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
    return normalizedComparison.length > 0 && normalizedComparison === normalizedValue;
  });

  return duplicate ? null : trimmedValue;
}

function renderExternalText(label: string, href?: string | null, className?: string) {
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

  if (!routeLabel || normalizedRouteLabel === "unassigned" || normalizedRouteLabel.startsWith("private /")) {
    return null;
  }

  const inferredHref = routeLabel.includes("://") ? routeLabel : `https://${routeLabel}`;

  return {
    href: inferredHref,
    label: inferredHref,
  };
}

function renderCommitLink(commit: Pick<ConsoleGalleryCommitView, "exact" | "href" | "label">) {
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
    includesLifecycleKeyword(normalized, ["importing", "building", "deploying", "queued", "pending", "migrating"])
  );
}

function hasActiveBuildLogsOperation(
  buildLogs: Pick<BuildLogsResponse, "completedAt" | "operationStatus" | "startedAt"> | null | undefined,
) {
  const normalizedStatus = buildLogs?.operationStatus?.trim().toLowerCase() ?? "";

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
    if (includesLifecycleKeyword(normalizedStatus, ["queued", "pending", "migrating"])) {
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

  if (includesLifecycleKeyword(normalizedPhase, ["queued", "pending", "migrating"])) {
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

  const runningCommit = app.commitViews.find((commit) => commit.kind === "running");

  if (!runningCommit?.exact && runningCommit?.label === "Pending first import") {
    return null;
  }

  const exact = options?.exact?.trim() || null;
  const label = options?.label?.trim() || (exact ? (exact.length > 8 ? exact.slice(0, 8) : exact) : "Pending sync");
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

function inferPendingCommitHint(app: ConsoleGalleryAppView, buildLogs?: BuildLogsResponse | null) {
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
      description: "Import is still running. Switch to Build to follow progress.",
      label: "Waiting for import",
      title: "Runtime logs are not ready",
    };
  }

  if (includesLifecycleKeyword(phase, ["building"])) {
    return {
      description: "Build is still running. Switch to Build to follow progress.",
      label: "Waiting for first start",
      title: "Runtime logs are not ready",
    };
  }

  if (includesLifecycleKeyword(phase, ["deploying"])) {
    return {
      description: "Deploy is still in progress. Runtime logs unlock once the rollout is ready.",
      label: "Waiting for deploy",
      title: "Runtime logs are not ready",
    };
  }

  if (includesLifecycleKeyword(phase, ["queued", "pending", "migrating"])) {
    return {
      description: "This rollout has not reached a live runtime yet. Switch to Build to follow progress.",
      label: "Waiting in queue",
      title: "Runtime logs are not ready",
    };
  }

  if (isPausedAppService(app)) {
    return {
      description: "This app is paused. Start it to reopen runtime logs without rebuilding, or use Redeploy for a fresh build.",
      label: "Paused",
      title: "Runtime logs are unavailable",
    };
  }

  return null;
}

function readLogsDisplayBody(
  logsStatus: "error" | "idle" | "loading" | "ready",
  logsBody: string,
  connectionState: LogsConnectionState,
) {
  if (logsStatus === "loading") {
    return connectionState === "reconnecting" ? "Reconnecting to live logs…" : "Connecting to live logs…";
  }

  if (logsStatus === "error") {
    return "Unable to open the log stream.";
  }

  if (logsBody) {
    return logsBody;
  }

  if (connectionState === "live" || connectionState === "reconnecting") {
    return "Waiting for log output…";
  }

  return "No logs available.";
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

function ProjectBadge({ kind, label, meta }: { kind: ConsoleGalleryBadgeKind; label: string; meta: string }) {
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

export function ConsoleProjectGallery({
  data,
  defaultCreateOpen = false,
}: {
  data: ConsoleProjectGalleryData;
  defaultCreateOpen?: boolean;
}) {
  const confirm = useConfirmDialog();
  const router = useRouter();
  const { showToast } = useToast();
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [createOpen, setCreateOpen] = useState(defaultCreateOpen);
  const [createTargetProject, setCreateTargetProject] = useState<CreateDialogTarget | null>(null);
  const [projectName, setProjectName] = useState(buildSuggestedProjectName(data.projects.length));
  const [importDraft, setImportDraft] = useState<ImportServiceDraft>(() =>
    createImportServiceDraft(readDefaultImportRuntimeId(data.runtimeTargets)),
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedServiceKey, setSelectedServiceKey] = useState<string | null>(null);
  const [selectedAppPendingCommitHint, setSelectedAppPendingCommitHint] =
    useState<ConsoleGalleryCommitView | null>(null);
  const [activeTab, setActiveTab] = useState<WorkbenchView>("env");
  const [isCreating, setIsCreating] = useState(false);
  const [busyAction, setBusyAction] = useState<AppAction | null>(null);
  const [busyProjectAction, setBusyProjectAction] = useState<ProjectAction | null>(null);
  const [envFormat, setEnvFormat] = useState<EnvironmentFormat>("table");
  const [envStatus, setEnvStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [envBaseline, setEnvBaseline] = useState<Record<string, string>>({});
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [envLoadedAppId, setEnvLoadedAppId] = useState<string | null>(null);
  const [envRawDraft, setEnvRawDraft] = useState("");
  const [envRawFeedback, setEnvRawFeedback] = useState<EnvRawFeedback>({
    message: "Paste a .env block to expand it into individual variables.",
    tone: "info",
    valid: true,
  });
  const [envSaving, setEnvSaving] = useState(false);
  const [logsMode, setLogsMode] = useState<LogsView>("build");
  const [logsConnectionState, setLogsConnectionState] = useState<LogsConnectionState>("idle");
  const [logsStatus, setLogsStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [logsBody, setLogsBody] = useState("");
  const [logsCopyState, setLogsCopyState] = useState<"copied" | "idle" | "pending">("idle");
  const [buildLogsOperationStatus, setBuildLogsOperationStatus] = useState<string | null>(null);
  const [logsRefreshToken, setLogsRefreshToken] = useState(0);
  const [refreshWindowUntil, setRefreshWindowUntil] = useState(0);
  const logsAutoFollowRef = useRef(true);
  const logsCopyResetRef = useRef<number | null>(null);
  const logsViewportRef = useRef<HTMLPreElement | null>(null);
  const pendingCommitHintRequestPendingRef = useRef(false);
  const createBackdropPressStartedRef = useRef(false);
  const selectedServiceAppRef = useRef<ConsoleGalleryAppView | null>(null);
  const selectedAppNeedsPendingCommitHintRef = useRef(false);

  const selectedProject =
    data.projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedProjectServices = selectedProject?.services ?? [];
  const selectedProjectApps = selectedProject ? projectApps(selectedProject) : [];
  const selectedService =
    selectedProjectServices.find((service) => serviceKey(service) === selectedServiceKey) ??
    readPreferredProjectService(selectedProjectServices) ??
    null;
  const selectedServiceApp = selectedService?.kind === "app" ? selectedService : null;
  const selectedApp =
    selectedServiceApp ??
    (selectedService?.kind === "backing-service"
      ? selectedProjectApps.find((app) => app.id === selectedService.ownerAppId) ??
        selectedProjectApps.find((app) => app.id === selectedAppId) ??
        selectedProjectApps[0] ??
        null
      : selectedProjectApps.find((app) => app.id === selectedAppId) ??
        selectedProjectApps[0] ??
        null);
  const selectedServiceWorkbenchOptions = readServiceWorkbenchOptions(selectedService);
  const selectedServiceLogViewOptions = readServiceLogViewOptions(selectedService, selectedProjectServices);
  const effectiveLogsMode = normalizeLogsModeForService(selectedService, selectedProjectServices, logsMode);
  const selectedAppNeedsPendingCommitHint =
    isGitHubTrackedApp(selectedServiceApp) && !hasPendingCommitView(selectedServiceApp);
  const selectedAppUsesBuildLogStream =
    selectedServiceApp !== null && activeTab === "logs" && effectiveLogsMode === "build";
  const selectedServiceBuildLogsOperationId =
    selectedService?.kind === "app"
      ? selectedService.buildLogsOperationId?.trim() || null
      : null;
  const selectedServicePaused = isPausedAppService(selectedServiceApp);
  const logsRequestKey =
    selectedApp && selectedService
      ? `${serviceKey(selectedService)}:${effectiveLogsMode}:${effectiveLogsMode === "build" ? selectedServiceBuildLogsOperationId ?? "latest" : "live"}`
      : null;
  const logsStreamInput =
    selectedApp && selectedService
      ? selectedService.kind === "backing-service"
        ? `/api/fugue/apps/${selectedApp.id}/runtime-logs/stream?component=postgres&follow=true&tail_lines=${LOG_TAIL_LINES}`
        : effectiveLogsMode === "build"
          ? `/api/fugue/apps/${selectedApp.id}/build-logs/stream?${new URLSearchParams({
              ...(selectedServiceBuildLogsOperationId
                ? { operation_id: selectedServiceBuildLogsOperationId }
                : {}),
              follow: "true",
              tail_lines: String(LOG_TAIL_LINES),
            }).toString()}`
          : `/api/fugue/apps/${selectedApp.id}/runtime-logs/stream?component=app&follow=true&tail_lines=${LOG_TAIL_LINES}`
      : null;
  const runtimeLogsUnavailable = readRuntimeLogsUnavailableState(selectedServiceApp, effectiveLogsMode);
  const runtimeLogsUnavailableKey = runtimeLogsUnavailable
    ? `${selectedApp?.id ?? "none"}:${runtimeLogsUnavailable.label}`
    : null;
  const dataErrorMessage = data.errors.length
    ? `Partial Fugue data: ${data.errors.join(" | ")}.`
    : null;
  const dataErrorVariant = data.errors.length >= 3 ? "error" : "info";
  const projectLifecycles = data.projects.map((project) => readProjectLifecycle(project));
  const hasLiveProjects = projectLifecycles.some((lifecycle) => lifecycle.syncMode === "active");
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
  const createDialogEyebrow = isCreateServiceMode ? "Add service" : "Create project";
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
  selectedServiceAppRef.current = selectedServiceApp;
  selectedAppNeedsPendingCommitHintRef.current = selectedAppNeedsPendingCommitHint;
  const logsDisplayBody = readLogsDisplayBody(logsStatus, logsBody, logsConnectionState);
  const canCopyLogs =
    activeTab === "logs" &&
    logsStatus === "ready" &&
    !runtimeLogsUnavailable &&
    logsBody.trim().length > 0;
  const logsRefreshStateLabel = runtimeLogsUnavailable
    ? runtimeLogsUnavailable.label
    : logsConnectionState === "connecting"
      ? "Connecting"
      : logsConnectionState === "reconnecting"
        ? "Reconnecting"
        : logsConnectionState === "live"
          ? "Live"
          : logsConnectionState === "ended"
            ? effectiveLogsMode === "build" && buildLogsOperationStatus
              ? humanizeUiLabel(buildLogsOperationStatus)
              : "Ended"
            : logsConnectionState === "error"
              ? "Error"
              : "Idle";
  const logsPanelNote = runtimeLogsUnavailable
    ? runtimeLogsUnavailable.description
    : logsConnectionState === "reconnecting"
      ? `Connection dropped. Reconnecting to ${humanizeUiLabel(effectiveLogsMode).toLowerCase()} output.`
      : logsConnectionState === "ended"
        ? `${humanizeUiLabel(effectiveLogsMode)} stream closed. Use Refresh now to reopen the latest snapshot.`
      : logsConnectionState === "error"
        ? `Unable to open the ${humanizeUiLabel(effectiveLogsMode).toLowerCase()} stream. Use Refresh now to try again.`
        : `Live ${humanizeUiLabel(effectiveLogsMode).toLowerCase()} output for ${selectedService?.name ?? "this service"}.`;

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

  function clearLogsCopyResetTimer() {
    if (logsCopyResetRef.current !== null) {
      window.clearTimeout(logsCopyResetRef.current);
      logsCopyResetRef.current = null;
    }
  }

  function handleCreateBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    createBackdropPressStartedRef.current = event.target === event.currentTarget;
  }

  function handleCreateBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    const shouldClose =
      createBackdropPressStartedRef.current && event.target === event.currentTarget;

    createBackdropPressStartedRef.current = false;

    if (!shouldClose) {
      return;
    }

    closeCreate();
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
    setImportDraft((current) => ({
      ...current,
      runtimeId:
        current.runtimeId && data.runtimeTargets.some((target) => target.id === current.runtimeId)
          ? current.runtimeId
          : readDefaultImportRuntimeId(data.runtimeTargets),
    }));
  }, [data.runtimeTargets]);

  useEffect(() => {
    if (!createOpen && !isCreating) {
      setProjectName(buildSuggestedProjectName(data.projects.length));
    }
  }, [createOpen, data.projects.length, isCreating]);

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
      const defaultService = readPreferredProjectService(selectedProject.services);

      if (!defaultService) {
        setSelectedAppId(null);
        return;
      }

      setSelectedServiceKey(serviceKey(defaultService));
      setSelectedAppId(
        defaultService.kind === "app"
          ? defaultService.id
          : defaultService.ownerAppId ?? selectedProjectApps[0]?.id ?? null,
      );
      return;
    }

    if (selectedService.kind === "backing-service" && selectedAppId !== selectedService.ownerAppId) {
      setSelectedAppId(selectedService.ownerAppId ?? selectedProjectApps[0]?.id ?? null);
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
    const nextLogsMode = normalizeLogsModeForService(selectedService, selectedProjectServices, logsMode);

    if (!supportsActiveTab) {
      setActiveTab(
        selectedServiceWorkbenchOptions.some((option) => option.value === defaultTab)
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
    if (activeTab !== "logs") {
      return;
    }

    logsAutoFollowRef.current = true;

    const frame = window.requestAnimationFrame(() => {
      scrollLogsToBottom();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab, logsRequestKey, logsRefreshToken]);

  useEffect(() => {
    if (activeTab !== "logs" || !logsAutoFollowRef.current) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollLogsToBottom();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab, logsBody]);

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
    setLogsCopyState("idle");
    clearLogsCopyResetTimer();
  }, [activeTab, logsRefreshToken, logsRequestKey]);

  useEffect(() => {
    return () => {
      clearLogsCopyResetTimer();
    };
  }, []);

  useEffect(() => {
    const handleCreateProjectDialogOpen = () => {
      openCreate();
    };

    window.addEventListener(OPEN_CREATE_PROJECT_DIALOG_EVENT, handleCreateProjectDialogOpen);

    return () => {
      window.removeEventListener(OPEN_CREATE_PROJECT_DIALOG_EVENT, handleCreateProjectDialogOpen);
    };
  }, [data.projects.length, data.runtimeTargets]);

  useEffect(() => {
    if (!selectedServiceApp) {
      setEnvStatus("idle");
      setEnvBaseline({});
      setEnvRows([]);
      setEnvLoadedAppId(null);
      setEnvRawDraft("");
      setEnvRawFeedback({
        message: "Paste a .env block to expand it into individual variables.",
        tone: "info",
        valid: true,
      });
      return;
    }

    if (activeTab !== "env" || envLoadedAppId === selectedServiceApp.id) {
      return;
    }

    let cancelled = false;
    setEnvStatus("loading");

    requestJson<EnvResponse>(`/api/fugue/apps/${selectedServiceApp.id}/env`)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const nextEnv = response.env ?? {};
        const nextRows = rowsFromEnv(nextEnv);
        setEnvBaseline(nextEnv);
        setEnvRows(nextRows);
        setEnvLoadedAppId(selectedServiceApp.id);
        setEnvRawDraft(serializeEnvEntries(entriesFromEnvRecord(nextEnv)));
        setEnvRawFeedback(buildEnvRawFeedback(nextRows));
        setEnvStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
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
  }, [activeTab, envLoadedAppId, selectedServiceApp]);

  useEffect(() => {
    if (selectedApp) {
      return;
    }

    setLogsConnectionState("idle");
    setLogsStatus("idle");
    setLogsBody("");
    setBuildLogsOperationStatus(null);
  }, [selectedApp?.id]);

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
      if (document.visibilityState !== "visible" || pendingCommitHintRequestPendingRef.current) {
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
  }, [selectedServiceApp, selectedAppNeedsPendingCommitHint, selectedAppUsesBuildLogStream]);

  useEffect(() => {
    if (!selectedApp || activeTab !== "logs" || !logsStreamInput || !logsRequestKey) {
      return;
    }

    const streamInput = logsStreamInput;

    if (runtimeLogsUnavailable) {
      setLogsConnectionState("idle");
      setLogsStatus("idle");
      setLogsBody("");

      if (effectiveLogsMode !== "build") {
        setBuildLogsOperationStatus(null);
      }

      return;
    }

    let cancelled = false;
    let retryDelayMs = LOG_AUTO_REFRESH_INTERVAL_MS;
    let reconnectTimer: number | null = null;
    let activeController: AbortController | null = null;
    let latestCursor = "";
    let lastRenderedSourceId: string | null = null;
    let streamEnded = false;

    function clearReconnectTimer() {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function scheduleReconnect() {
      if (cancelled || streamEnded) {
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
      activeController?.abort();
      activeController = new AbortController();
      streamEnded = false;

      if (mode === "initial") {
        latestCursor = "";
        lastRenderedSourceId = null;
        setLogsBody("");
        setLogsStatus("loading");
        setLogsConnectionState("connecting");
        setBuildLogsOperationStatus(null);
      } else {
        setLogsConnectionState("reconnecting");
        setLogsStatus((current) => (current === "ready" ? "ready" : "loading"));
      }

      const streamUrl =
        mode === "reconnect" && latestCursor
          ? `${streamInput}&cursor=${encodeURIComponent(latestCursor)}`
          : streamInput;

      try {
        const response = await fetch(streamUrl, {
          cache: "no-store",
          headers: {
            Accept: "text/event-stream",
          },
          signal: activeController.signal,
        });

        if (!response.ok) {
          throw new LogStreamRequestError(response.status, await readResponseError(response));
        }

        if (!response.body) {
          throw new Error("Streaming response body is unavailable.");
        }

        await consumeSSEStream(response, {
          onRetry(milliseconds) {
            if (milliseconds > 0) {
              retryDelayMs = milliseconds;
            }
          },
          onEvent(event) {
            if (event.id) {
              latestCursor = event.id;
            }

            switch (event.event) {
              case "ready":
                setLogsConnectionState("live");
                setLogsStatus("ready");
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
                setBuildLogsOperationStatus(status.operationStatus ?? null);

                const app = selectedServiceAppRef.current;
                setSelectedAppPendingCommitHint(
                  app && selectedAppNeedsPendingCommitHintRef.current
                    ? inferPendingCommitHint(app, buildLogsResponseFromStatus(status))
                    : null,
                );
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
                setLogsBody((current) => {
                  const next = appendLogBodyLine(
                    current,
                    logLine.line,
                    logLine.source,
                    lastRenderedSourceId,
                  );
                  lastRenderedSourceId = next.sourceId;
                  return next.body;
                });
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
                setLogsBody((current) => {
                  const next = appendLogBodyWarning(current, warning, lastRenderedSourceId);
                  lastRenderedSourceId = next.sourceId;
                  return next.body;
                });
                return;
              }
              case "heartbeat":
                setLogsConnectionState("live");
                setLogsStatus("ready");
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

        if (cancelled || activeController.signal.aborted || streamEnded) {
          return;
        }

        scheduleReconnect();
      } catch (error) {
        if (cancelled || activeController?.signal.aborted) {
          return;
        }

        if (!isRetryableLogStreamError(error)) {
          if (effectiveLogsMode === "build") {
            const app = selectedServiceAppRef.current;
            setSelectedAppPendingCommitHint(
              app && selectedAppNeedsPendingCommitHintRef.current
                ? inferPendingCommitHint(app, null)
                : null,
            );
          }

          setLogsConnectionState("error");
          setLogsStatus("error");
          setFlash({
            message: readErrorMessage(error),
            variant: "error",
          });
          return;
        }

        scheduleReconnect();
      }
    }

    void openStream("initial");

    return () => {
      cancelled = true;
      clearReconnectTimer();
      activeController?.abort();
    };
  }, [
    activeTab,
    effectiveLogsMode,
    logsRefreshToken,
    logsRequestKey,
    logsStreamInput,
    selectedApp?.id,
    selectedServiceApp?.phase,
    runtimeLogsUnavailableKey,
  ]);

  useEffect(() => {
    if (!projectRefreshIntervalMs) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const refreshWindowExpired = refreshWindowUntil > 0 && refreshWindowUntil <= Date.now();

      if (refreshWindowExpired) {
        setRefreshWindowUntil(0);
        if (!hasLiveProjects && !hasPassiveSyncProjects) {
          return;
        }
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    }, projectRefreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasLiveProjects, hasPassiveSyncProjects, projectRefreshIntervalMs, refreshWindowUntil, router]);

  function resetCreateForm(nextProjectName: string) {
    setProjectName(nextProjectName);
    setImportDraft(createImportServiceDraft(readDefaultImportRuntimeId(data.runtimeTargets)));
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
    resetCreateForm(buildSuggestedProjectName(data.projects.length));
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
      resetCreateForm(buildSuggestedProjectName(data.projects.length + 1));
      clearCreateDialogUrl();
      startTransition(() => {
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
          : defaultService.ownerAppId ?? projectApps(project)[0]?.id ?? null
        : null,
    );
    setActiveTab(readServiceDefaultTab(defaultService));
    setLogsMode(readServiceDefaultLogsMode(defaultService, project.services));
  }

  function chooseService(service: ConsoleGalleryServiceView) {
    setSelectedServiceKey(serviceKey(service));
    setSelectedAppId(service.kind === "app" ? service.id : service.ownerAppId ?? selectedAppId);
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
        message: selectedServiceApp.redeployDisabledReason ?? "Redeploy is not available for this app.",
        variant: "error",
      });
      return;
    }

    if (action === "delete") {
      const confirmed = await confirm({
        confirmLabel: "Delete service",
        description: `${selectedServiceApp.name} will be queued for deletion from this project.`,
        title: "Delete service?",
      });

      if (!confirmed) {
        return;
      }
    }

    const nextAction = action === "restart" && isPausedAppService(selectedServiceApp) ? "start" : action;

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
      }

      await requestJson(input, { method });
      armRefreshWindow(refreshWindowMs);

      if (nextAction === "redeploy") {
        setActiveTab("logs");
        setLogsMode("build");
        setLogsRefreshToken((value) => value + 1);
      }

      setFlash({
        message: successMessage,
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
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
      setSelectedProjectId((current) => (current === project.id ? null : current));
      setSelectedServiceKey(null);
      setSelectedAppId(null);
      setFlash({
        message: "Project deleted.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
      });
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

  function updateEnvRow(rowId: string, field: "key" | "value", nextValue: string) {
    setEnvRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: nextValue } : row)),
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

    const nextRows = rowsFromEnvDrafts(buildEnvDraftRowsFromEntries(parsed.entries, envBaseline));
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
      (row) => readEnvRowKey(row).length === 0 && (row.existing || row.value.length > 0),
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

    const deletePayload = [...deleteSet].sort((left, right) => left.localeCompare(right));

    if (!Object.keys(setPayload).length && !deletePayload.length) {
      setFlash({
        message: "No environment changes.",
        variant: "info",
      });
      return;
    }

    setEnvSaving(true);

    try {
      const response = await requestJson<EnvResponse>(`/api/fugue/apps/${selectedServiceApp.id}/env`, {
        body: JSON.stringify({
          delete: deletePayload,
          set: setPayload,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      armRefreshWindow(45_000);
      const nextEnv = response.env ?? {};
      const nextRows = rowsFromEnv(nextEnv);
      setEnvBaseline(nextEnv);
      setEnvRows(nextRows);
      setEnvLoadedAppId(selectedServiceApp.id);
      setEnvRawDraft(serializeEnvEntries(entriesFromEnvRecord(nextEnv)));
      setEnvRawFeedback(buildEnvRawFeedback(nextRows));
      setFlash({
        message: "Environment changes queued.",
        variant: "success",
      });
      startTransition(() => {
        router.refresh();
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

  function refreshLogs() {
    setFlash(null);
    setLogsRefreshToken((value) => value + 1);
  }

  async function handleCopyLogs() {
    if (!canCopyLogs || logsCopyState === "pending") {
      return;
    }

    clearLogsCopyResetTimer();
    setLogsCopyState("pending");

    try {
      const plainLogsBody = readPlainLogBody(logsBody);

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
                    <Button onClick={() => openCreateService(project)} size="compact" type="button" variant="primary">
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
                        This project still exists in Fugue, but it does not currently have any running
                        services or attached backing services.
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
                      <p className="fg-label fg-project-toolbar__label">Actions</p>
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
                        Empty projects used to be hidden from the gallery. They now stay visible so
                        you can reuse the shell or delete it explicitly.
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
    const selectedServiceWorkspacePath =
      selectedService.kind === "app" &&
      selectedService.serviceRole === "running" &&
      !selectedServicePaused
        ? readDistinctText(selectedService.workspaceMountPath)
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
                  <Button onClick={() => openCreateService(project)} size="compact" type="button" variant="primary">
                    Add service
                  </Button>
                </div>
              </PanelSection>

              <PanelSection>
                <ul className="fg-project-service-list">
                  {project.services.map((service) => {
                    const active = serviceKey(selectedService) === serviceKey(service);
                    const serviceStatus = service.kind === "app" ? service.phase : service.status;
                    const serviceStatusTone =
                      service.kind === "app" ? service.phaseTone : service.statusTone;
                    const cardSecondaryLines =
                      service.kind === "app"
                        ? [readDistinctText(service.sourceMeta, [service.name])]
                        : [
                            readDistinctText(service.ownerAppLabel, [service.name]),
                            readDistinctText(`Service / ${service.type}`, [service.name, service.ownerAppLabel]),
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
                          className={cx("fg-project-service-card", active && "is-active")}
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
                                <StatusBadge live={shouldShowLiveStatusBadge(serviceStatus)} tone={serviceStatusTone}>
                                  {serviceStatus}
                                </StatusBadge>
                                {cardStatusMeta ? (
                                  <span className="fg-project-service-card__status-meta">{cardStatusMeta}</span>
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
                    <PanelTitle>{selectedService.name}</PanelTitle>
                    {selectedServiceSummary ? (
                      <PanelCopy className="fg-project-inspector__copy">{selectedServiceSummary}</PanelCopy>
                    ) : null}
                  </div>
                </div>

                <div className="fg-project-inspector__meta-grid">
                  {selectedService.kind === "app" ? (
                    <>
                      <div>
                        <dt>Commit</dt>
                        <dd>{renderCommitText(selectedService, selectedAppPendingCommitHint)}</dd>
                      </div>
                      <div>
                        <dt>Build</dt>
                        <dd>{selectedService.sourceMeta}</dd>
                      </div>
                      {selectedServiceUrl ? (
                        <div>
                          <dt>URL</dt>
                          <dd>{renderExternalText(selectedServiceUrl.label, selectedServiceUrl.href)}</dd>
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
                      {selectedService.serviceRole === "running" && selectedServiceWorkspacePath ? (
                        <div>
                          <dt>Workspace</dt>
                          <dd>{selectedServiceWorkspacePath}</dd>
                        </div>
                      ) : null}
                      {selectedService.serviceRole === "pending" && selectedService.serviceDurationLabel ? (
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
                  {selectedService.kind === "app" && selectedService.serviceRole === "running" ? (
                    <div className="fg-project-toolbar__group">
                      <p className="fg-label fg-project-toolbar__label">Actions</p>
                      <div className="fg-project-actions">
                        <Button
                          disabled={!selectedService.canRedeploy || Boolean(busyAction && busyAction !== "redeploy")}
                          loading={busyAction === "redeploy"}
                          loadingLabel={selectedService.redeployActionLoadingLabel}
                          onClick={() => handleAppAction("redeploy")}
                          size="compact"
                          title={
                            selectedService.canRedeploy
                              ? selectedService.redeployActionDescription
                              : selectedService.redeployDisabledReason ?? undefined
                          }
                          type="button"
                          variant="primary"
                        >
                          {selectedService.redeployActionLabel}
                        </Button>
                        <Button
                          disabled={Boolean(busyAction && busyAction !== (selectedServicePaused ? "start" : "restart"))}
                          loading={busyAction === (selectedServicePaused ? "start" : "restart")}
                          loadingLabel={selectedServicePaused ? "Starting…" : "Restarting…"}
                          onClick={() => handleAppAction(selectedServicePaused ? "start" : "restart")}
                          size="compact"
                          title={
                            selectedServicePaused
                              ? "Start this paused app at 1 replica without rebuilding the image."
                              : "Restart the current release without rebuilding the image. Persistent workspace is preserved when configured."
                          }
                          type="button"
                          variant="secondary"
                        >
                          {selectedServicePaused ? "Start" : "Restart"}
                        </Button>
                        {selectedServicePaused ? null : (
                          <Button
                            disabled={Boolean(busyAction && busyAction !== "disable")}
                            loading={busyAction === "disable"}
                            loadingLabel="Pausing…"
                            onClick={() => handleAppAction("disable")}
                            size="compact"
                            type="button"
                            variant="secondary"
                          >
                            Pause
                          </Button>
                        )}
                        <Button
                          disabled={Boolean(busyAction && busyAction !== "delete")}
                          loading={busyAction === "delete"}
                          loadingLabel="Deleting…"
                          onClick={() => handleAppAction("delete")}
                          size="compact"
                          type="button"
                          variant="danger"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="fg-project-toolbar__group fg-project-toolbar__group--tabs">
                    <p className="fg-label fg-project-toolbar__label">Panels</p>
                    <SegmentedControl
                      ariaLabel="Service panels"
                      onChange={setActiveTab}
                      options={selectedServiceWorkbenchOptions}
                      value={
                        selectedServiceWorkbenchOptions.some((option) => option.value === activeTab)
                          ? activeTab
                          : "logs"
                      }
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
                          onChange={changeEnvFormat}
                          options={ENVIRONMENT_FORMAT_OPTIONS}
                          value={envFormat}
                        />
                        {envFormat === "table" ? (
                          <Button onClick={addEnvRow} size="compact" type="button" variant="secondary">
                            Add variable
                          </Button>
                        ) : (
                          <Button onClick={resetEnvRawDraft} size="compact" type="button" variant="secondary">
                            Reset raw
                          </Button>
                        )}
                        <Button
                          disabled={envStatus === "loading" || (envFormat === "raw" && !envRawFeedback.valid)}
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
                        {envRows.length ? (
                          <>
                            <div aria-hidden="true" className="fg-env-table__head">
                              <span>Key</span>
                              <span>Value</span>
                              <span>Action</span>
                            </div>
                            {envRows.map((row) => (
                              <div
                                className={cx(
                                  "fg-env-row",
                                  row.removed && "is-removed",
                                )}
                                key={row.id}
                              >
                                <input
                                  aria-label={`${row.key || row.originalKey || "New variable"} Key`}
                                  autoCapitalize="off"
                                  autoCorrect="off"
                                  className="fg-input"
                                  disabled={row.removed}
                                  onChange={(event) => updateEnvRow(row.id, "key", event.target.value)}
                                  placeholder="Name"
                                  spellCheck={false}
                                  value={row.key}
                                />
                                <input
                                  aria-label={`${row.key || row.originalKey || "New variable"} Value`}
                                  autoCapitalize="off"
                                  autoCorrect="off"
                                  className="fg-input"
                                  disabled={row.removed}
                                  onChange={(event) => updateEnvRow(row.id, "value", event.target.value)}
                                  placeholder="Value"
                                  spellCheck={false}
                                  value={row.value}
                                />
                                <Button onClick={() => removeEnvRow(row.id)} type="button" variant="ghost">
                                  {row.existing ? (row.removed ? "Undo" : "Remove") : "Discard"}
                                </Button>
                              </div>
                            ))}
                          </>
                        ) : (
                          <p className="fg-console-note">
                            No environment variables yet. Add one manually or switch to Raw to paste a .env block.
                          </p>
                        )}
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
                            envRawFeedback.tone === "error" && "fg-inline-alert--error",
                            envRawFeedback.tone === "info" && "fg-inline-alert--info",
                            envRawFeedback.tone === "success" && "fg-inline-alert--success",
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
                    workspaceMountPath={selectedService.workspaceMountPath}
                  />
                ) : null}

                {activeTab === "logs" ? (
                  <div className="fg-workbench-section">
                    <div className="fg-workbench-section__head">
                      <div className="fg-workbench-section__copy">
                        <p className="fg-label fg-panel__eyebrow">Logs</p>
                        <p className="fg-console-note">{logsPanelNote}</p>
                      </div>

                      <div className="fg-workbench-section__actions">
                        {selectedService.kind === "app" ? (
                          <SegmentedControl
                            ariaLabel="Log views"
                            onChange={(nextMode) => {
                              setLogsMode(nextMode);
                            }}
                            options={selectedServiceLogViewOptions}
                            value={effectiveLogsMode}
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
                        <Button onClick={refreshLogs} size="compact" type="button" variant="secondary">
                          Refresh now
                        </Button>
                      </div>
                    </div>

                    <ProofShell>
                      <ProofShellRibbon>
                        <span>{logsRefreshStateLabel}</span>
                      </ProofShellRibbon>
                      {runtimeLogsUnavailable ? (
                        <ProofShellEmpty
                          description={runtimeLogsUnavailable.description}
                          title={runtimeLogsUnavailable.title}
                        />
                      ) : (
                        <pre
                          className="fg-log-output__viewport"
                          onScroll={handleLogsViewportScroll}
                          ref={logsViewportRef}
                        >
                          <code className="fg-log-output">{renderAnsiLogBody(logsDisplayBody)}</code>
                        </pre>
                      )}
                    </ProofShell>
                  </div>
                ) : null}

                {selectedService.kind === "app" && activeTab === "settings" ? (
                  <AppSettingsPanel
                    app={selectedService}
                    projectCatalog={data.projects.map((item) => ({
                      id: item.id,
                      name: item.name,
                    }))}
                    projectId={project.id}
                    projectManaged={project.id !== "unassigned"}
                    projectName={project.name}
                    serviceCount={project.serviceCount}
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
            !data.projects.length && "fg-project-gallery__shelf--empty",
          )}
        >
          {data.projects.length ? (
            <div className="fg-project-gallery__stack">
              {data.projects.map((project) => {
                const expanded = selectedProjectId === project.id;
                const detailId = `project-detail-${project.id}`;

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
                          {project.resourceUsage.map((resource) => (
                            <CompactResourceMeter item={resource} key={resource.id} />
                          ))}
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

                    {expanded ? renderProjectWorkbench(project, detailId) : null}
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
                <PanelTitle className="fg-console-dialog__title" id="fugue-create-project-title">
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

                    <ImportServiceFields
                      draft={importDraft}
                      idPrefix="create-service"
                      includeWrapper={false}
                      inventoryError={data.runtimeTargetInventoryError}
                      onDraftChange={setImportDraft}
                      runtimeTargets={data.runtimeTargets}
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
