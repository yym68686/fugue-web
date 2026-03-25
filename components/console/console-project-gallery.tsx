"use client";

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/console/status-badge";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import type {
  ConsoleGalleryAppView,
  ConsoleGalleryBadgeKind,
  ConsoleGalleryProjectView,
  ConsoleProjectGalleryData,
} from "@/lib/console/gallery-types";
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

type EnvResponse = {
  env?: Record<string, string>;
};

type FileRecord = {
  content?: string | null;
  mode?: number | null;
  path?: string;
  secret?: boolean;
};

type FilesResponse = {
  files?: FileRecord[];
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

type EnvRow = {
  existing: boolean;
  id: string;
  key: string;
  originalKey: string;
  originalValue: string;
  removed: boolean;
  value: string;
};

type FileDraft = {
  content: string;
  existing: boolean;
  id: string;
  mode: string;
  path: string;
  redacted: boolean;
  secret: boolean;
};

type BuildStrategyValue =
  | "auto"
  | "buildpacks"
  | "dockerfile"
  | "nixpacks"
  | "static-site";

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

function createClientId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

function filesFromResponse(files: FileRecord[]) {
  return [...files]
    .filter((file): file is FileRecord & { path: string } => typeof file.path === "string" && file.path.trim().length > 0)
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => ({
      content: typeof file.content === "string" ? file.content : "",
      existing: true,
      id: createClientId("file"),
      mode: typeof file.mode === "number" ? String(file.mode) : "",
      path: file.path,
      redacted: Boolean(file.secret) && !(typeof file.content === "string" && file.content.length > 0),
      secret: Boolean(file.secret),
    }) satisfies FileDraft);
}

function buildLogMeta(buildLogs: BuildLogsResponse) {
  return [
    buildLogs.buildStrategy ? `build / ${buildLogs.buildStrategy}` : null,
    buildLogs.source ? `source / ${buildLogs.source}` : null,
    buildLogs.jobName ? `job / ${buildLogs.jobName}` : null,
    buildLogs.operationStatus ? `status / ${buildLogs.operationStatus}` : null,
    buildLogs.errorMessage ? `error / ${buildLogs.errorMessage}` : null,
    buildLogs.resultMessage ? `result / ${buildLogs.resultMessage}` : null,
  ].filter((item): item is string => Boolean(item));
}

function runtimeLogMeta(runtimeLogs: RuntimeLogsResponse) {
  return [
    runtimeLogs.component ? `component / ${runtimeLogs.component}` : null,
    runtimeLogs.pods?.length ? `pods / ${runtimeLogs.pods.join(", ")}` : null,
    runtimeLogs.warnings?.length ? `warnings / ${runtimeLogs.warnings.join(" | ")}` : null,
  ].filter((item): item is string => Boolean(item));
}

function StackGlyph({ kind }: { kind: ConsoleGalleryBadgeKind }) {
  switch (kind) {
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
    <div className="fg-project-badge" title={`${label} / ${meta}`}>
      <span className="fg-project-badge__glyph">
        <StackGlyph kind={kind} />
      </span>
      <span className="fg-project-badge__label">{label}</span>
      <span className="fg-project-badge__meta">{meta}</span>
    </div>
  );
}

