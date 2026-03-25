"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";

import { InlineAlert } from "@/components/ui/inline-alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/ui/cx";

type ConsoleFilesWorkbenchProps = {
  appId: string;
  appName: string;
  workspaceMountPath: string | null;
};

type FilesystemTreeEntryRecord = {
  hasChildren?: boolean;
  kind?: string | null;
  mode?: number | null;
  modifiedAt?: string | null;
  name?: string;
  path?: string;
  size?: number | null;
};

type FilesystemTreeResponse = {
  entries?: FilesystemTreeEntryRecord[];
  path?: string | null;
  workspaceRoot?: string | null;
};

type FilesystemFileResponse = {
  content?: string;
  encoding?: string | null;
  mode?: number | null;
  modifiedAt?: string | null;
  path?: string | null;
  size?: number | null;
  truncated?: boolean;
  workspaceRoot?: string | null;
};

type FilesystemMutationResponse = {
  kind?: string | null;
  mode?: number | null;
  modifiedAt?: string | null;
  path?: string | null;
  size?: number | null;
  workspaceRoot?: string | null;
};

type FilesystemEntry = {
  hasChildren: boolean;
  kind: "dir" | "file";
  mode: number | null;
  modifiedAt: string | null;
  name: string;
  path: string;
  size: number | null;
};

type DirectoryBucket = {
  entries: FilesystemEntry[];
  status: "error" | "idle" | "loading" | "ready";
};

type FileDocument = {
  content: string;
  dirty: boolean;
  encoding: "base64" | "utf-8";
  mode: string;
  modifiedAt: string | null;
  path: string;
  size: number | null;
  status: "error" | "idle" | "loading" | "ready";
  truncated: boolean;
};

type SelectedNode = {
  kind: "dir" | "file";
  path: string;
};

type FileComposer = {
  content: string;
  encoding: "base64" | "utf-8";
  kind: "file";
  mkdirParents: boolean;
  mode: string;
  path: string;
};

type DirectoryComposer = {
  kind: "directory";
  mode: string;
  parents: boolean;
  path: string;
};

type ComposerState = DirectoryComposer | FileComposer;

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

function normalizeEncoding(value?: string | null): "base64" | "utf-8" {
  return value === "base64" ? "base64" : "utf-8";
}

function normalizeTreeEntries(entries: FilesystemTreeEntryRecord[]) {
  return entries
    .flatMap((entry) => {
      const path = typeof entry.path === "string" ? entry.path.trim() : "";
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const kind = entry.kind === "dir" ? "dir" : entry.kind === "file" ? "file" : null;

      if (!path || !name || !kind) {
        return [];
      }

      return [
        {
          hasChildren: Boolean(entry.hasChildren),
          kind,
          mode: typeof entry.mode === "number" ? entry.mode : null,
          modifiedAt: typeof entry.modifiedAt === "string" ? entry.modifiedAt : null,
          name,
          path,
          size: typeof entry.size === "number" ? entry.size : null,
        } satisfies FilesystemEntry,
      ];
    })
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "dir" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

function isPathWithin(basePath: string, targetPath: string) {
  return targetPath === basePath || targetPath.startsWith(`${basePath}/`);
}

function trimTrailingSlash(value: string) {
  if (value === "/") {
    return value;
  }

  return value.replace(/\/+$/, "");
}

function joinPath(basePath: string, name: string) {
  const cleanBase = trimTrailingSlash(basePath);
  const cleanName = name.trim().replace(/^\/+/, "");

  if (!cleanName) {
    return cleanBase;
  }

  if (cleanBase === "/") {
    return `/${cleanName}`;
  }

  return `${cleanBase}/${cleanName}`;
}

function basename(targetPath: string) {
  const cleanPath = trimTrailingSlash(targetPath);
  const parts = cleanPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? cleanPath;
}

function parentDirectory(targetPath: string, workspaceRoot: string) {
  const cleanTarget = trimTrailingSlash(targetPath);
  const cleanRoot = trimTrailingSlash(workspaceRoot);

  if (cleanTarget === cleanRoot) {
    return cleanRoot;
  }

  const index = cleanTarget.lastIndexOf("/");

  if (index <= 0) {
    return cleanRoot;
  }

  const parentPath = cleanTarget.slice(0, index) || "/";
  return isPathWithin(cleanRoot, parentPath) ? parentPath : cleanRoot;
}

function directoryChain(targetDirectory: string, workspaceRoot: string) {
  const cleanRoot = trimTrailingSlash(workspaceRoot);
  const cleanTarget = trimTrailingSlash(targetDirectory);

  if (!isPathWithin(cleanRoot, cleanTarget)) {
    return [cleanRoot];
  }

  if (cleanTarget === cleanRoot) {
    return [cleanRoot];
  }

  const relativePath = cleanTarget.slice(cleanRoot.length).replace(/^\/+/, "");
  const segments = relativePath.split("/").filter(Boolean);
  const chain = [cleanRoot];
  let currentPath = cleanRoot;

  for (const segment of segments) {
    currentPath = joinPath(currentPath, segment);
    chain.push(currentPath);
  }

  return chain;
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function formatBytes(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unknown size";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSuggestedFilePath(baseDirectory: string) {
  return joinPath(baseDirectory, "untitled.txt");
}

function buildSuggestedDirectoryPath(baseDirectory: string) {
  return joinPath(baseDirectory, "new-folder");
}

function parseModeInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      message: null,
      value: undefined,
    } as const;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return {
      message: "Mode must be a non-negative integer.",
      value: undefined,
    } as const;
  }

  return {
    message: null,
    value: parsed,
  } as const;
}

