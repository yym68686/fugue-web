"use client";

import { startTransition, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/console/status-badge";
import { ConsoleFilesWorkbench } from "@/components/console/console-files-workbench";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
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
  ConsoleGalleryProjectView,
  ConsoleProjectGalleryData,
} from "@/lib/console/gallery-types";
import { readGitHubSourceHref } from "@/lib/fugue/source-links";
import type { ConsoleTone } from "@/lib/console/types";
import { parseAnsiText } from "@/lib/ui/ansi";
import { cx } from "@/lib/ui/cx";

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
  buildStrategy?: string | null;
  errorMessage?: string | null;
  jobName?: string | null;
  logs?: string;
  operationStatus?: string | null;
  resultMessage?: string | null;
  source?: string | null;
};

type RuntimeLogsResponse = {
  component?: string | null;
  logs?: string;
  pods?: string[];
  warnings?: string[];
};

type AppAction = "delete" | "disable" | "redeploy" | "restart";
type WorkbenchView = "env" | "files" | "logs";
type EnvironmentFormat = "raw" | "table";
type LogsView = "build" | "runtime";
type RuntimeView = "app" | "postgres";

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

type BuildStrategyValue =
  | "auto"
  | "buildpacks"
  | "dockerfile"
  | "nixpacks"
  | "static-site";

type LogMetaItem = {
  href: string | null;
  id: string;
  label: string;
};

type RuntimeLogsUnavailableState = {
  description: string;
  metaLabel: string;
  refreshLabel: string;
  title: string;
};

const BUILD_STRATEGY_OPTIONS = [
  { label: "Auto detect", value: "auto" },
  { label: "Static site", value: "static-site" },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "Buildpacks", value: "buildpacks" },
  { label: "Nixpacks", value: "nixpacks" },
] as const satisfies Array<{
  label: string;
  value: BuildStrategyValue;
}>;