function projectTitle(project: ConsoleGalleryProjectView) {
  return `${project.name} / ${project.serviceCount} service${project.serviceCount === 1 ? "" : "s"}`;
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
  const firstProject = data.projects[0] ?? null;
  const firstProjectAppId = firstProject ? projectApps(firstProject)[0]?.id ?? null : null;
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [createOpen, setCreateOpen] = useState(defaultCreateOpen);
  const [projectName, setProjectName] = useState(data.projects.length ? `project-${data.projects.length + 1}` : "default");
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [appName, setAppName] = useState("");
  const [buildStrategy, setBuildStrategy] = useState<BuildStrategyValue>("auto");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(firstProject?.id ?? null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(firstProjectAppId);
  const [activeTab, setActiveTab] = useState<"env" | "files" | "logs">("env");
  const [isCreating, setIsCreating] = useState(false);
  const [busyAction, setBusyAction] = useState<"delete" | "disable" | "restart" | null>(null);
  const [envStatus, setEnvStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);
  const [envLoadedAppId, setEnvLoadedAppId] = useState<string | null>(null);
  const [envSaving, setEnvSaving] = useState(false);
  const [filesStatus, setFilesStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [fileDrafts, setFileDrafts] = useState<FileDraft[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [filesLoadedAppId, setFilesLoadedAppId] = useState<string | null>(null);
  const [filesSaving, setFilesSaving] = useState(false);
  const [logsMode, setLogsMode] = useState<"build" | "runtime">("build");
  const [runtimeComponent, setRuntimeComponent] = useState<"app" | "postgres">("app");
  const [logsStatus, setLogsStatus] = useState<"error" | "idle" | "loading" | "ready">("idle");
  const [logsBody, setLogsBody] = useState("");
  const [logsMeta, setLogsMeta] = useState<string[]>([]);
  const [logsLoadedKey, setLogsLoadedKey] = useState<string | null>(null);

  const selectedProject =
    data.projects.find((project) => project.id === selectedProjectId) ?? data.projects[0] ?? null;
  const selectedProjectApps = selectedProject ? projectApps(selectedProject) : [];
  const selectedApp =
    selectedProjectApps.find((app) => app.id === selectedAppId) ??
    selectedProjectApps[0] ??
    null;
  const selectedFile =
    fileDrafts.find((file) => file.id === selectedFileId) ?? fileDrafts[0] ?? null;
  const pageFlash = createOpen ? null : flash;
  const modalFlash = createOpen ? flash : null;

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
    if (!createOpen && !isCreating) {
      setProjectName(data.projects.length ? `project-${data.projects.length + 1}` : "default");
    }
  }, [createOpen, data.projects.length, isCreating]);

  useEffect(() => {
    if (!selectedProject) {
      setSelectedProjectId(firstProject?.id ?? null);
      setSelectedAppId(firstProjectAppId);
      return;
    }

    if (!selectedApp) {
      setSelectedAppId(selectedProjectApps[0]?.id ?? null);
    }
  }, [firstProject, firstProjectAppId, selectedApp, selectedProject, selectedProjectApps]);

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
      setEnvRows([]);
      setEnvLoadedAppId(null);
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

        setEnvRows(rowsFromEnv(response.env ?? {}));
        setEnvLoadedAppId(selectedApp.id);
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
    if (!selectedApp) {
      setFilesStatus("idle");
      setFileDrafts([]);
      setSelectedFileId(null);
      setFilesLoadedAppId(null);
      return;
    }

    if (activeTab !== "files" || filesLoadedAppId === selectedApp.id) {
      return;
    }

    let cancelled = false;
    setFilesStatus("loading");

    requestJson<FilesResponse>(`/api/fugue/apps/${selectedApp.id}/files`)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const nextDrafts = filesFromResponse(response.files ?? []);
        setFileDrafts(nextDrafts);
        setSelectedFileId(nextDrafts[0]?.id ?? null);
        setFilesLoadedAppId(selectedApp.id);
        setFilesStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setFilesStatus("error");
        setFlash({
          message: readErrorMessage(error),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, filesLoadedAppId, selectedApp]);

  useEffect(() => {
    if (!selectedApp || activeTab !== "logs") {
      return;
    }

    const nextKey =
      logsMode === "runtime"
        ? `${selectedApp.id}:${logsMode}:${runtimeComponent}`
        : `${selectedApp.id}:${logsMode}`;

    if (logsLoadedKey === nextKey) {
      return;
    }

    let cancelled = false;
    setLogsStatus("loading");

    const input =
      logsMode === "build"
        ? `/api/fugue/apps/${selectedApp.id}/build-logs?tail_lines=200`
        : `/api/fugue/apps/${selectedApp.id}/runtime-logs?component=${runtimeComponent}&tail_lines=200`;

    requestJson<BuildLogsResponse | RuntimeLogsResponse>(input)
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (logsMode === "build") {
          const buildLogs = response as BuildLogsResponse;
          setLogsBody(buildLogs.logs || "No build logs available.");
          setLogsMeta(buildLogMeta(buildLogs));
        } else {
          const runtimeLogs = response as RuntimeLogsResponse;
          setLogsBody(runtimeLogs.logs || "No runtime logs available.");
          setLogsMeta(runtimeLogMeta(runtimeLogs));
        }

        setLogsLoadedKey(nextKey);
        setLogsStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
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
    };
  }, [activeTab, logsLoadedKey, logsMode, runtimeComponent, selectedApp]);

  useEffect(() => {
    if (!selectedApp?.hasPostgresService && runtimeComponent === "postgres") {
      setRuntimeComponent("app");
      setLogsLoadedKey(null);
    }
  }, [runtimeComponent, selectedApp]);

  function resetCreateForm(nextProjectName: string) {
    setProjectName(nextProjectName);
    setRepoUrl("");
    setBranch("");
    setAppName("");
    setBuildStrategy("auto");
  }

  function openCreate() {
    setFlash(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    if (isCreating) {
      return;
    }

    setFlash(null);
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
        message: "Repository URL is required.",
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
            projectName,
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
      setFlash({
        message: response.requestInProgress ? "Import is already running." : "Project import queued.",
        variant: "success",
      });
      resetCreateForm(`project-${Math.max(data.projects.length + 2, 2)}`);
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
    setSelectedProjectId(project.id);
    setSelectedAppId(projectApps(project)[0]?.id ?? null);
    setActiveTab("env");
  }

  function chooseApp(appId: string) {
    setSelectedAppId(appId);
    setActiveTab("env");
  }

  async function handleAppAction(action: "delete" | "disable" | "restart") {
    if (!selectedApp || busyAction) {
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
      const input =
        action === "restart"
          ? `/api/fugue/apps/${selectedApp.id}/restart`
          : action === "disable"
            ? `/api/fugue/apps/${selectedApp.id}/disable`
            : `/api/fugue/apps/${selectedApp.id}`;
      const method = action === "delete" ? "DELETE" : "POST";
      await requestJson(input, { method });
      setFlash({
        message:
          action === "restart"
            ? "Restart queued."
            : action === "disable"
              ? "Pause queued."
              : "Delete queued.",
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

  async function saveEnv() {
    if (!selectedApp || envSaving) {
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

      setEnvRows(rowsFromEnv(response.env ?? {}));
      setEnvLoadedAppId(selectedApp.id);
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

  function addFileDraft() {
    const nextDraft = {
      content: "",
      existing: false,
      id: createClientId("file"),
      mode: "",
      path: "",
      redacted: false,
      secret: false,
    } satisfies FileDraft;

    setFileDrafts((current) => [...current, nextDraft]);
    setSelectedFileId(nextDraft.id);
  }

  function updateFileDraft(fileId: string, patch: Partial<FileDraft>) {
    setFileDrafts((current) =>
      current.map((file) => (file.id === fileId ? { ...file, ...patch } : file)),
    );
  }

  async function saveFile() {
    if (!selectedApp || !selectedFile || filesSaving) {
      return;
    }

    if (!selectedFile.path.trim()) {
      setFlash({
        message: "File path is required.",
        variant: "error",
      });
      return;
    }

    if (selectedFile.redacted && !selectedFile.content.trim()) {
      setFlash({
        message: "Secret file contents are redacted. Enter replacement content before saving.",
        variant: "error",
      });
      return;
    }

    const parsedMode = selectedFile.mode.trim()
      ? Number(selectedFile.mode.trim())
      : null;

    if (parsedMode !== null && !Number.isFinite(parsedMode)) {
      setFlash({
        message: "File mode must be a number.",
        variant: "error",
      });
      return;
    }

    setFilesSaving(true);

    try {
      const response = await requestJson<FilesResponse>(`/api/fugue/apps/${selectedApp.id}/files`, {
        body: JSON.stringify({
          files: [
            {
              content: selectedFile.content,
              ...(parsedMode !== null ? { mode: parsedMode } : {}),
              path: selectedFile.path.trim(),
              secret: selectedFile.secret,
            },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
      });

      const nextDrafts = filesFromResponse(response.files ?? []);
      setFileDrafts(nextDrafts);
      setSelectedFileId(
        nextDrafts.find((file) => file.path === selectedFile.path.trim())?.id ??
          nextDrafts[0]?.id ??
          null,
      );
      setFilesLoadedAppId(selectedApp.id);
      setFlash({
        message: "File changes queued.",
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
      setFilesSaving(false);
    }
  }

  async function deleteFile() {
    if (!selectedApp || !selectedFile || filesSaving) {
      return;
    }

    if (!selectedFile.existing) {
      setFileDrafts((current) => current.filter((file) => file.id !== selectedFile.id));
      setSelectedFileId((current) => (current === selectedFile.id ? null : current));
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedFile.path}?`);

    if (!confirmed) {
      return;
    }

    setFilesSaving(true);

    try {
      const response = await requestJson<FilesResponse>(
        `/api/fugue/apps/${selectedApp.id}/files?path=${encodeURIComponent(selectedFile.path)}`,
        {
          method: "DELETE",
        },
      );
      const nextDrafts = filesFromResponse(response.files ?? []);
      setFileDrafts(nextDrafts);
      setSelectedFileId(nextDrafts[0]?.id ?? null);
      setFilesLoadedAppId(selectedApp.id);
      setFlash({
        message: "File delete queued.",
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
      setFilesSaving(false);
    }
  }

  function refreshLogs() {
    setLogsLoadedKey(null);
  }

  const shellTone = data.errors.length >= 3 ? "error" : "info";

  return (
    <>
      <div className="fg-project-gallery">
        {pageFlash ? (
          <InlineAlert variant={pageFlash.variant}>{pageFlash.message}</InlineAlert>
        ) : null}

        {data.errors.length ? (
          <InlineAlert variant={shellTone}>
            Partial Fugue data: {data.errors.join(" | ")}.
          </InlineAlert>
        ) : null}

        <section
          className={cx(
            "fg-project-gallery__shelf",
            !data.projects.length && "fg-project-gallery__shelf--empty",
          )}
        >
          {data.projects.length ? (
            <div className="fg-project-gallery__grid">
              {data.projects.map((project) => (
                <button
                  className={cx(
                    "fg-project-card",
                    selectedProject?.id === project.id && "is-active",
                  )}
                  key={project.id}
                  onClick={() => chooseProject(project)}
                  type="button"
                >
                  <div className="fg-project-card__head">
                    <div>
                      <strong>{project.name}</strong>
                      <span>{projectTitle(project)}</span>
                    </div>
                    <StatusBadge tone="neutral">{project.latestActivityLabel}</StatusBadge>
                  </div>

                  <div className="fg-project-card__badges">
                    {project.serviceBadges.map((badge) => (
                      <ProjectBadge
                        key={badge.id}
                        kind={badge.kind}
                        label={badge.label}
                        meta={badge.meta}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="fg-project-gallery__empty-state">
              <Button onClick={openCreate} type="button" variant="primary">
                Create project
              </Button>
            </div>
          )}
        </section>

        {selectedProject && selectedApp ? (
          <section className="fg-project-workbench">
            <Panel className="fg-project-inspector">
              <PanelSection className="fg-project-inspector__head">
                <div className="fg-project-inspector__header-row">
                  <div>
                    <p className="fg-label fg-panel__eyebrow">{selectedProject.name}</p>
                    <PanelTitle>{selectedApp.name}</PanelTitle>
                  </div>

                  <div className="fg-console-inline-status">
                    <StatusBadge tone={selectedApp.phaseTone}>{selectedApp.phase}</StatusBadge>
                    <StatusBadge tone="neutral">{selectedApp.updatedLabel}</StatusBadge>
                  </div>
                </div>

                <div className="fg-project-inspector__meta-grid">
                  <div>
                    <dt>Source</dt>
                    <dd>{selectedApp.sourceLabel}</dd>
                  </div>
                  <div>
                    <dt>Build</dt>
                    <dd>{selectedApp.sourceMeta}</dd>
                  </div>
                  <div>
                    <dt>Route</dt>
                    <dd>
                      {selectedApp.routeHref ? (
                        <a className="fg-text-link" href={selectedApp.routeHref} rel="noreferrer" target="_blank">
                          {selectedApp.routeLabel}
                        </a>
                      ) : (
                        selectedApp.routeLabel
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedApp.lastMessage}</dd>
                  </div>
                </div>
              </PanelSection>

              <PanelSection className="fg-project-inspector__controls">
                <div className="fg-project-actions">
                  <button
                    className="fg-console-utility-button"
                    disabled={busyAction !== null}
                    onClick={() => handleAppAction("restart")}
                    type="button"
                  >
                    {busyAction === "restart" ? "Restarting…" : "Restart"}
                  </button>
                  <button
                    className="fg-console-utility-button"
                    disabled={busyAction !== null}
                    onClick={() => handleAppAction("disable")}
                    type="button"
                  >
                    {busyAction === "disable" ? "Pausing…" : "Pause"}
                  </button>
                  <button
                    className="fg-console-utility-button is-danger"
                    disabled={busyAction !== null}
                    onClick={() => handleAppAction("delete")}
                    type="button"
                  >
                    {busyAction === "delete" ? "Deleting…" : "Delete"}
                  </button>
                </div>

                <div className="fg-project-tabs" role="tablist" aria-label="App controls">
                  {[
                    { id: "env", label: "Environment" },
                    { id: "files", label: "Files" },
                    { id: "logs", label: "Logs" },
                  ].map((tab) => (
                    <button
                      aria-selected={activeTab === tab.id}
                      className={cx(
                        "fg-project-tab",
                        activeTab === tab.id && "is-active",
                      )}
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as "env" | "files" | "logs")}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </PanelSection>

              <PanelSection>
                {activeTab === "env" ? (
                  <div className="fg-workbench-section">
                    <div className="fg-workbench-section__actions">
                      <button
                        className="fg-console-utility-button"
                        onClick={addEnvRow}
                        type="button"
                      >
                        Add variable
                      </button>
                      <button
                        className="fg-console-utility-button"
                        disabled={envSaving || envStatus === "loading"}
                        onClick={saveEnv}
                        type="button"
                      >
                        {envSaving ? "Saving…" : "Save"}
                      </button>
                    </div>

                    {envStatus === "loading" ? (
                      <p className="fg-console-note">Loading environment…</p>
                    ) : (
                      <div className="fg-env-table">
                        {envRows.length ? (
                          envRows.map((row) => (
                            <div
                              className={cx(
                                "fg-env-row",
                                row.removed && "is-removed",
                              )}
                              key={row.id}
                            >
                              <input
                                className="fg-input"
                                disabled={row.existing}
                                onChange={(event) => updateEnvRow(row.id, "key", event.target.value)}
                                placeholder="KEY"
                                value={row.existing ? row.originalKey : row.key}
                              />
                              <input
                                className="fg-input"
                                onChange={(event) => updateEnvRow(row.id, "value", event.target.value)}
                                placeholder="value"
                                value={row.value}
                              />
                              <button
                                className="fg-console-utility-button"
                                onClick={() => removeEnvRow(row.id)}
                                type="button"
                              >
                                {row.existing ? (row.removed ? "Undo" : "Remove") : "Discard"}
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="fg-console-note">No environment variables yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {activeTab === "files" ? (
                  <div className="fg-workbench-section">
                    <div className="fg-workbench-section__actions">
                      <button
                        className="fg-console-utility-button"
                        onClick={addFileDraft}
                        type="button"
                      >
                        Add file
                      </button>
                      <button
                        className="fg-console-utility-button"
                        disabled={filesSaving || !selectedFile}
                        onClick={saveFile}
                        type="button"
                      >
                        {filesSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        className="fg-console-utility-button is-danger"
                        disabled={filesSaving || !selectedFile}
                        onClick={deleteFile}
                        type="button"
                      >
                        {filesSaving ? "Deleting…" : "Delete"}
                      </button>
                    </div>

                    {filesStatus === "loading" ? (
                      <p className="fg-console-note">Loading files…</p>
                    ) : (
                      <div className="fg-file-editor">
                        <div className="fg-file-editor__list">
                          {fileDrafts.length ? (
                            fileDrafts.map((file) => (
                              <button
                                className={cx(
                                  "fg-file-pill",
                                  selectedFile?.id === file.id && "is-active",
                                )}
                                key={file.id}
                                onClick={() => setSelectedFileId(file.id)}
                                type="button"
                              >
                                {file.path || "new file"}
                              </button>
                            ))
                          ) : (
                            <p className="fg-console-note">No files configured.</p>
                          )}
                        </div>

                        {selectedFile ? (
                          <div className="fg-file-editor__panel">
                            <div className="fg-file-editor__meta">
                              <input
                              className="fg-input"
                                onChange={(event) => updateFileDraft(selectedFile.id, { path: event.target.value })}
                                placeholder="/app/.env"
                                value={selectedFile.path}
                              />
                              <input
                                className="fg-input"
                                onChange={(event) => updateFileDraft(selectedFile.id, { mode: event.target.value })}
                                placeholder="420"
                                value={selectedFile.mode}
                              />
                              <label className="fg-project-toggle">
                                <input
                                  checked={selectedFile.secret}
                                  onChange={(event) => updateFileDraft(selectedFile.id, { secret: event.target.checked })}
                                  type="checkbox"
                                />
                                <span>Secret</span>
                              </label>
                            </div>

                            <textarea
                              className="fg-project-textarea"
                              onChange={(event) =>
                                updateFileDraft(selectedFile.id, {
                                  content: event.target.value,
                                  redacted: false,
                                })
                              }
                              placeholder={selectedFile.redacted ? "Secret file contents are redacted by Fugue until replaced." : ""}
                              value={selectedFile.content}
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}

                {activeTab === "logs" ? (
                  <div className="fg-workbench-section">
                    <div className="fg-workbench-section__actions">
                      <div className="fg-project-tabs" role="tablist" aria-label="Log modes">
                        {[
                          { id: "build", label: "Build" },
                          { id: "runtime", label: "Runtime" },
                        ].map((tab) => (
                          <button
                            aria-selected={logsMode === tab.id}
                            className={cx("fg-project-tab", logsMode === tab.id && "is-active")}
                            key={tab.id}
                            onClick={() => {
                              setLogsMode(tab.id as "build" | "runtime");
                              setLogsLoadedKey(null);
                            }}
                            role="tab"
                            type="button"
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {logsMode === "runtime" && selectedApp.hasPostgresService ? (
                        <div className="fg-project-tabs" role="tablist" aria-label="Runtime components">
                          {[
                            { id: "app", label: "App" },
                            { id: "postgres", label: "Postgres" },
                          ].map((tab) => (
                            <button
                              aria-selected={runtimeComponent === tab.id}
                              className={cx(
                                "fg-project-tab",
                                runtimeComponent === tab.id && "is-active",
                              )}
                              key={tab.id}
                              onClick={() => {
                                setRuntimeComponent(tab.id as "app" | "postgres");
                                setLogsLoadedKey(null);
                              }}
                              role="tab"
                              type="button"
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <button
                        className="fg-console-utility-button"
                        onClick={refreshLogs}
                        type="button"
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="fg-bezel fg-proof-shell">
                      <div className="fg-bezel__inner">
                        <div className="fg-proof-shell__ribbon">
                          {logsMeta.length ? logsMeta.map((item) => <span key={item}>{item}</span>) : <span>waiting</span>}
                        </div>
                        <pre>
                          <code>
                            {logsStatus === "loading"
                              ? "Loading logs…"
                              : logsBody || "No logs available."}
                          </code>
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : null}
              </PanelSection>
            </Panel>

            <Panel className="fg-project-services">
              <PanelSection>
                <p className="fg-label fg-panel__eyebrow">Current services</p>
                <PanelTitle>{selectedProject.name}</PanelTitle>
                <PanelCopy>{selectedProject.serviceCount} live surfaces in this project.</PanelCopy>
              </PanelSection>

              <PanelSection>
                <ul className="fg-project-service-list">
                  {selectedProject.services.map((service) => (
                    <li key={`${service.kind}:${service.id}`}>
                      {service.kind === "app" ? (
                        <button
                          className={cx(
                            "fg-project-service-card",
                            selectedApp?.id === service.id && "is-active",
                          )}
                          onClick={() => chooseApp(service.id)}
                          type="button"
                        >
                          <div className="fg-project-service-card__head">
                            <strong>{service.name}</strong>
                            <StatusBadge tone={service.phaseTone}>{service.phase}</StatusBadge>
                          </div>
                          <p>{service.sourceLabel}</p>
                          <span>{service.routeLabel}</span>
                        </button>
                      ) : (
                        <div className="fg-project-service-card is-static">
                          <div className="fg-project-service-card__head">
                            <strong>{service.name}</strong>
                            <StatusBadge tone={service.statusTone}>{service.status}</StatusBadge>
                          </div>
                          <p>{service.type}</p>
                          <span>{service.ownerAppLabel}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            </Panel>
          </section>
        ) : null}
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
                <p className="fg-label fg-panel__eyebrow">Create project</p>
                <PanelTitle className="fg-console-dialog__title" id="fugue-create-project-title">
                  Import repository
                </PanelTitle>
                <PanelCopy>
                  The project is only surfaced after a real import succeeds.
                </PanelCopy>
              </PanelSection>

              <PanelSection>
                {modalFlash ? (
                  <>
                    <InlineAlert variant={modalFlash.variant}>{modalFlash.message}</InlineAlert>
                    <div style={{ height: "0.9rem" }} aria-hidden="true" />
                  </>
                ) : null}

                <form className="fg-form-grid" onSubmit={handleCreateProject}>
                  <div className="fg-console-dialog__grid">
                    <label className="fg-field-stack">
                      <span className="fg-field-label">Project name</span>
                      <input
                        className="fg-input"
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder="default"
                        required
                        value={projectName}
                      />
                    </label>

                    <label className="fg-field-stack">
                      <span className="fg-field-label">Repository URL</span>
                      <input
                        className="fg-input"
                        onChange={(event) => setRepoUrl(event.target.value)}
                        placeholder="https://github.com/owner/repo"
                        required
                        value={repoUrl}
                      />
                    </label>

                    <details className="fg-console-disclosure fg-console-dialog__advanced">
                      <summary>Advanced</summary>
                      <div className="fg-console-dialog__advanced-grid">
                        <label className="fg-field-stack">
                          <span className="fg-field-label">Branch</span>
                          <input
                            className="fg-input"
                            onChange={(event) => setBranch(event.target.value)}
                            placeholder="main"
                            value={branch}
                          />
                        </label>

                        <label className="fg-field-stack">
                          <span className="fg-field-label">App name</span>
                          <input
                            className="fg-input"
                            onChange={(event) => setAppName(event.target.value)}
                            placeholder="leave blank to reuse repo name"
                            value={appName}
                          />
                        </label>

                        <label className="fg-field-stack">
                          <span className="fg-field-label">Build strategy</span>
                          <select
                            className="fg-input"
                            onChange={(event) => setBuildStrategy(event.target.value as BuildStrategyValue)}
                            value={buildStrategy}
                          >
                            {BUILD_STRATEGY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </details>
                  </div>

                  <div className="fg-console-dialog__actions">
                    <Button onClick={closeCreate} type="button" variant="ghost">
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      {isCreating ? "Creating…" : "Create project"}
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