function buildPathSegments(targetPath: string, workspaceRoot: string) {
  const cleanRoot = trimTrailingSlash(workspaceRoot);
  const cleanTarget = trimTrailingSlash(targetPath);
  const rootLabel = basename(cleanRoot) || cleanRoot;

  if (cleanTarget === cleanRoot) {
    return [{ label: rootLabel, path: cleanRoot }];
  }

  const relativePath = cleanTarget.slice(cleanRoot.length).replace(/^\/+/, "");
  const segments = relativePath.split("/").filter(Boolean);
  const out = [{ label: rootLabel, path: cleanRoot }];
  let currentPath = cleanRoot;

  for (const segment of segments) {
    currentPath = joinPath(currentPath, segment);
    out.push({
      label: segment,
      path: currentPath,
    });
  }

  return out;
}

function currentDirectoryPath(
  composer: ComposerState | null,
  selectedNode: SelectedNode | null,
  workspaceRoot: string,
) {
  if (composer?.kind === "directory") {
    return parentDirectory(composer.path, workspaceRoot);
  }

  if (composer?.kind === "file") {
    return parentDirectory(composer.path, workspaceRoot);
  }

  if (!selectedNode) {
    return workspaceRoot;
  }

  if (selectedNode.kind === "dir") {
    return selectedNode.path;
  }

  return parentDirectory(selectedNode.path, workspaceRoot);
}