const WORKBENCH_VIEW_OPTIONS: readonly SegmentedControlOption<WorkbenchView>[] = [
  { value: "env", label: "Environment" },
  { value: "files", label: "Files" },
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

const RUNTIME_VIEW_OPTIONS: readonly SegmentedControlOption<RuntimeView>[] = [
  { value: "app", label: "App" },
  { value: "postgres", label: "Postgres" },
];

const LOG_AUTO_REFRESH_INTERVAL_MS = 3_000;
const PROJECT_ACTIVE_REFRESH_INTERVAL_MS = 3_000;
const PROJECT_PASSIVE_REFRESH_INTERVAL_MS = 6_000;
const LOG_TAIL_LINES = 200;
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

function includesLifecycleKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function readProjectLifecycle(project: ConsoleGalleryProjectView): ProjectLifecycle {
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

  if (statuses.length > 0 && statuses.every((status) => includesLifecycleKeyword(status, ["disabled"]))) {
    return { label: "Paused", tone: "warning", live: false, syncMode: "idle" };
  }

  if (project.appCount > 0) {
    return { label: "Deployed", tone: "positive", live: false, syncMode: "idle" };
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

function projectApps(project: ConsoleGalleryProjectView) {
  return project.services.filter((service): service is { kind: "app" } & ConsoleGalleryAppView => service.kind === "app");
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

function entriesFromEnvRows(rows: EnvRow[]) {
  return rows.flatMap((row) => {
    if (row.removed) {
      return [];
    }

    const key = row.existing ? row.originalKey : row.key.trim();

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
  const activeRows = rows.filter((row) => !row.removed);
  const addedCount = activeRows.filter((row) => !row.existing).length;
  const updatedCount = activeRows.filter(
    (row) => row.existing && row.value !== row.originalValue,
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

function renderOptionalExternalText(label?: string | null, href?: string | null, className?: string) {
  if (!label) {
    return <span className={className}>—</span>;
  }

  return renderExternalText(label, href, className);
}

function renderCommitText(app: ConsoleGalleryAppView) {
  if (!app.currentCommitLabel) {
    return <span>—</span>;
  }

  if (!app.currentCommitHref) {
    return <span title={app.currentCommitExact ?? undefined}>{app.currentCommitLabel}</span>;
  }

  return (
    <a
      className="fg-text-link"
      href={app.currentCommitHref}
      rel="noreferrer"
      target="_blank"
      title={app.currentCommitExact ?? app.currentCommitHref}
    >
      {app.currentCommitLabel}
    </a>
  );
}

function LocalDateTimeNote({
  className,
  prefix,
  value,
}: {
  className?: string;
  prefix: string;
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
      {prefix} {formatted}
    </time>
  );
}

function readTrackingLabel(app: ConsoleGalleryAppView) {
  if (app.sourceType?.trim().toLowerCase() !== "github-public") {
    return null;
  }

  const parts = [app.sourceBranchLabel, app.currentCommitLabel].filter(
    (value): value is string => Boolean(value),
  );

  if (!parts.length) {
    return "Tracking branch";
  }

  return `Tracking ${parts.join(" · ")}`;
}

function renderLogMetaItem(item: LogMetaItem): ReactNode {
  if (!item.href) {
    return <span key={item.id}>{item.label}</span>;
  }

  return (
    <a
      className="fg-text-link"
      href={item.href}
      key={item.id}
      rel="noreferrer"
      target="_blank"
      title={item.href}
    >
      {item.label}
    </a>
  );
}

function buildLogMeta(buildLogs: BuildLogsResponse) {
  const sourceHref = readGitHubSourceHref(buildLogs.source);
  const items: LogMetaItem[] = [];

  if (buildLogs.buildStrategy) {
    items.push({
      href: null,
      id: `build:${buildLogs.buildStrategy}`,
      label: `Build / ${humanizeUiLabel(buildLogs.buildStrategy)}`,
    });
  }

  if (buildLogs.source) {
    items.push({
      href: sourceHref,
      id: `source:${buildLogs.source}`,
      label: `Source / ${buildLogs.source}`,
    });
  }

  if (buildLogs.jobName) {
    items.push({
      href: null,
      id: `job:${buildLogs.jobName}`,
      label: `Job / ${buildLogs.jobName}`,
    });
  }

  if (buildLogs.operationStatus) {
    items.push({
      href: null,
      id: `status:${buildLogs.operationStatus}`,
      label: `Status / ${humanizeUiLabel(buildLogs.operationStatus)}`,
    });
  }

  if (buildLogs.errorMessage) {
    items.push({
      href: null,
      id: `error:${buildLogs.errorMessage}`,
      label: `Error / ${buildLogs.errorMessage}`,
    });
  }

  if (buildLogs.resultMessage) {
    items.push({
      href: null,
      id: `result:${buildLogs.resultMessage}`,
      label: `Result / ${buildLogs.resultMessage}`,
    });
  }

  return items;
}

function shouldAutoRefreshBuildLogs(status?: string | null) {
  return !TERMINAL_LOG_OPERATION_STATUSES.has(status?.toLowerCase() ?? "");
}

function runtimeLogMeta(runtimeLogs: RuntimeLogsResponse) {
  const items: LogMetaItem[] = [];

  if (runtimeLogs.component) {
    items.push({
      href: null,
      id: `component:${runtimeLogs.component}`,
      label: `Component / ${humanizeUiLabel(runtimeLogs.component)}`,
    });
  }

  if (runtimeLogs.pods?.length) {
    items.push({
      href: null,
      id: `pods:${runtimeLogs.pods.join(",")}`,
      label: `Pods / ${runtimeLogs.pods.join(", ")}`,
    });
  }

  if (runtimeLogs.warnings?.length) {
    items.push({
      href: null,
      id: `warnings:${runtimeLogs.warnings.join("|")}`,
      label: `Warnings / ${runtimeLogs.warnings.join(" | ")}`,
    });
  }

  return items;
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
        "Source import is still in progress. Switch to Build to watch the import -> deploy chain. Runtime logs appear after the first container starts.",
      metaLabel: "State / Importing",
      refreshLabel: "Runtime / Waiting for import",
      title: "Runtime logs unlock after import",
    };
  }

  if (includesLifecycleKeyword(phase, ["building"])) {
    return {
      description:
        "This service is still building. Switch to Build to follow the import -> deploy chain. Runtime logs appear after the first container starts.",
      metaLabel: "State / Building",
      refreshLabel: "Runtime / Waiting for first start",
      title: "Runtime logs start after build",
    };
  }

  if (includesLifecycleKeyword(phase, ["deploying"])) {
    return {
      description:
        "The release is still deploying. Fugue keeps this deploy running until the rollout is ready, even after the first container is live.",
      metaLabel: "State / Deploying",
      refreshLabel: "Runtime / Waiting for deploy",
      title: "Runtime logs unlock after deploy",
    };
  }

  if (includesLifecycleKeyword(phase, ["queued", "pending", "migrating"])) {
    return {
      description:
        "This rollout has not reached a live runtime yet. Switch to Build to watch progress, then return here once the container starts.",
      metaLabel: "State / Queued",
      refreshLabel: "Runtime / Waiting in queue",
      title: "Runtime logs are not live yet",
    };
  }

  return null;
}

function readLogsDisplayBody(logsStatus: "error" | "idle" | "loading" | "ready", logsBody: string) {
  if (logsStatus === "loading") {
    return "Loading logs…";
  }

  if (logsStatus === "error") {
    return "Unable to load logs.";
  }

  return logsBody || "No logs available.";
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

function StackGlyph({ kind }: { kind: ConsoleGalleryBadgeKind }) {
  switch (kind) {
    case "python":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12.1 2.5c4.6 0 4.3 2 4.3 2v3H9.6v1h9.2c0 0 2.2-.24 2.2 3.2 0 3.44-1.92 3.32-1.92 3.32h-1.14v-1.62c0-1.78-1.54-3.42-3.42-3.42H8.88c-1.78 0-3.38-1.52-3.38-3.42V5.92C5.5 4.14 7 2.5 8.92 2.5h3.18Zm1.74 1.18a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z"
            fill="currentColor"
          />
          <path
            d="M11.9 21.5c-4.6 0-4.3-2-4.3-2v-3h6.8v-1H5.2s-2.2.24-2.2-3.2c0-3.44 1.92-3.32 1.92-3.32h1.14v1.62c0 1.78 1.54 3.42 3.42 3.42h5.64c1.78 0 3.38 1.52 3.38 3.42v2.66c0 1.78-1.5 3.42-3.42 3.42H11.9Zm-1.74-1.18a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
            fill="currentColor"
          />
        </svg>
      );
    case "node":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="m12 2.3 8.1 4.7v9.4L12 21.1l-8.1-4.7V7L12 2.3Zm0 2.31L5.9 8.1v7.8l6.1 3.5 6.1-3.5V8.1L12 4.61Z"
            fill="currentColor"
          />
          <path
            d="M9 8.8h1.46l3.08 4.79V8.8H15v6.4h-1.4l-3.14-4.9v4.9H9V8.8Z"
            fill="currentColor"
          />
        </svg>
      );
    case "go":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M3 9.3h6.2v1.5H3V9.3Zm0 3h4.4v1.5H3v-1.5Zm10.1-2.2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 1.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm7.1-1.8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 1.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"
            fill="currentColor"
          />
        </svg>
      );
    case "java":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M13.2 3.4c1.72 1.34-1.5 2.07-.7 3.7.43.88 2.35 1.3 1.98 2.86-.24 1.03-1.42 1.74-3.44 2.1 1.2-.52 1.86-1.12 1.98-1.8.2-1.14-1.42-1.64-1.74-2.86-.34-1.32.74-2.38 1.92-4Z"
            fill="currentColor"
          />
          <path
            d="M7.2 14.6c0 1.18 2.42 1.54 4.86 1.54 2.42 0 4.64-.42 4.64-1.38 0-.4-.4-.76-1.08-1.06 1.36.14 2.56.74 2.56 1.72 0 1.64-2.92 2.42-6.18 2.42-3.42 0-6.34-.94-6.34-2.56 0-.94 1.02-1.66 2.62-2.08-.72.4-1.08.86-1.08 1.4Z"
            fill="currentColor"
          />
          <path
            d="M9.1 19.1c.82.34 1.82.5 2.9.5 3.4 0 6.24-1.54 6.24-3.44 0-.26-.06-.5-.18-.74.62.38.98.9.98 1.52 0 2.28-3.12 4.06-7.04 4.06-1.4 0-2.72-.22-3.84-.62l.94-1.28Z"
            fill="currentColor"
          />
        </svg>
      );
    case "ruby":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="m12 2.5 6.4 2.2 1.9 6.1-4.3 8.1H8l-4.3-8.1 1.9-6.1L12 2.5Zm0 2.04L7.4 6.1 6 10.52l2.96 5.6h6.08L18 10.52 16.6 6.1 12 4.54Z"
            fill="currentColor"
          />
          <path
            d="m8.1 6.9 3.9 1.06 3.9-1.06-1.28 4.22L12 16.7l-2.62-5.58L8.1 6.9Z"
            fill="currentColor"
          />
        </svg>
      );
    case "php":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12 4.2c4.92 0 8.9 2.5 8.9 5.58 0 3.08-3.98 5.58-8.9 5.58-4.92 0-8.9-2.5-8.9-5.58 0-3.08 3.98-5.58 8.9-5.58Zm0 1.8c-3.94 0-7.1 1.7-7.1 3.78 0 2.08 3.16 3.78 7.1 3.78 3.94 0 7.1-1.7 7.1-3.78C19.1 7.7 15.94 6 12 6Z"
            fill="currentColor"
          />
          <path
            d="M7.2 8.45h1.64c1.14 0 1.78.52 1.78 1.46 0 1.02-.74 1.6-2 1.6h-.54v1.94H7.2V8.45Zm.9.74v1.58h.54c.72 0 1.12-.3 1.12-.8 0-.52-.34-.78-1.02-.78H8.1Zm3.42-.74h1.46c1.34 0 2.08.88 2.08 2.46 0 1.62-.84 2.54-2.28 2.54h-1.26V8.45Zm.9.76v3.48h.34c.94 0 1.4-.58 1.4-1.76 0-1.16-.44-1.72-1.34-1.72h-.4Zm4.14-.76h2.96v.78h-2.06v1.38h1.82v.76h-1.82v2.08h-.9V8.45Z"
            fill="currentColor"
          />
        </svg>
      );
    case "dotnet":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="m12 2.6 7.6 4.4v10L12 21.4 4.4 17V7L12 2.6Zm0 2.14L6.2 8.02v7.96L12 19.26l5.8-3.28V8.02L12 4.74Z"
            fill="currentColor"
          />
          <path
            d="M8 9h1.42c1.4 0 2.18.9 2.18 2.52 0 1.66-.9 2.6-2.4 2.6H8V9Zm1 4.3h.3c.98 0 1.44-.58 1.44-1.78 0-1.12-.44-1.7-1.34-1.7H9v3.48Zm3.54-4.3h.86l2.22 3.56V9h.92v5.12h-.82l-2.26-3.6v3.6h-.92V9Z"
            fill="currentColor"
          />
        </svg>
      );
    case "rust":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12 3.4 13.6 5l2.24-.38.92 2.08 2.14.82-.3 2.28L20.6 12l-1.94 2.28.3 2.28-2.14.82-.92 2.08-2.24-.38L12 20.6l-1.6-1.52-2.24.38-.92-2.08-2.14-.82.3-2.28L3.4 12l1.94-2.2-.3-2.28 2.14-.82.92-2.08 2.24.38L12 3.4Zm0 3.2a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Zm-1.84 2.18h2.18c1.48 0 2.36.72 2.36 1.94 0 .86-.48 1.48-1.34 1.76l1.56 2.58h-1.32l-1.38-2.34H11.1v2.34h-.94V8.78Zm.94.76v2.36h1.12c.92 0 1.42-.4 1.42-1.18 0-.78-.48-1.18-1.4-1.18H11.1Z"
            fill="currentColor"
          />
        </svg>
      );
    case "github":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12 2.5a9.5 9.5 0 0 0-3 18.52c.48.09.66-.21.66-.46v-1.8c-2.67.58-3.24-1.13-3.24-1.13-.44-1.1-1.06-1.4-1.06-1.4-.87-.59.07-.58.07-.58.96.07 1.47.98 1.47.98.85 1.46 2.23 1.04 2.77.8.09-.61.33-1.04.59-1.28-2.13-.24-4.37-1.07-4.37-4.74 0-1.05.38-1.9.99-2.57-.1-.24-.43-1.2.09-2.5 0 0 .82-.26 2.68.98A9.2 9.2 0 0 1 12 7.1c.81 0 1.63.11 2.4.33 1.87-1.24 2.68-.98 2.68-.98.53 1.3.2 2.26.1 2.5.62.67.99 1.52.99 2.57 0 3.68-2.24 4.5-4.38 4.74.34.3.64.88.64 1.78v2.64c0 .26.18.56.67.46A9.5 9.5 0 0 0 12 2.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "docker":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M4 12.5h3v-3H4v3Zm4 0h3v-3H8v3Zm4 0h3v-3h-3v3Zm4 0h3v-3h-3v3Zm-8-3h3v-3h-3v3Zm4 0h3v-3h-3v3Zm6.2 1.2c-.5 0-1 .15-1.38.43-.46-.74-1.22-1.2-2.11-1.2-.2 0-.39.03-.58.08V13H4c0 2.97 2.32 5.08 5.67 5.08h2.5c4.47 0 7.43-1.76 8.36-5.16.12-.42-.17-.84-.6-.84h-1.73Z"
            fill="currentColor"
          />
        </svg>
      );
    case "buildpacks":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M4 6.5 9.5 3 15 6.5 9.5 10 4 6.5Zm5.5 4.5L15 7.5 20.5 11 15 14.5 9.5 11Zm-5.5 5L9.5 12.5 15 16 9.5 19.5 4 16Zm11 0 5.5-3.5V18L15 21.5V16Z"
            fill="currentColor"
          />
        </svg>
      );
    case "nixpacks":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="m12 2.5 8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4L12 2.5Zm0 3.05L6.5 8.7v6.6l5.5 3.15 5.5-3.15V8.7L12 5.55Zm0 2.2 3.3 1.9v3.8L12 15.35l-3.3-1.9v-3.8L12 7.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "static":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5Zm0 2V17h16V7.5H4Zm2.2 2.1h5.3v1.9H6.2V9.6Zm0 3.3h8.8v1.9H6.2v-1.9Z"
            fill="currentColor"
          />
        </svg>
      );
    case "postgres":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M12 3.5c4.56 0 8 1.56 8 3.63v9.74c0 2.07-3.44 3.63-8 3.63s-8-1.56-8-3.63V7.13C4 5.06 7.44 3.5 12 3.5Zm0 2C8.13 5.5 6 6.72 6 7.13S8.13 8.75 12 8.75s6-1.22 6-1.62S15.87 5.5 12 5.5Zm6 5.14c-1.43.9-3.69 1.44-6 1.44s-4.57-.54-6-1.44v2.23c0 .41 2.13 1.63 6 1.63s6-1.22 6-1.63v-2.23Zm-6 5.44c-2.31 0-4.57-.54-6-1.45v2.24c0 .4 2.13 1.63 6 1.63s6-1.23 6-1.63v-2.24c-1.43.91-3.69 1.45-6 1.45Z"
            fill="currentColor"
          />
        </svg>
      );
    case "runtime":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path
            d="M4 6.5h16A1.5 1.5 0 0 1 21.5 8v8A1.5 1.5 0 0 1 20 17.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Zm0 2v7h16v-7H4Zm2 1.75h6v1.5H6v-1.5Zm0 3h9.5v1.5H6v-1.5Zm10.8-2.88a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"
            fill="currentColor"
          />
        </svg>
      );
  }
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
        <StackGlyph kind={kind} />
      </span>
      <span className="fg-project-badge__sr">{label}</span>
    </div>
  );
}