function FolderIcon({ open = false }: { open?: boolean }) {
  return (
    <svg aria-hidden="true" className="fg-filesystem-icon" viewBox="0 0 20 20">
      <path
        d={open ? "M2.5 6.5h5l1.6 1.9h8.4l-1.4 7.1H3.9L2.5 6.5Z" : "M2.5 5.5h4.6l1.5 1.8H17.5v8H2.5v-9.8Z"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" className="fg-filesystem-icon" viewBox="0 0 20 20">
      <path
        d="M5.3 2.8h6.1l3.3 3.4v10.9H5.3V2.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
      <path
        d="M11.4 2.8v3.6h3.3"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function ChevronIcon({ expanded = false }: { expanded?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cx("fg-filesystem-chevron", expanded && "is-expanded")}
      viewBox="0 0 16 16"
    >
      <path
        d="M5.5 3.5 10 8l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" className="fg-filesystem-action-icon" viewBox="0 0 20 20">
      <path
        d="M15.8 9.1a5.8 5.8 0 1 1-1.1-3.3M15.8 4.8v4.4h-4.4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="fg-filesystem-action-icon" viewBox="0 0 20 20">
      <path
        d="M10 4.5v11M4.5 10h11"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg aria-hidden="true" className="fg-filesystem-action-icon" viewBox="0 0 20 20">
      <path
        d="M4.3 3.3h9.1l2.3 2.4v11H4.3V3.3Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
      <path
        d="M6.4 3.3v4.1h6.6V3.3M7 16.7v-4.5h6v4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="fg-filesystem-action-icon" viewBox="0 0 20 20">
      <path
        d="M5.3 6.2h9.4M7.3 6.2V4.8h5.4v1.4M7.8 8.4v6M10 8.4v6M12.2 8.4v6M6.6 6.2l.6 9h5.6l.6-9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

export function ConsoleFilesWorkbench({
  appId,
  appName,
  workspaceMountPath,
}: ConsoleFilesWorkbenchProps) {
  const { showToast } = useToast();
  const [workspaceRoot, setWorkspaceRoot] = useState(workspaceMountPath ?? "/workspace");
  const [directories, setDirectories] = useState<Record<string, DirectoryBucket>>({});
  const [expandedPaths, setExpandedPaths] = useState<string[]>(workspaceMountPath ? [workspaceMountPath] : []);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(
    workspaceMountPath ? { kind: "dir", path: workspaceMountPath } : null,
  );
  const [fileDocuments, setFileDocuments] = useState<Record<string, FileDocument>>({});
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [rootStatus, setRootStatus] = useState<"error" | "idle" | "loading" | "ready">(
    workspaceMountPath ? "loading" : "idle",
  );
  const [busyAction, setBusyAction] = useState<"delete" | "refresh" | "save" | null>(null);

  const selectedFile =
    !composer && selectedNode?.kind === "file" ? fileDocuments[selectedNode.path] ?? null : null;
  const selectedDirectory =
    !composer && selectedNode?.kind === "dir" ? directories[selectedNode.path] ?? null : null;
  const highlightedPath = composer
    ? currentDirectoryPath(composer, selectedNode, workspaceRoot)
    : selectedNode?.path ?? workspaceRoot;
  const canDeleteSelection =
    !composer &&
    Boolean(selectedNode) &&
    selectedNode?.path !== workspaceRoot;

  async function loadDirectory(
    targetPath: string,
    options?: {
      force?: boolean;
    },
  ) {
    const existing = directories[targetPath];

    if (!options?.force && existing?.status === "ready") {
      return existing.entries;
    }

    setDirectories((current) => ({
      ...current,
      [targetPath]: {
        entries: current[targetPath]?.entries ?? [],
        status: "loading",
      },
    }));

    const searchParams = new URLSearchParams();
    searchParams.set("path", targetPath);
    searchParams.set("depth", "1");
    const response = await requestJson<FilesystemTreeResponse>(
      `/api/fugue/apps/${appId}/filesystem/tree?${searchParams.toString()}`,
    );
    const resolvedRoot = response.workspaceRoot?.trim() || workspaceRoot;
    const resolvedPath = response.path?.trim() || targetPath;
    const entries = normalizeTreeEntries(response.entries ?? []);

    setWorkspaceRoot(resolvedRoot);
    setDirectories((current) => {
      const next = { ...current };

      if (resolvedPath !== targetPath) {
        delete next[targetPath];
      }

      next[resolvedPath] = {
        entries,
        status: "ready",
      };

      return next;
    });

    return {
      entries,
      path: resolvedPath,
      workspaceRoot: resolvedRoot,
    };
  }

  async function loadFile(
    targetPath: string,
    options?: {
      force?: boolean;
    },
  ) {
    const existing = fileDocuments[targetPath];

    if (!options?.force && existing?.status === "ready") {
      return existing;
    }

    setFileDocuments((current) => ({
      ...current,
      [targetPath]: {
        content: current[targetPath]?.content ?? "",
        dirty: false,
        encoding: current[targetPath]?.encoding ?? "utf-8",
        mode: current[targetPath]?.mode ?? "",
        modifiedAt: current[targetPath]?.modifiedAt ?? null,
        path: targetPath,
        size: current[targetPath]?.size ?? null,
        status: "loading",
        truncated: current[targetPath]?.truncated ?? false,
      },
    }));

    const searchParams = new URLSearchParams();
    searchParams.set("path", targetPath);
    searchParams.set("max_bytes", "1048576");
    const response = await requestJson<FilesystemFileResponse>(
      `/api/fugue/apps/${appId}/filesystem/file?${searchParams.toString()}`,
    );
    const resolvedRoot = response.workspaceRoot?.trim() || workspaceRoot;
    const resolvedPath = response.path?.trim() || targetPath;
    const nextDocument = {
      content: typeof response.content === "string" ? response.content : "",
      dirty: false,
      encoding: normalizeEncoding(response.encoding),
      mode: typeof response.mode === "number" ? String(response.mode) : "",
      modifiedAt: typeof response.modifiedAt === "string" ? response.modifiedAt : null,
      path: resolvedPath,
      size: typeof response.size === "number" ? response.size : null,
      status: "ready",
      truncated: Boolean(response.truncated),
    } satisfies FileDocument;

    setWorkspaceRoot(resolvedRoot);
    setFileDocuments((current) => {
      const next = { ...current };

      if (resolvedPath !== targetPath) {
        delete next[targetPath];
      }

      next[resolvedPath] = nextDocument;
      return next;
    });

    return nextDocument;
  }

  async function reloadDirectoryChain(targetDirectory: string) {
    const chain = directoryChain(targetDirectory, workspaceRoot);

    setExpandedPaths((current) => Array.from(new Set([...current, ...chain])));

    for (const directoryPath of chain) {
      await loadDirectory(directoryPath, { force: true });
    }
  }

  function prunePathState(targetPath: string) {
    setDirectories((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([path]) => !isPathWithin(targetPath, path)),
      ),
    );
    setFileDocuments((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([path]) => !isPathWithin(targetPath, path)),
      ),
    );
    setExpandedPaths((current) => current.filter((path) => !isPathWithin(targetPath, path)));
  }

  useEffect(() => {
    if (!workspaceMountPath) {
      setWorkspaceRoot("/workspace");
      setDirectories({});
      setExpandedPaths([]);
      setSelectedNode(null);
      setFileDocuments({});
      setComposer(null);
      setRootStatus("idle");
      return;
    }

    let cancelled = false;
    setWorkspaceRoot(workspaceMountPath);
    setDirectories({});
    setExpandedPaths([workspaceMountPath]);
    setSelectedNode({ kind: "dir", path: workspaceMountPath });
    setFileDocuments({});
    setComposer(null);
    setRootStatus("loading");

    requestJson<FilesystemTreeResponse>(`/api/fugue/apps/${appId}/filesystem/tree`)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const resolvedRoot = response.workspaceRoot?.trim() || workspaceMountPath;
        const resolvedPath = response.path?.trim() || resolvedRoot;
        const entries = normalizeTreeEntries(response.entries ?? []);

        setWorkspaceRoot(resolvedRoot);
        setDirectories({
          [resolvedPath]: {
            entries,
            status: "ready",
          },
        });
        setExpandedPaths([resolvedRoot]);
        setSelectedNode({ kind: "dir", path: resolvedRoot });
        setRootStatus("ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setRootStatus("error");
        showToast({
          message: readErrorMessage(error),
          variant: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [appId, showToast, workspaceMountPath]);

  function handleDirectoryToggle(targetPath: string) {
    setComposer(null);
    setSelectedNode({ kind: "dir", path: targetPath });

    if (targetPath === workspaceRoot) {
      if (directories[targetPath]?.status !== "ready") {
        void loadDirectory(targetPath).catch((error) => {
          showToast({
            message: readErrorMessage(error),
            variant: "error",
          });
        });
      }
      return;
    }

    const isExpanded = expandedPaths.includes(targetPath);

    if (isExpanded) {
      setExpandedPaths((current) => current.filter((path) => !isPathWithin(targetPath, path)));
      return;
    }

    setExpandedPaths((current) => Array.from(new Set([...current, targetPath])));
    void loadDirectory(targetPath).catch((error) => {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    });
  }

  function handleFileSelect(targetPath: string) {
    setComposer(null);
    setSelectedNode({ kind: "file", path: targetPath });
    void loadFile(targetPath).catch((error) => {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    });
  }

  function startNewFile() {
    const baseDirectory = currentDirectoryPath(composer, selectedNode, workspaceRoot);
    setComposer({
      content: "",
      encoding: "utf-8",
      kind: "file",
      mkdirParents: true,
      mode: "",
      path: buildSuggestedFilePath(baseDirectory),
    });
  }

  function startNewDirectory() {
    const baseDirectory = currentDirectoryPath(composer, selectedNode, workspaceRoot);
    setComposer({
      kind: "directory",
      mode: "",
      parents: true,
      path: buildSuggestedDirectoryPath(baseDirectory),
    });
  }

  function cancelComposer() {
    setComposer(null);
  }

  async function handleRefresh() {
    if (!workspaceMountPath || busyAction) {
      return;
    }

    setBusyAction("refresh");

    try {
      const targetDirectory =
        composer?.kind === "directory"
          ? parentDirectory(composer.path, workspaceRoot)
          : composer?.kind === "file"
            ? parentDirectory(composer.path, workspaceRoot)
            : selectedNode?.kind === "dir"
              ? selectedNode.path
              : selectedNode?.kind === "file"
                ? parentDirectory(selectedNode.path, workspaceRoot)
                : workspaceRoot;

      await reloadDirectoryChain(targetDirectory);

      if (selectedNode?.kind === "file") {
        await loadFile(selectedNode.path, { force: true });
      }

      showToast({
        message: "Workspace refreshed.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSave() {
    if (!workspaceMountPath || busyAction) {
      return;
    }

    const modeValue = parseModeInput(composer?.mode ?? selectedFile?.mode ?? "");

    if (modeValue.message) {
      showToast({
        message: modeValue.message,
        variant: "error",
      });
      return;
    }

    setBusyAction("save");

    try {
      if (composer?.kind === "directory") {
        if (!composer.path.trim()) {
          throw new Error("Directory path is required.");
        }

        const response = await requestJson<FilesystemMutationResponse>(
          `/api/fugue/apps/${appId}/filesystem/directory`,
          {
            body: JSON.stringify({
              ...(modeValue.value !== undefined ? { mode: modeValue.value } : {}),
              parents: composer.parents,
              path: composer.path.trim(),
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );
        const targetPath = response.path?.trim() || composer.path.trim();
        const nextRoot = response.workspaceRoot?.trim() || workspaceRoot;

        setWorkspaceRoot(nextRoot);
        setComposer(null);
        setSelectedNode({ kind: "dir", path: targetPath });
        await reloadDirectoryChain(targetPath);
        showToast({
          message: "Folder created.",
          variant: "success",
        });
        return;
      }

      if (composer?.kind === "file") {
        if (!composer.path.trim()) {
          throw new Error("File path is required.");
        }

        const response = await requestJson<FilesystemMutationResponse>(
          `/api/fugue/apps/${appId}/filesystem/file`,
          {
            body: JSON.stringify({
              content: composer.content,
              encoding: composer.encoding,
              mkdir_parents: composer.mkdirParents,
              ...(modeValue.value !== undefined ? { mode: modeValue.value } : {}),
              path: composer.path.trim(),
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "PUT",
          },
        );
        const targetPath = response.path?.trim() || composer.path.trim();
        const nextRoot = response.workspaceRoot?.trim() || workspaceRoot;

        setWorkspaceRoot(nextRoot);
        setFileDocuments((current) => ({
          ...current,
          [targetPath]: {
            content: composer.content,
            dirty: false,
            encoding: composer.encoding,
            mode: modeValue.value !== undefined ? String(modeValue.value) : "",
            modifiedAt:
              typeof response.modifiedAt === "string" ? response.modifiedAt : current[targetPath]?.modifiedAt ?? null,
            path: targetPath,
            size: typeof response.size === "number" ? response.size : composer.content.length,
            status: "ready",
            truncated: false,
          },
        }));
        setComposer(null);
        setSelectedNode({ kind: "file", path: targetPath });
        await reloadDirectoryChain(parentDirectory(targetPath, nextRoot));
        showToast({
          message: "File saved.",
          variant: "success",
        });
        return;
      }

      if (!selectedNode || selectedNode.kind !== "file" || !selectedFile) {
        throw new Error("Select a file before saving.");
      }

      if (selectedFile.truncated) {
        throw new Error("Large file preview is truncated. Save is disabled for safety.");
      }

      const response = await requestJson<FilesystemMutationResponse>(
        `/api/fugue/apps/${appId}/filesystem/file`,
        {
          body: JSON.stringify({
            content: selectedFile.content,
            encoding: selectedFile.encoding,
            ...(modeValue.value !== undefined ? { mode: modeValue.value } : {}),
            path: selectedFile.path,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PUT",
        },
      );

      setFileDocuments((current) => ({
        ...current,
        [selectedFile.path]: {
          ...current[selectedFile.path],
          dirty: false,
          mode: modeValue.value !== undefined ? String(modeValue.value) : "",
          modifiedAt:
            typeof response.modifiedAt === "string" ? response.modifiedAt : current[selectedFile.path]?.modifiedAt ?? null,
          size: typeof response.size === "number" ? response.size : current[selectedFile.path]?.size ?? null,
          status: "ready",
        },
      }));
      await reloadDirectoryChain(parentDirectory(selectedFile.path, workspaceRoot));
      showToast({
        message: "File saved.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete() {
    if (!workspaceMountPath || busyAction) {
      return;
    }

    if (!selectedNode || selectedNode.path === workspaceRoot) {
      return;
    }

    const confirmed = window.confirm(
      selectedNode.kind === "dir"
        ? `Delete ${selectedNode.path} and everything inside it?`
        : `Delete ${selectedNode.path}?`,
    );

    if (!confirmed) {
      return;
    }

    setBusyAction("delete");

    try {
      const searchParams = new URLSearchParams();
      searchParams.set("path", selectedNode.path);

      if (selectedNode.kind === "dir") {
        searchParams.set("recursive", "true");
      }

      await requestJson(`/api/fugue/apps/${appId}/filesystem?${searchParams.toString()}`, {
        method: "DELETE",
      });

      const nextSelectedPath = parentDirectory(selectedNode.path, workspaceRoot);
      prunePathState(selectedNode.path);
      setComposer(null);
      setSelectedNode({ kind: "dir", path: nextSelectedPath });
      await reloadDirectoryChain(nextSelectedPath);
      showToast({
        message: selectedNode.kind === "dir" ? "Folder deleted." : "File deleted.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        message: readErrorMessage(error),
        variant: "error",
      });
    } finally {
      setBusyAction(null);
    }
  }

  function updateSelectedFile(patch: Partial<FileDocument>) {
    if (!selectedNode || selectedNode.kind !== "file") {
      return;
    }

    setFileDocuments((current) => {
      const existing = current[selectedNode.path];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [selectedNode.path]: {
          ...existing,
          ...patch,
          dirty: true,
        },
      };
    });
  }

  function renderTree(targetPath: string, depth: number) {
    const bucket = directories[targetPath];

    if (bucket?.status === "loading" && bucket.entries.length === 0) {
      return (
        <div className="fg-filesystem-tree__placeholder">
          <div className="fg-filesystem-tree__skeleton" />
          <div className="fg-filesystem-tree__skeleton" />
          <div className="fg-filesystem-tree__skeleton" />
        </div>
      );
    }

    if (bucket?.status === "error" && bucket.entries.length === 0) {
      return <p className="fg-console-note">Unable to load this folder.</p>;
    }

    if (!bucket?.entries.length) {
      return null;
    }

    return bucket.entries.map((entry) => {
      const isExpanded = entry.kind === "dir" && expandedPaths.includes(entry.path);
      const isSelected = highlightedPath === entry.path;

      return (
        <div className="fg-filesystem-node" key={entry.path}>
          <button
            aria-expanded={entry.kind === "dir" ? isExpanded : undefined}
            className={cx(
              "fg-filesystem-node__button",
              isSelected && "is-active",
              entry.kind === "dir" && "is-directory",
            )}
            onClick={() =>
              entry.kind === "dir"
                ? handleDirectoryToggle(entry.path)
                : handleFileSelect(entry.path)
            }
            style={{ "--fg-filesystem-depth": depth } as CSSProperties}
            title={entry.path}
            type="button"
          >
            <span className="fg-filesystem-node__lead">
              {entry.kind === "dir" ? (
                <span className="fg-filesystem-node__disclosure">
                  <ChevronIcon expanded={isExpanded} />
                </span>
              ) : (
                <span className="fg-filesystem-node__disclosure is-placeholder" />
              )}
              {entry.kind === "dir" ? <FolderIcon open={isExpanded} /> : <FileIcon />}
            </span>
            <span className="fg-filesystem-node__body">
              <span className="fg-filesystem-node__label">{entry.name}</span>
              <span className="fg-filesystem-node__meta">
                {entry.kind === "dir"
                  ? entry.hasChildren
                    ? "folder"
                    : "empty folder"
                  : formatBytes(entry.size)}
              </span>
            </span>
          </button>

          {entry.kind === "dir" && isExpanded ? (
            <div className="fg-filesystem-node__children">{renderTree(entry.path, depth + 1)}</div>
          ) : null}
        </div>
      );
    });
  }

  if (!workspaceMountPath) {
    return (
      <div className="fg-workbench-section">
        <InlineAlert variant="info">
          Persistent workspace is not configured for {appName}.
        </InlineAlert>
      </div>
    );
  }

  const pathSegments = buildPathSegments(
    composer?.path ?? selectedNode?.path ?? workspaceRoot,
    workspaceRoot,
  );
  const directoryEntries = selectedDirectory?.entries ?? [];
  const directoryCount = directoryEntries.filter((entry) => entry.kind === "dir").length;
  const fileCount = directoryEntries.filter((entry) => entry.kind === "file").length;
  const saveDisabled = Boolean(
    busyAction ||
      (
        composer
          ? !composer.path.trim()
          : !selectedFile || !selectedFile.dirty || selectedFile.status !== "ready" || selectedFile.truncated
      ),
  );

  return (
    <div className="fg-workbench-section">
      <div className="fg-workbench-section__head">
        <div className="fg-workbench-section__copy">
          <p className="fg-label fg-panel__eyebrow">Files</p>
          <p className="fg-console-note">Browse and edit the live workspace mounted into {appName}.</p>
        </div>

        <div className="fg-workbench-section__actions">
          <Button
            disabled={Boolean(busyAction)}
            icon={<RefreshIcon />}
            loading={busyAction === "refresh"}
            loadingLabel="Refreshing…"
            onClick={handleRefresh}
            size="compact"
            type="button"
            variant="secondary"
          >
            Refresh
          </Button>
          <Button
            disabled={Boolean(busyAction)}
            icon={<PlusIcon />}
            onClick={startNewFile}
            size="compact"
            type="button"
            variant="secondary"
          >
            New file
          </Button>
          <Button
            disabled={Boolean(busyAction)}
            icon={<PlusIcon />}
            onClick={startNewDirectory}
            size="compact"
            type="button"
            variant="secondary"
          >
            New folder
          </Button>
          {composer ? (
            <Button
              disabled={Boolean(busyAction)}
              onClick={cancelComposer}
              size="compact"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          ) : null}
          <Button
            disabled={saveDisabled}
            icon={<SaveIcon />}
            loading={busyAction === "save"}
            loadingLabel="Saving…"
            onClick={handleSave}
            size="compact"
            type="button"
            variant="primary"
          >
            Save
          </Button>
          <Button
            disabled={!canDeleteSelection || Boolean(busyAction)}
            icon={<TrashIcon />}
            loading={busyAction === "delete"}
            loadingLabel="Deleting…"
            onClick={handleDelete}
            size="compact"
            type="button"
            variant="danger"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="fg-filesystem">
        <aside className="fg-filesystem__browser">
          <div className="fg-filesystem__browser-head">
            <p className="fg-filesystem__eyebrow">Workspace</p>
            <p className="fg-filesystem__root-path">{workspaceRoot}</p>
          </div>

          <div className="fg-filesystem__tree">
            <button
              className={cx(
                "fg-filesystem-node__button",
                highlightedPath === workspaceRoot && "is-active",
                "is-directory",
                "is-root",
              )}
              onClick={() => handleDirectoryToggle(workspaceRoot)}
              title={workspaceRoot}
              type="button"
            >
              <span className="fg-filesystem-node__lead">
                <span className="fg-filesystem-node__disclosure is-placeholder" />
                <FolderIcon open />
              </span>
              <span className="fg-filesystem-node__body">
                <span className="fg-filesystem-node__label">{basename(workspaceRoot) || workspaceRoot}</span>
                <span className="fg-filesystem-node__meta">
                  {rootStatus === "loading" ? "loading" : "workspace root"}
                </span>
              </span>
            </button>

            {rootStatus === "loading" && !directories[workspaceRoot]?.entries.length ? (
              <div className="fg-filesystem-tree__placeholder">
                <div className="fg-filesystem-tree__skeleton" />
                <div className="fg-filesystem-tree__skeleton" />
                <div className="fg-filesystem-tree__skeleton" />
              </div>
            ) : null}

            {rootStatus === "error" ? (
              <InlineAlert variant="error">Unable to load the workspace tree.</InlineAlert>
            ) : null}

            {renderTree(workspaceRoot, 1)}
          </div>
        </aside>

        <section className="fg-filesystem__editor">
          <div className="fg-filesystem__pathbar">
            {pathSegments.map((segment, index) => (
              <span className="fg-filesystem__crumb" key={segment.path}>
                {index > 0 ? <span className="fg-filesystem__crumb-separator">/</span> : null}
                <span>{segment.label}</span>
              </span>
            ))}
          </div>

          {composer?.kind === "directory" ? (
            <div className="fg-filesystem-editor">
              <div className="fg-filesystem-editor__meta">
                <span className="fg-filesystem-editor__kind">New folder</span>
                <span className="fg-filesystem-editor__summary">
                  Created immediately inside the live workspace.
                </span>
              </div>

              <div className="fg-filesystem-editor__grid">
                <FormField
                  hint="Absolute path inside the workspace."
                  htmlFor={`filesystem-dir-path-${appId}`}
                  label="Folder path"
                >
                  <input
                    className="fg-input"
                    id={`filesystem-dir-path-${appId}`}
                    onChange={(event) =>
                      setComposer((current) =>
                        current?.kind === "directory"
                          ? { ...current, path: event.target.value }
                          : current,
                      )
                    }
                    spellCheck={false}
                    value={composer.path}
                  />
                </FormField>

                <FormField
                  hint="Optional chmod value, for example 493."
                  htmlFor={`filesystem-dir-mode-${appId}`}
                  label="Mode"
                >
                  <input
                    className="fg-input"
                    id={`filesystem-dir-mode-${appId}`}
                    onChange={(event) =>
                      setComposer((current) =>
                        current?.kind === "directory"
                          ? { ...current, mode: event.target.value }
                          : current,
                      )
                    }
                    placeholder="493"
                    spellCheck={false}
                    value={composer.mode}
                  />
                </FormField>
              </div>

              <label className="fg-project-toggle">
                <input
                  checked={composer.parents}
                  onChange={(event) =>
                    setComposer((current) =>
                      current?.kind === "directory"
                        ? { ...current, parents: event.target.checked }
                        : current,
                    )
                  }
                  type="checkbox"
                />
                <span>Create parent folders when missing</span>
              </label>
            </div>
          ) : null}

          {composer?.kind === "file" ? (
            <div className="fg-filesystem-editor">
              <div className="fg-filesystem-editor__meta">
                <span className="fg-filesystem-editor__kind">New file</span>
                <span className="fg-filesystem-editor__summary">
                  Saved directly into the live workspace.
                </span>
              </div>

              <div className="fg-filesystem-editor__grid">
                <FormField
                  hint="Absolute path inside the workspace."
                  htmlFor={`filesystem-file-path-${appId}`}
                  label="File path"
                >
                  <input
                    className="fg-input"
                    id={`filesystem-file-path-${appId}`}
                    onChange={(event) =>
                      setComposer((current) =>
                        current?.kind === "file"
                          ? { ...current, path: event.target.value }
                          : current,
                      )
                    }
                    spellCheck={false}
                    value={composer.path}
                  />
                </FormField>

                <FormField
                  hint="Optional chmod value, for example 420."
                  htmlFor={`filesystem-file-mode-${appId}`}
                  label="Mode"
                >
                  <input
                    className="fg-input"
                    id={`filesystem-file-mode-${appId}`}
                    onChange={(event) =>
                      setComposer((current) =>
                        current?.kind === "file"
                          ? { ...current, mode: event.target.value }
                          : current,
                      )
                    }
                    placeholder="420"
                    spellCheck={false}
                    value={composer.mode}
                  />
                </FormField>
              </div>

              <label className="fg-project-toggle">
                <input
                  checked={composer.mkdirParents}
                  onChange={(event) =>
                    setComposer((current) =>
                      current?.kind === "file"
                        ? { ...current, mkdirParents: event.target.checked }
                        : current,
                    )
                  }
                  type="checkbox"
                />
                <span>Create parent folders when missing</span>
              </label>

              <FormField
                hint={
                  composer.encoding === "base64"
                    ? "Content will be written as base64."
                    : "The file will be written as UTF-8 text."
                }
                htmlFor={`filesystem-file-content-${appId}`}
                label="Content"
              >
                <textarea
                  className="fg-project-textarea fg-filesystem-editor__textarea"
                  id={`filesystem-file-content-${appId}`}
                  onChange={(event) =>
                    setComposer((current) =>
                      current?.kind === "file"
                        ? { ...current, content: event.target.value }
                        : current,
                    )
                  }
                  spellCheck={false}
                  value={composer.content}
                />
              </FormField>
            </div>
          ) : null}

          {!composer && selectedNode?.kind === "dir" ? (
            <div className="fg-filesystem-editor">
              <div className="fg-filesystem-editor__meta">
                <span className="fg-filesystem-editor__kind">Folder</span>
                <span className="fg-filesystem-editor__summary">
                  {selectedDirectory?.status === "loading"
                    ? "Loading…"
                    : `${directoryCount} folder${directoryCount === 1 ? "" : "s"} · ${fileCount} file${fileCount === 1 ? "" : "s"}`}
                </span>
              </div>

              <div className="fg-filesystem-editor__readout">
                <span>{selectedNode.path}</span>
                <span>
                  {selectedDirectory?.status === "loading"
                    ? "Updating"
                    : selectedNode.path === workspaceRoot
                      ? "Workspace root"
                      : "Directory"}
                </span>
              </div>

              {!directoryEntries.length && selectedDirectory?.status === "ready" ? (
                <InlineAlert variant="info">This folder is empty.</InlineAlert>
              ) : null}

              <p className="fg-console-note">
                Select a file on the left to edit it, or create a new file or folder here.
              </p>
            </div>
          ) : null}

          {!composer && selectedNode?.kind === "file" ? (
            <div className="fg-filesystem-editor">
              <div className="fg-filesystem-editor__meta">
                <span className="fg-filesystem-editor__kind">File</span>
                <span className="fg-filesystem-editor__summary">
                  {selectedFile?.status === "loading"
                    ? "Loading…"
                    : `${formatBytes(selectedFile?.size)} · ${selectedFile?.encoding === "base64" ? "base64" : "utf-8"}`}
                </span>
              </div>

              <div className="fg-filesystem-editor__grid">
                <FormField
                  htmlFor={`filesystem-selected-path-${appId}`}
                  label="Path"
                >
                  <input
                    className="fg-input"
                    id={`filesystem-selected-path-${appId}`}
                    readOnly
                    spellCheck={false}
                    value={selectedNode.path}
                  />
                </FormField>

                <FormField
                  hint={`Last updated ${formatTimestamp(selectedFile?.modifiedAt)}`}
                  htmlFor={`filesystem-selected-mode-${appId}`}
                  label="Mode"
                >
                  <input
                    className="fg-input"
                    id={`filesystem-selected-mode-${appId}`}
                    onChange={(event) =>
                      updateSelectedFile({
                        mode: event.target.value,
                      })
                    }
                    placeholder="420"
                    spellCheck={false}
                    value={selectedFile?.mode ?? ""}
                  />
                </FormField>
              </div>

              {selectedFile?.encoding === "base64" ? (
                <InlineAlert variant="info">
                  This file is shown as base64 because it is not valid UTF-8 text.
                </InlineAlert>
              ) : null}

              {selectedFile?.truncated ? (
                <InlineAlert variant="error">
                  This preview was truncated at 1 MB. Save is disabled to avoid overwriting the file with partial content.
                </InlineAlert>
              ) : null}

              <FormField
                hint={
                  selectedFile?.truncated
                    ? "Partial preview only."
                    : `Last updated ${formatTimestamp(selectedFile?.modifiedAt)}`
                }
                htmlFor={`filesystem-selected-content-${appId}`}
                label="Content"
              >
                <textarea
                  className="fg-project-textarea fg-filesystem-editor__textarea"
                  id={`filesystem-selected-content-${appId}`}
                  onChange={(event) =>
                    updateSelectedFile({
                      content: event.target.value,
                    })
                  }
                  readOnly={selectedFile?.truncated}
                  spellCheck={false}
                  value={selectedFile?.content ?? ""}
                />
              </FormField>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