function ProjectLifecycleBadge({
  project,
}: {
  project: ConsoleGalleryProjectView;
}) {
  const lifecycle = readProjectLifecycle(project);

  return (
    <span
      className="fg-project-lifecycle"
      data-live={lifecycle.live ? "true" : "false"}
      data-tone={lifecycle.tone}
      title={project.latestActivityExact}
    >
      <span aria-hidden="true" className="fg-project-lifecycle__dot" />
      <span>{lifecycle.label}</span>
    </span>
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
  const router = useRouter();
  const { showToast } = useToast();
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [createOpen, setCreateOpen] = useState(defaultCreateOpen);
  const [createTargetProject, setCreateTargetProject] = useState<CreateDialogTarget | null>(null);
  const [projectName, setProjectName] = useState(buildSuggestedProjectName(data.projects.length));
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [appName, setAppName] = useState("");
  const [buildStrategy, setBuildStrategy] = useState<BuildStrategyValue>("auto");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkbenchView>("env");
  const [isCreating, setIsCreating] = useState(false);
  const [busyAction, setBusyAction] = useState<AppAction | null>(null);
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
  const [runtimeComponent, setRuntimeComponent] = useState<RuntimeView>("app");
  const [logsStatus, setLogsStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [logsBody, setLogsBody] = useState("");
  const [logsMeta, setLogsMeta] = useState<LogMetaItem[]>([]);
  const [buildLogsOperationStatus, setBuildLogsOperationStatus] = useState<string | null>(null);
  const [logsRefreshMode, setLogsRefreshMode] = useState<"auto" | "manual">("auto");
  const [logsRefreshToken, setLogsRefreshToken] = useState(0);
  const [logsRefreshing, setLogsRefreshing] = useState(false);
  const [refreshWindowUntil, setRefreshWindowUntil] = useState(0);
  const logsVisibleKeyRef = useRef<string | null>(null);
  const logsRequestPendingRef = useRef(false);

  const selectedProject =
    data.projects.find((project) => project.id === selectedProjectId) ?? null;
  const selectedProjectApps = selectedProject ? projectApps(selectedProject) : [];
  const selectedApp =
    selectedProjectApps.find((app) => app.id === selectedAppId) ??
    (selectedProject ? selectedProjectApps[0] : null) ??
    null;
  const logsRequestKey =
    selectedApp
      ? logsMode === "runtime"
        ? `${selectedApp.id}:${logsMode}:${runtimeComponent}`
        : `${selectedApp.id}:${logsMode}`
      : null;
  const logsRequestInput =
    selectedApp
      ? logsMode === "build"
        ? `/api/fugue/apps/${selectedApp.id}/build-logs?tail_lines=${LOG_TAIL_LINES}`
        : `/api/fugue/apps/${selectedApp.id}/runtime-logs?component=${runtimeComponent}&tail_lines=${LOG_TAIL_LINES}`
      : null;
  const runtimeLogsUnavailable = readRuntimeLogsUnavailableState(selectedApp, logsMode);
  const runtimeLogsUnavailableKey = runtimeLogsUnavailable
    ? `${selectedApp?.id ?? "none"}:${runtimeLogsUnavailable.refreshLabel}`
    : null;
  const logsAutoRefreshEnabled =
    runtimeLogsUnavailable === null &&
    (logsMode === "runtime" || shouldAutoRefreshBuildLogs(buildLogsOperationStatus));
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
  const createDialogCopy = isCreateServiceMode
    ? `Import a public GitHub repository into ${createTargetProject.name}. Fugue keeps tracking the selected branch after the first deploy.`
    : "The project is only surfaced after a real import succeeds. Public GitHub imports keep tracking their branch for future syncs.";
  const createDialogSubmitLabel = isCreating
    ? isCreateServiceMode
      ? "Adding…"
      : "Creating…"
    : isCreateServiceMode
      ? "Add service"
      : "Create project";
  const logsDisplayBody = readLogsDisplayBody(logsStatus, logsBody);
  const logsRefreshStateLabel = runtimeLogsUnavailable
    ? runtimeLogsUnavailable.refreshLabel
    : logsRefreshing
      ? "Refresh / Updating"
      : logsAutoRefreshEnabled
        ? `Refresh / Auto ${LOG_AUTO_REFRESH_INTERVAL_MS / 1000}s`
        : "Refresh / Stopped";

  useEffect(() => {
    if (defaultCreateOpen) {
      setCreateOpen(true);
    }
  }, [defaultCreateOpen]);

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
    if (!createOpen && !isCreating) {
      setProjectName(buildSuggestedProjectName(data.projects.length));
    }
  }, [createOpen, data.projects.length, isCreating]);

  useEffect(() => {
    if (!selectedProjectId) {
      if (selectedAppId) {
        setSelectedAppId(null);
      }
      return;
    }

    if (!selectedProject) {
      setSelectedProjectId(null);
      setSelectedAppId(null);
      return;
    }

    if (!selectedApp) {
      setSelectedAppId(selectedProjectApps[0]?.id ?? null);
    }
  }, [selectedApp, selectedAppId, selectedProject, selectedProjectApps, selectedProjectId]);

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
    if (!selectedApp) {
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

    if (activeTab !== "env" || envLoadedAppId === selectedApp.id) {
      return;
    }

    let cancelled = false;
    setEnvStatus("loading");

    requestJson<EnvResponse>(`/api/fugue/apps/${selectedApp.id}/env`)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const nextEnv = response.env ?? {};
        const nextRows = rowsFromEnv(nextEnv);
        setEnvBaseline(nextEnv);
        setEnvRows(nextRows);
        setEnvLoadedAppId(selectedApp.id);
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
  }, [activeTab, envLoadedAppId, selectedApp]);

  useEffect(() => {
    if (selectedApp) {
      return;
    }

    logsVisibleKeyRef.current = null;
    logsRequestPendingRef.current = false;
    setLogsStatus("idle");
    setLogsBody("");
    setLogsMeta([]);
    setBuildLogsOperationStatus(null);
    setLogsRefreshing(false);
  }, [selectedApp?.id]);

  useEffect(() => {
    if (!selectedApp || activeTab !== "logs" || !logsRequestInput || !logsRequestKey) {
      return;
    }

    if (runtimeLogsUnavailable) {
      logsVisibleKeyRef.current = null;
      logsRequestPendingRef.current = false;
      setLogsStatus("idle");
      setLogsBody("");
      setLogsMeta([]);
      setLogsRefreshing(false);
      return;
    }

    const controller = new AbortController();
    const backgroundRefresh = logsVisibleKeyRef.current === logsRequestKey;
    let cancelled = false;
    logsRequestPendingRef.current = true;

    if (backgroundRefresh) {
      setLogsRefreshing(true);
    } else {
      setLogsStatus("loading");
      setLogsBody("");
      setLogsMeta([]);
      setLogsRefreshing(false);
    }

    requestJson<BuildLogsResponse | RuntimeLogsResponse>(logsRequestInput, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (logsMode === "build") {
          const buildLogs = response as BuildLogsResponse;
          setLogsBody(buildLogs.logs || "No build logs available.");
          setLogsMeta(buildLogMeta(buildLogs));
          setBuildLogsOperationStatus(buildLogs.operationStatus ?? null);
        } else {
          const runtimeLogs = response as RuntimeLogsResponse;
          setLogsBody(runtimeLogs.logs || "No runtime logs available.");
          setLogsMeta(runtimeLogMeta(runtimeLogs));
        }

        logsVisibleKeyRef.current = logsRequestKey;
        logsRequestPendingRef.current = false;
        setLogsStatus("ready");
        setLogsRefreshing(false);
      })
      .catch((error) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }

        logsRequestPendingRef.current = false;
        setLogsRefreshing(false);

        if (backgroundRefresh) {
          if (logsRefreshMode === "manual") {
            setFlash({
              message: readErrorMessage(error),
              variant: "error",
            });
          }
          return;
        }

        setLogsStatus("error");
        setFlash({
          message: readErrorMessage(error),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
      logsRequestPendingRef.current = false;
      controller.abort();
    };
  }, [
    activeTab,
    logsMode,
    logsRefreshMode,
    logsRefreshToken,
    logsRequestInput,
    logsRequestKey,
    runtimeLogsUnavailableKey,
  ]);

  useEffect(() => {
    if (!selectedApp?.hasPostgresService && runtimeComponent === "postgres") {
      setRuntimeComponent("app");
    }
  }, [runtimeComponent, selectedApp]);

  useEffect(() => {
    if (!selectedApp || activeTab !== "logs" || !logsAutoRefreshEnabled) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible" || logsRequestPendingRef.current) {
        return;
      }

      setLogsRefreshMode("auto");
      setLogsRefreshToken((value) => value + 1);
    }, LOG_AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeTab, logsAutoRefreshEnabled, logsRequestKey]);

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
    setRepoUrl("");
    setBranch("");
    setAppName("");
    setBuildStrategy("auto");
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
    startTransition(() => {
      router.replace("/app");
    });
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreating) {
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
    setIsCreating(true);

    try {
      const response = await requestJson<CreateProjectResponse>(
        "/api/fugue/projects/create-and-import",
        {
          body: JSON.stringify({
            branch,
            buildStrategy,
            name: appName,
            ...(createTargetProject
              ? {
                  projectId: createTargetProject.id,
                }
              : {
                  projectName,
                }),
            repoUrl,
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
      setIsCreating(false);
    }
  }

  function chooseProject(project: ConsoleGalleryProjectView) {
    if (selectedProjectId === project.id) {
      setSelectedProjectId(null);
      setSelectedAppId(null);
      return;
    }

    setSelectedProjectId(project.id);
    setSelectedAppId(projectApps(project)[0]?.id ?? null);
    setActiveTab("env");
  }

  function chooseApp(appId: string) {
    setSelectedAppId(appId);
    setActiveTab("env");
  }

  async function handleAppAction(action: AppAction) {
    if (!selectedApp || busyAction) {
      return;
    }

    if (action === "redeploy" && !selectedApp.canRedeploy) {
      setFlash({
        message: selectedApp.redeployDisabledReason ?? "Redeploy is not available for this app.",
        variant: "error",
      });
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm(`Delete ${selectedApp.name}?`);

      if (!confirmed) {
        return;
      }
    }

    setBusyAction(action);
    setFlash(null);

    try {
      let input = `/api/fugue/apps/${selectedApp.id}`;
      let method = "POST";
      let successMessage = "Request queued.";
      let refreshWindowMs = 45_000;

      switch (action) {
        case "redeploy":
          input = `/api/fugue/apps/${selectedApp.id}/rebuild`;
          successMessage = selectedApp.redeployQueuedMessage;
          refreshWindowMs = 90_000;
          break;
        case "restart":
          input = `/api/fugue/apps/${selectedApp.id}/restart`;
          successMessage = "Restart queued.";
          break;
        case "disable":
          input = `/api/fugue/apps/${selectedApp.id}/disable`;
          successMessage = "Pause queued.";
          break;
        case "delete":
          method = "DELETE";
          successMessage = "Delete queued.";
          break;
      }

      await requestJson(input, { method });
      armRefreshWindow(refreshWindowMs);
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
    if (!selectedApp || envSaving) {
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
    const duplicateKeys = new Set<string>();
    const seenKeys = new Set<string>();

    for (const row of activeRows) {
      const key = row.existing ? row.originalKey : row.key.trim();

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
    const deletePayload: string[] = [];

    for (const row of envRows) {
      if (row.existing) {
        if (row.removed) {
          deletePayload.push(row.originalKey);
          continue;
        }

        if (row.value !== row.originalValue) {
          setPayload[row.originalKey] = row.value;
        }
        continue;
      }

      const key = row.key.trim();

      if (key) {
        setPayload[key] = row.value;
      }
    }

    if (!Object.keys(setPayload).length && !deletePayload.length) {
      setFlash({
        message: "No environment changes.",
        variant: "info",
      });
      return;
    }

    setEnvSaving(true);

    try {
      const response = await requestJson<EnvResponse>(`/api/fugue/apps/${selectedApp.id}/env`, {
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
      setEnvLoadedAppId(selectedApp.id);
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
    if (logsRequestPendingRef.current) {
      return;
    }

    setLogsRefreshMode("manual");
    setLogsRefreshToken((value) => value + 1);
  }

  function renderProjectWorkbench(
    project: ConsoleGalleryProjectView,
    detailId: string,
  ) {
    if (selectedProject?.id !== project.id || !selectedApp) {
      return null;
    }

    const serviceCountLabel = `${project.services.length} service${project.services.length === 1 ? "" : "s"}`;

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
                <p className="fg-project-services__count">{serviceCountLabel}</p>
              </PanelSection>

              <PanelSection>
                <ul className="fg-project-service-list">
                  {project.services.map((service) => (
                    <li key={`${service.kind}:${service.id}`}>
                      {service.kind === "app" ? (
                        <div
                          className={cx(
                            "fg-project-service-card",
                            selectedApp.id === service.id && "is-active",
                          )}
                        >
                          <button
                            aria-label={`Inspect ${service.name}`}
                            aria-pressed={selectedApp.id === service.id}
                            className="fg-project-service-card__select"
                            onClick={() => chooseApp(service.id)}
                            type="button"
                          />
                          <div className="fg-project-service-card__content">
                            <div className="fg-project-service-card__head">
                              <strong>{service.name}</strong>
                              <StatusBadge tone={service.phaseTone}>{service.phase}</StatusBadge>
                            </div>
                            <div className="fg-project-service-card__badges">
                              {service.serviceBadges.map((badge) => (
                                <ProjectBadge
                                  key={`${service.id}:${badge.id}`}
                                  kind={badge.kind}
                                  label={badge.label}
                                  meta={badge.meta}
                                />
                              ))}
                            </div>
                            <div className="fg-project-service-card__meta">
                              {renderExternalText(
                                service.sourceLabel,
                                service.sourceHref,
                                service.sourceHref ? "fg-project-service-card__source-link" : undefined,
                              )}
                              {readTrackingLabel(service) ? <span>{readTrackingLabel(service)}</span> : null}
                              <span>{service.routeLabel}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="fg-project-service-card is-static">
                          <div className="fg-project-service-card__head">
                            <strong>{service.name}</strong>
                            <StatusBadge tone={service.statusTone}>{service.status}</StatusBadge>
                          </div>
                          <div className="fg-project-service-card__badges">
                            <ProjectBadge
                              kind="postgres"
                              label={service.type}
                              meta="Service"
                            />
                          </div>
                          <div className="fg-project-service-card__meta">
                            <span>{service.type}</span>
                            <span>{service.ownerAppLabel}</span>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            </aside>

            <div className="fg-project-inspector fg-project-workbench__main">
              <PanelSection className="fg-project-inspector__head">
                <div className="fg-project-inspector__header-row">
                  <div className="fg-project-inspector__hero">
                    <PanelTitle>{selectedApp.name}</PanelTitle>
                    <PanelCopy className="fg-project-inspector__copy">
                      {selectedApp.lastMessage}
                    </PanelCopy>
                  </div>

                  <div className="fg-console-inline-status">
                    <StatusBadge tone={selectedApp.phaseTone}>{selectedApp.phase}</StatusBadge>
                    <StatusBadge tone="neutral">{selectedApp.updatedLabel}</StatusBadge>
                  </div>
                </div>

                {selectedApp.serviceBadges.length ? (
                  <div className="fg-project-inspector__stack" aria-label="Selected app stack">
                    {selectedApp.serviceBadges.map((badge) => (
                      <ProjectBadge
                        key={`${selectedApp.id}:${badge.id}`}
                        kind={badge.kind}
                        label={badge.label}
                        meta={badge.meta}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="fg-project-inspector__meta-grid">
                  <div>
                    <dt>Source</dt>
                    <dd>{renderExternalText(selectedApp.sourceLabel, selectedApp.sourceHref)}</dd>
                  </div>
                  <div>
                    <dt>Branch</dt>
                    <dd>{renderOptionalExternalText(selectedApp.sourceBranchLabel, selectedApp.sourceBranchHref)}</dd>
                  </div>
                  <div>
                    <dt>Commit</dt>
                    <dd>
                      <span className="fg-project-inspector__meta-stack">
                        {renderCommitText(selectedApp)}
                        <LocalDateTimeNote
                          className="fg-project-inspector__meta-note"
                          prefix="Committed"
                          value={selectedApp.currentCommitCommittedAt}
                        />
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Build</dt>
                    <dd>{selectedApp.sourceMeta}</dd>
                  </div>
                  <div>
                    <dt>Route</dt>
                    <dd>
                      {selectedApp.routeHref ? (
                        <a
                          className="fg-text-link"
                          href={selectedApp.routeHref}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {selectedApp.routeLabel}
                        </a>
                      ) : (
                        selectedApp.routeLabel
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedApp.phase}</dd>
                  </div>
                </div>

                <div className="fg-project-inspector__sync">
                  <div className="fg-project-inspector__sync-head">
                    <p className="fg-label fg-panel__eyebrow">Update policy</p>
                    <StatusBadge tone={selectedApp.syncStatusTone}>{selectedApp.syncStatusLabel}</StatusBadge>
                  </div>
                  <p className="fg-console-note">{selectedApp.syncSummary}</p>
                  <p className="fg-console-note">{selectedApp.deployBehavior}</p>
                </div>
              </PanelSection>

              <PanelSection className="fg-project-inspector__controls">
                <div className="fg-project-toolbar">
                  <div className="fg-project-toolbar__group">
                    <p className="fg-label fg-project-toolbar__label">Actions</p>
                    <div className="fg-project-actions">
                      <Button
                        disabled={!selectedApp.canRedeploy || Boolean(busyAction && busyAction !== "redeploy")}
                        loading={busyAction === "redeploy"}
                        loadingLabel={selectedApp.redeployActionLoadingLabel}
                        onClick={() => handleAppAction("redeploy")}
                        size="compact"
                        title={
                          selectedApp.canRedeploy
                            ? selectedApp.redeployActionDescription
                            : selectedApp.redeployDisabledReason ?? undefined
                        }
                        type="button"
                        variant="primary"
                      >
                        {selectedApp.redeployActionLabel}
                      </Button>
                      <Button
                        disabled={Boolean(busyAction && busyAction !== "restart")}
                        loading={busyAction === "restart"}
                        loadingLabel="Restarting…"
                        onClick={() => handleAppAction("restart")}
                        size="compact"
                        title="Restart the current release without rebuilding the image. Persistent workspace is preserved when configured."
                        type="button"
                        variant="secondary"
                      >
                        Restart
                      </Button>
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

                  <div className="fg-project-toolbar__group fg-project-toolbar__group--tabs">
                    <p className="fg-label fg-project-toolbar__label">Workbench</p>
                    <SegmentedControl
                      ariaLabel="Workbench views"
                      onChange={setActiveTab}
                      options={WORKBENCH_VIEW_OPTIONS}
                      value={activeTab}
                    />
                  </div>
                </div>
              </PanelSection>

              <PanelSection className="fg-project-pane">
                {activeTab === "env" ? (
                  <div className="fg-workbench-section">
                    <div className="fg-workbench-section__head">
                      <div className="fg-workbench-section__copy">
                        <p className="fg-label fg-panel__eyebrow">Environment</p>
                        <p className="fg-console-note">
                          {envFormat === "raw"
                            ? `Paste a .env block for ${selectedApp.name}. Comments, blank lines, and export prefixes are ignored.`
                            : `Configure runtime variables for ${selectedApp.name}, or switch to Raw to paste a full .env block.`}
                        </p>
                      </div>

                      <div className="fg-workbench-section__actions">
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
                                  aria-label={`${row.existing ? row.originalKey : "New variable"} Key`}
                                  autoCapitalize="off"
                                  autoCorrect="off"
                                  className="fg-input"
                                  disabled={row.existing}
                                  onChange={(event) => updateEnvRow(row.id, "key", event.target.value)}
                                  placeholder="Name"
                                  spellCheck={false}
                                  value={row.existing ? row.originalKey : row.key}
                                />
                                <input
                                  aria-label={`${row.existing ? row.originalKey : "New variable"} Value`}
                                  autoCapitalize="off"
                                  autoCorrect="off"
                                  className="fg-input"
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
                          htmlFor={`env-raw-${selectedApp.id}`}
                          label="Raw environment"
                          optionalLabel="Paste .env"
                        >
                          <textarea
                            aria-invalid={envRawFeedback.valid ? undefined : true}
                            autoCapitalize="off"
                            autoCorrect="off"
                            className="fg-project-textarea fg-env-raw__textarea"
                            id={`env-raw-${selectedApp.id}`}
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

                {activeTab === "files" ? (
                  <ConsoleFilesWorkbench
                    appId={selectedApp.id}
                    appName={selectedApp.name}
                    key={selectedApp.id}
                    workspaceMountPath={selectedApp.workspaceMountPath}
                  />
                ) : null}

                {activeTab === "logs" ? (
                  <div className="fg-workbench-section">
                    <div className="fg-workbench-section__head">
                      <div className="fg-workbench-section__copy">
                        <p className="fg-label fg-panel__eyebrow">Logs</p>
                        <p className="fg-console-note">
                          {runtimeLogsUnavailable
                            ? runtimeLogsUnavailable.description
                            : `Stream build and runtime output for ${selectedApp.name}. ${
                                logsMode === "build" ? `${selectedApp.deployBehavior} ` : ""
                              }${
                                logsAutoRefreshEnabled
                                  ? `Auto-refresh every ${LOG_AUTO_REFRESH_INTERVAL_MS / 1000} seconds while this panel is open.`
                                  : "Build is in a terminal state, so auto-refresh is paused."
                              }${logsRefreshing ? " Updating…" : ""}`}
                        </p>
                      </div>

                      <div className="fg-workbench-section__actions">
                        <SegmentedControl
                          ariaLabel="Log views"
                          onChange={(nextMode) => {
                            setLogsMode(nextMode);
                          }}
                          options={LOG_VIEW_OPTIONS}
                          value={logsMode}
                        />

                        {logsMode === "runtime" && selectedApp.hasPostgresService ? (
                          <SegmentedControl
                            ariaLabel="Runtime components"
                            onChange={(nextComponent) => {
                              setRuntimeComponent(nextComponent);
                            }}
                            options={RUNTIME_VIEW_OPTIONS}
                            value={runtimeComponent}
                          />
                        ) : null}

                        <Button onClick={refreshLogs} size="compact" type="button" variant="secondary">
                          Refresh now
                        </Button>
                      </div>
                    </div>

                    <div className="fg-bezel fg-proof-shell">
                      <div className="fg-bezel__inner">
                        <div className="fg-proof-shell__ribbon">
                          {runtimeLogsUnavailable ? (
                            <span>{runtimeLogsUnavailable.metaLabel}</span>
                          ) : logsMeta.length ? (
                            logsMeta.map((item) => renderLogMetaItem(item))
                          ) : (
                            <span>Waiting</span>
                          )}
                          <span>{logsRefreshStateLabel}</span>
                        </div>
                        {runtimeLogsUnavailable ? (
                          <div className="fg-proof-shell__empty">
                            <strong>{runtimeLogsUnavailable.title}</strong>
                            <p>{runtimeLogsUnavailable.description}</p>
                          </div>
                        ) : (
                          <pre>
                            <code className="fg-log-output">{renderAnsiLogBody(logsDisplayBody)}</code>
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
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

                        <div className="fg-project-card__summary-side">
                          <ProjectLifecycleBadge project={project} />
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
        <div className="fg-console-dialog-backdrop" onClick={closeCreate}>
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
                  Import repository
                </PanelTitle>
                <PanelCopy>{createDialogCopy}</PanelCopy>
              </PanelSection>

              <PanelSection>
                <form className="fg-form-grid" onSubmit={handleCreateProject}>
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
                        hint="Used for the project shell in this workspace."
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

                    <FormField
                      hint="Only public GitHub repositories are supported right now. Fugue keeps tracking the selected branch after the first deploy."
                      htmlFor="create-repo-url"
                      label="Repository link"
                    >
                      <input
                        autoComplete="url"
                        autoCapitalize="none"
                        className="fg-input"
                        id="create-repo-url"
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

                    <details className="fg-console-disclosure fg-console-dialog__advanced">
                      <summary>Advanced</summary>
                      <div className="fg-console-dialog__advanced-grid">
                        <FormField
                          hint="Leave blank to use the repository default branch. Fugue will keep tracking that branch for future syncs."
                          htmlFor="create-repo-branch"
                          label="Branch"
                          optionalLabel="Optional"
                        >
                          <input
                            autoCapitalize="none"
                            autoComplete="off"
                            className="fg-input"
                            id="create-repo-branch"
                            name="branch"
                            onChange={(event) => setBranch(event.target.value)}
                            placeholder="main"
                            spellCheck={false}
                            value={branch}
                          />
                        </FormField>

                        <FormField
                          hint="Leave blank to reuse the repository name."
                          htmlFor="create-app-name"
                          label="App name"
                          optionalLabel="Optional"
                        >
                          <input
                            autoComplete="off"
                            className="fg-input"
                            id="create-app-name"
                            name="name"
                            onChange={(event) => setAppName(event.target.value)}
                            placeholder="Leave blank to reuse repo name"
                            value={appName}
                          />
                        </FormField>

                        <FormField
                          hint="Fugue reuses this build strategy for manual syncs and automatic GitHub updates."
                          htmlFor="create-build-strategy"
                          label="Build strategy"
                        >
                          <select
                            autoComplete="off"
                            className="fg-input"
                            id="create-build-strategy"
                            name="buildStrategy"
                            onChange={(event) => setBuildStrategy(event.target.value as BuildStrategyValue)}
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
                    <Button onClick={closeCreate} type="button" variant="secondary">
                      Cancel
                    </Button>
                    <Button loading={isCreating} loadingLabel={createDialogSubmitLabel} type="submit" variant="primary">
                      {createDialogSubmitLabel}
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
