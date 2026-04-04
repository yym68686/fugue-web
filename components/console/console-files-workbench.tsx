"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
} from "react";

import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import type { ConsoleGalleryPersistentStorageMountView } from "@/lib/console/gallery-types";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/ui/cx";

type ConsoleFilesWorkbenchProps = {
  appId: string;
  appName: string;
  persistentStorageMounts: ConsoleGalleryPersistentStorageMountView[];
};

type FilesystemRootMode = "filesystem" | "storage";

const FILESYSTEM_ROOT_MODE_OPTIONS: readonly SegmentedControlOption<FilesystemRootMode>[] = [
  { label: "Live filesystem", value: "filesystem" },
  { label: "Persistent storage", value: "storage" },
];

const PERSISTENT_STORAGE_COLLECTION_ROOT = "::persistent-storage::";

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

type CachedWorkbenchState = {
  composer: ComposerState | null;
  directories: Record<string, DirectoryBucket>;
  expandedPaths: string[];
  fileDocuments: Record<string, FileDocument>;
  requestedRootPath: string;
  rootMode: FilesystemRootMode;
  rootStatus: "error" | "idle" | "loading" | "ready";
  selectedNode: SelectedNode | null;
  storageMountSignature: string;
  workspaceRoot: string;
};

const filesWorkbenchCache = new Map<string, CachedWorkbenchState>();

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
  const cleanBase = trimTrailingSlash(basePath);
  const cleanTarget = trimTrailingSlash(targetPath);

  if (cleanBase === "/") {
    return cleanTarget === "/" || cleanTarget.startsWith("/");
  }

  return cleanTarget === cleanBase || cleanTarget.startsWith(`${cleanBase}/`);
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

function normalizeAbsolutePathInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const segments = trimmed.split("/");
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized.length > 0 ? `/${normalized.join("/")}` : "/";
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

function buildSuggestedFilePath(baseDirectory: string) {
  return joinPath(baseDirectory, "untitled.txt");
}

function buildSuggestedDirectoryPath(baseDirectory: string) {
  return joinPath(baseDirectory, "new-folder");
}

function normalizePersistentStorageMounts(
  mounts: ConsoleGalleryPersistentStorageMountView[],
) {
  return mounts.flatMap((mount) => {
    const path = normalizeAbsolutePathInput(mount.path);

    return path
      ? [
          {
            ...mount,
            path,
          },
        ]
      : [];
  });
}

type NormalizedPersistentStorageMount =
  ReturnType<typeof normalizePersistentStorageMounts>[number];

function readPersistentStorageMountSignature(
  mounts: ReturnType<typeof normalizePersistentStorageMounts>,
) {
  return mounts
    .map((mount) => `${mount.kind ?? "unknown"}:${mount.path}:${mount.mode ?? "null"}`)
    .join("|");
}

function buildPersistentStorageMountEntries(
  mounts: ReturnType<typeof normalizePersistentStorageMounts>,
) {
  return mounts
    .flatMap((mount) => {
      if (mount.kind !== "directory" && mount.kind !== "file") {
        return [];
      }

      return [
        {
          hasChildren: mount.kind === "directory",
          kind: mount.kind === "directory" ? "dir" : "file",
          mode: mount.mode,
          modifiedAt: null,
          name: mount.path,
          path: mount.path,
          size: null,
        } satisfies FilesystemEntry,
      ];
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function isPersistentStorageCollectionRoot(targetPath: string) {
  return targetPath === PERSISTENT_STORAGE_COLLECTION_ROOT;
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

function FilePlusIcon() {
  return (
    <svg aria-hidden="true" className="fg-filesystem-action-icon" viewBox="0 0 20 20">
      <path
        d="M4.8 2.8h5.8l3.1 3.2v10.7H4.8V2.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
      <path
        d="M10.6 2.8v3.3h3.1M14.1 12.4v3.8M12.2 14.3H16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg aria-hidden="true" className="fg-filesystem-action-icon" viewBox="0 0 20 20">
      <path
        d="M2.5 5.6h4.5l1.4 1.7h8v7.8H2.5V5.6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
      <path
        d="M13.2 9.7v4.2M11.1 11.8h4.2"
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

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="fg-filesystem-action-icon" viewBox="0 0 20 20">
      <path
        d="m6 6 8 8M14 6l-8 8"
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
  persistentStorageMounts,
}: ConsoleFilesWorkbenchProps) {
  const cachedWorkbench = filesWorkbenchCache.get(appId) ?? null;
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const normalizedPersistentStorageMounts = normalizePersistentStorageMounts(
    persistentStorageMounts,
  );
  const sortedPersistentStorageMounts = [...normalizedPersistentStorageMounts].sort(
    (left, right) =>
      right.path.length - left.path.length || left.path.localeCompare(right.path),
  );
  const storageDirectoryMounts = sortedPersistentStorageMounts.filter(
    (
      mount,
    ): mount is NormalizedPersistentStorageMount & {
      kind: "directory";
    } => mount.kind === "directory",
  );
  const storageFileMounts = sortedPersistentStorageMounts.filter(
    (
      mount,
    ): mount is NormalizedPersistentStorageMount & {
      kind: "file";
    } => mount.kind === "file",
  );
  const storageMountEntries = buildPersistentStorageMountEntries(
    normalizedPersistentStorageMounts,
  );
  const storageMountSignature = readPersistentStorageMountSignature(
    normalizedPersistentStorageMounts,
  );
  const hasPersistentStorage = normalizedPersistentStorageMounts.length > 0;
  const initialRootMode: FilesystemRootMode =
    cachedWorkbench?.rootMode === "storage" && !hasPersistentStorage
      ? "filesystem"
      : (cachedWorkbench?.rootMode ??
        (hasPersistentStorage ? "storage" : "filesystem"));
  const initialRequestedRootPath =
    initialRootMode === "storage" ? PERSISTENT_STORAGE_COLLECTION_ROOT : "/";
  const canRestoreInitialState =
    cachedWorkbench !== null &&
    cachedWorkbench.requestedRootPath === initialRequestedRootPath &&
    (initialRequestedRootPath !== PERSISTENT_STORAGE_COLLECTION_ROOT ||
      cachedWorkbench.storageMountSignature === storageMountSignature);
  const [rootMode, setRootMode] = useState<FilesystemRootMode>(
    initialRootMode,
  );
  const [workspaceRoot, setWorkspaceRoot] = useState(() =>
    canRestoreInitialState
      ? cachedWorkbench!.workspaceRoot
      : initialRequestedRootPath,
  );
  const [directories, setDirectories] = useState<Record<string, DirectoryBucket>>(
    () =>
      canRestoreInitialState
        ? cachedWorkbench!.directories
        : initialRequestedRootPath === PERSISTENT_STORAGE_COLLECTION_ROOT
          ? {
              [PERSISTENT_STORAGE_COLLECTION_ROOT]: {
                entries: storageMountEntries,
                status: "ready",
              },
            }
          : {},
  );
  const [expandedPaths, setExpandedPaths] = useState<string[]>(
    () =>
      canRestoreInitialState
        ? cachedWorkbench!.expandedPaths
        : initialRequestedRootPath === PERSISTENT_STORAGE_COLLECTION_ROOT
          ? []
          : [initialRequestedRootPath],
  );
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(
    () =>
      canRestoreInitialState
        ? cachedWorkbench!.selectedNode
        : {
            kind: "dir",
            path: initialRequestedRootPath,
          },
  );
  const [fileDocuments, setFileDocuments] = useState<
    Record<string, FileDocument>
  >(() => (canRestoreInitialState ? cachedWorkbench!.fileDocuments : {}));
  const [composer, setComposer] = useState<ComposerState | null>(
    () => (canRestoreInitialState ? cachedWorkbench!.composer : null),
  );
  const [rootStatus, setRootStatus] = useState<
    "error" | "idle" | "loading" | "ready"
  >(() =>
    canRestoreInitialState
      ? cachedWorkbench!.rootStatus
      : initialRequestedRootPath === PERSISTENT_STORAGE_COLLECTION_ROOT
        ? "ready"
        : "loading",
  );
  const [busyAction, setBusyAction] = useState<"delete" | "refresh" | "save" | null>(null);
  const isStorageMode = rootMode === "storage";
  const requestedRootPath = isStorageMode
    ? PERSISTENT_STORAGE_COLLECTION_ROOT
    : "/";

  function readExactStorageMount(targetPath: string) {
    const cleanTarget = trimTrailingSlash(targetPath);

    return (
      normalizedPersistentStorageMounts.find(
        (mount) => trimTrailingSlash(mount.path) === cleanTarget,
      ) ?? null
    );
  }

  function readStorageDirectoryMountForPath(targetPath: string) {
    if (isPersistentStorageCollectionRoot(targetPath)) {
      return null;
    }

    return (
      storageDirectoryMounts.find((mount) => isPathWithin(mount.path, targetPath)) ??
      null
    );
  }

  function readStorageMountForPath(targetPath: string) {
    if (isPersistentStorageCollectionRoot(targetPath)) {
      return null;
    }

    const cleanTarget = trimTrailingSlash(targetPath);

    return (
      storageFileMounts.find(
        (mount) => trimTrailingSlash(mount.path) === cleanTarget,
      ) ??
      storageDirectoryMounts.find((mount) => isPathWithin(mount.path, targetPath)) ??
      null
    );
  }

  function readDirectoryChainWithinScope(targetDirectory: string) {
    if (!isStorageMode) {
      return directoryChain(targetDirectory, workspaceRoot);
    }

    if (isPersistentStorageCollectionRoot(targetDirectory)) {
      return [workspaceRoot];
    }

    const mount = readStorageDirectoryMountForPath(targetDirectory);

    if (!mount) {
      return [workspaceRoot];
    }

    const cleanMount = trimTrailingSlash(mount.path);
    const cleanTarget = trimTrailingSlash(targetDirectory);

    if (cleanTarget === cleanMount) {
      return [workspaceRoot, mount.path];
    }

    const relativePath = cleanTarget
      .slice(cleanMount.length)
      .replace(/^\/+/, "");
    const segments = relativePath.split("/").filter(Boolean);
    const chain = [workspaceRoot, mount.path];
    let currentPath = mount.path;

    for (const segment of segments) {
      currentPath = joinPath(currentPath, segment);
      chain.push(currentPath);
    }

    return chain;
  }

  function readParentDirectoryWithinScope(targetPath: string) {
    if (!isStorageMode) {
      return parentDirectory(targetPath, workspaceRoot);
    }

    if (isPersistentStorageCollectionRoot(targetPath)) {
      return workspaceRoot;
    }

    const exactMount = readExactStorageMount(targetPath);

    if (exactMount?.kind === "file") {
      return workspaceRoot;
    }

    const directoryMount = readStorageDirectoryMountForPath(targetPath);

    if (!directoryMount) {
      return workspaceRoot;
    }

    if (trimTrailingSlash(targetPath) === trimTrailingSlash(directoryMount.path)) {
      return workspaceRoot;
    }

    return parentDirectory(targetPath, directoryMount.path);
  }

  function ensurePathIsWithinCurrentScope(targetPath: string) {
    const normalizedPath = normalizeAbsolutePathInput(targetPath);

    if (!normalizedPath) {
      throw new Error("Path must be absolute.");
    }

    if (isStorageMode && !readStorageMountForPath(normalizedPath)) {
      throw new Error(
        "Path must stay inside persistent storage. Switch to Live filesystem to work outside it.",
      );
    }

    return normalizedPath;
  }

  function ensureDirectoryPathIsWithinCurrentScope(targetPath: string) {
    const normalizedPath = normalizeAbsolutePathInput(targetPath);

    if (!normalizedPath) {
      throw new Error("Path must be absolute.");
    }

    if (isStorageMode && !readStorageDirectoryMountForPath(normalizedPath)) {
      throw new Error(
        "Folders can only be created inside mounted persistent directories.",
      );
    }

    return normalizedPath;
  }

  function readWritableDirectory() {
    if (!isStorageMode) {
      if (composer) {
        return parentDirectory(composer.path, workspaceRoot);
      }

      if (!selectedNode) {
        return workspaceRoot;
      }

      return selectedNode.kind === "dir"
        ? selectedNode.path
        : parentDirectory(selectedNode.path, workspaceRoot);
    }

    if (composer) {
      const parentPath = readParentDirectoryWithinScope(composer.path);
      return isPersistentStorageCollectionRoot(parentPath) ? null : parentPath;
    }

    if (!selectedNode) {
      return null;
    }

    if (selectedNode.kind === "dir") {
      return isPersistentStorageCollectionRoot(selectedNode.path)
        ? null
        : (readStorageDirectoryMountForPath(selectedNode.path)?.path
            ? selectedNode.path
            : null);
    }

    const parentPath = readParentDirectoryWithinScope(selectedNode.path);
    return isPersistentStorageCollectionRoot(parentPath) ? null : parentPath;
  }

  function readRefreshTargetDirectory() {
    if (composer) {
      return readParentDirectoryWithinScope(composer.path);
    }

    if (!selectedNode) {
      return workspaceRoot;
    }

    return selectedNode.kind === "dir"
      ? selectedNode.path
      : readParentDirectoryWithinScope(selectedNode.path);
  }

  function readHighlightedPath() {
    if (composer) {
      return readParentDirectoryWithinScope(composer.path);
    }

    return selectedNode?.path ?? workspaceRoot;
  }

  const selectedFile =
    !composer && selectedNode?.kind === "file" ? fileDocuments[selectedNode.path] ?? null : null;
  const selectedDirectory =
    !composer && selectedNode?.kind === "dir" ? directories[selectedNode.path] ?? null : null;
  const writableDirectory = readWritableDirectory();
  const highlightedPath = readHighlightedPath();
  const selectedMountRoot =
    isStorageMode && selectedNode ? readExactStorageMount(selectedNode.path) : null;
  const canDeleteSelection =
    !composer &&
    selectedNode !== null &&
    selectedNode.path !== workspaceRoot &&
    !selectedMountRoot;
  const canCreateInsideCurrentScope = Boolean(writableDirectory);
  const rootModeOptions = FILESYSTEM_ROOT_MODE_OPTIONS.map((option) => ({
    ...option,
    label: (
      <span className="fg-filesystem__view-tab-label">{option.label}</span>
    ),
    disabled:
      Boolean(busyAction) ||
      Boolean(composer) ||
      (option.value === "storage" && !hasPersistentStorage),
  }));

  async function loadDirectory(
    targetPath: string,
    options?: {
      force?: boolean;
    },
  ) {
    if (isStorageMode && isPersistentStorageCollectionRoot(targetPath)) {
      const nextBucket = {
        entries: storageMountEntries,
        status: "ready",
      } satisfies DirectoryBucket;

      setDirectories((current) => ({
        ...current,
        [targetPath]: nextBucket,
      }));
      setRootStatus("ready");

      return nextBucket.entries;
    }

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
    try {
      const response = await requestJson<FilesystemTreeResponse>(
        `/api/fugue/apps/${appId}/filesystem/tree?${searchParams.toString()}`,
      );
      const resolvedPath = response.path?.trim() || targetPath;
      const entries = normalizeTreeEntries(response.entries ?? []);

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

      if (targetPath === workspaceRoot || resolvedPath === workspaceRoot) {
        setRootStatus("ready");
      }

      return {
        entries,
        path: resolvedPath,
        workspaceRoot,
      };
    } catch (error) {
      setDirectories((current) => ({
        ...current,
        [targetPath]: {
          entries: current[targetPath]?.entries ?? [],
          status: "error",
        },
      }));

      if (targetPath === workspaceRoot) {
        setRootStatus("error");
      }

      throw error;
    }
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
    try {
      const response = await requestJson<FilesystemFileResponse>(
        `/api/fugue/apps/${appId}/filesystem/file?${searchParams.toString()}`,
      );
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

      setFileDocuments((current) => {
        const next = { ...current };

        if (resolvedPath !== targetPath) {
          delete next[targetPath];
        }

        next[resolvedPath] = nextDocument;
        return next;
      });

      return nextDocument;
    } catch (error) {
      setFileDocuments((current) => ({
        ...current,
        [targetPath]: {
          content: current[targetPath]?.content ?? "",
          dirty: current[targetPath]?.dirty ?? false,
          encoding: current[targetPath]?.encoding ?? "utf-8",
          mode: current[targetPath]?.mode ?? "",
          modifiedAt: current[targetPath]?.modifiedAt ?? null,
          path: current[targetPath]?.path ?? targetPath,
          size: current[targetPath]?.size ?? null,
          status: "error",
          truncated: current[targetPath]?.truncated ?? false,
        },
      }));

      throw error;
    }
  }

  async function reloadDirectoryChain(targetDirectory: string) {
    const chain = readDirectoryChainWithinScope(targetDirectory);

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
    if (!hasPersistentStorage && rootMode !== "filesystem") {
      setRootMode("filesystem");
    }
  }, [hasPersistentStorage, rootMode]);

  useEffect(() => {
    let cancelled = false;
    const cachedState = filesWorkbenchCache.get(appId);
    const canRestoreCachedState =
      cachedState &&
      cachedState.requestedRootPath === requestedRootPath &&
      (requestedRootPath !== PERSISTENT_STORAGE_COLLECTION_ROOT ||
        cachedState.storageMountSignature === storageMountSignature);

    if (canRestoreCachedState && cachedState) {
      setWorkspaceRoot(cachedState.workspaceRoot);
      setDirectories(
        requestedRootPath === PERSISTENT_STORAGE_COLLECTION_ROOT
          ? {
              ...cachedState.directories,
              [requestedRootPath]: {
                entries: storageMountEntries,
                status: "ready",
              },
            }
          : cachedState.directories,
      );
      setExpandedPaths(cachedState.expandedPaths);
      setSelectedNode(cachedState.selectedNode);
      setFileDocuments(cachedState.fileDocuments);
      setComposer(cachedState.composer);
      setRootStatus(
        requestedRootPath === PERSISTENT_STORAGE_COLLECTION_ROOT
          ? "ready"
          : cachedState.rootStatus,
      );

      return () => {
        cancelled = true;
      };
    }

    setWorkspaceRoot(requestedRootPath);
    setFileDocuments({});
    setComposer(null);

    if (requestedRootPath === PERSISTENT_STORAGE_COLLECTION_ROOT) {
      setDirectories({
        [requestedRootPath]: {
          entries: storageMountEntries,
          status: "ready",
        },
      });
      setExpandedPaths([]);
      setSelectedNode({ kind: "dir", path: requestedRootPath });
      setRootStatus("ready");

      return () => {
        cancelled = true;
      };
    }

    setDirectories({});
    setExpandedPaths([requestedRootPath]);
    setSelectedNode({ kind: "dir", path: requestedRootPath });
    setRootStatus("loading");

    const searchParams = new URLSearchParams();
    searchParams.set("path", requestedRootPath);

    requestJson<FilesystemTreeResponse>(
      `/api/fugue/apps/${appId}/filesystem/tree?${searchParams.toString()}`,
    )
      .then((response) => {
        if (cancelled) {
          return;
        }

        const resolvedRoot = response.workspaceRoot?.trim() || requestedRootPath;
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
  }, [appId, requestedRootPath, showToast, storageMountSignature]);

  useEffect(() => {
    filesWorkbenchCache.set(appId, {
      composer,
      directories,
      expandedPaths,
      fileDocuments,
      requestedRootPath,
      rootMode,
      rootStatus,
      selectedNode,
      storageMountSignature,
      workspaceRoot,
    });
  }, [
    appId,
    composer,
    directories,
    expandedPaths,
    fileDocuments,
    requestedRootPath,
    rootMode,
    rootStatus,
    selectedNode,
    storageMountSignature,
    workspaceRoot,
  ]);

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
    if (!writableDirectory) {
      return;
    }

    setComposer({
      content: "",
      encoding: "utf-8",
      kind: "file",
      mkdirParents: true,
      mode: "",
      path: buildSuggestedFilePath(writableDirectory),
    });
  }

  function startNewDirectory() {
    if (!writableDirectory) {
      return;
    }

    setComposer({
      kind: "directory",
      mode: "",
      parents: true,
      path: buildSuggestedDirectoryPath(writableDirectory),
    });
  }

  function cancelComposer() {
    setComposer(null);
  }

  function updateComposerPath(nextPath: string) {
    setComposer((current) => (current ? { ...current, path: nextPath } : current));
  }

  async function handleRefresh() {
    if (busyAction) {
      return;
    }

    setBusyAction("refresh");

    try {
      const targetDirectory = readRefreshTargetDirectory();

      await reloadDirectoryChain(targetDirectory);

      if (selectedNode?.kind === "file") {
        await loadFile(selectedNode.path, { force: true });
      }

      showToast({
        message: isStorageMode ? "Persistent storage refreshed." : "Filesystem refreshed.",
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
    if (busyAction) {
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
        const nextPath = composer.path.trim();

        if (!nextPath) {
          throw new Error("Directory path is required.");
        }

        const requestPath = ensureDirectoryPathIsWithinCurrentScope(nextPath);

        const response = await requestJson<FilesystemMutationResponse>(
          `/api/fugue/apps/${appId}/filesystem/directory`,
          {
            body: JSON.stringify({
              ...(modeValue.value !== undefined ? { mode: modeValue.value } : {}),
              parents: composer.parents,
              path: requestPath,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );
        const targetPath = response.path?.trim() || requestPath;
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
        const nextPath = composer.path.trim();

        if (!nextPath) {
          throw new Error("File path is required.");
        }

        const requestPath = ensurePathIsWithinCurrentScope(nextPath);

        const response = await requestJson<FilesystemMutationResponse>(
          `/api/fugue/apps/${appId}/filesystem/file`,
          {
            body: JSON.stringify({
              content: composer.content,
              encoding: composer.encoding,
              mkdir_parents: composer.mkdirParents,
              ...(modeValue.value !== undefined ? { mode: modeValue.value } : {}),
              path: requestPath,
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "PUT",
          },
        );
        const targetPath = response.path?.trim() || requestPath;
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
        await reloadDirectoryChain(readParentDirectoryWithinScope(targetPath));
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
      await reloadDirectoryChain(readParentDirectoryWithinScope(selectedFile.path));
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
    if (busyAction) {
      return;
    }

    if (!selectedNode || selectedNode.path === workspaceRoot || selectedMountRoot) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: selectedNode.kind === "dir" ? "Delete folder" : "Delete file",
      description:
        selectedNode.kind === "dir"
          ? `${selectedNode.path} and everything inside it will be removed from ${appName}.`
          : `${selectedNode.path} will be removed from ${appName}.`,
      title: selectedNode.kind === "dir" ? "Delete folder?" : "Delete file?",
    });

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

      const nextSelectedPath = readParentDirectoryWithinScope(selectedNode.path);
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
                entry.hasChildren ? (
                  <span className="fg-filesystem-node__disclosure">
                    <ChevronIcon expanded={isExpanded} />
                  </span>
                ) : (
                  <span className="fg-filesystem-node__disclosure is-placeholder" />
                )
              ) : (
                <span className="fg-filesystem-node__disclosure is-placeholder" />
              )}
              {entry.kind === "dir" ? <FolderIcon open={isExpanded} /> : <FileIcon />}
            </span>
            <span className="fg-filesystem-node__label">{entry.name}</span>
          </button>

          {entry.kind === "dir" && isExpanded ? (
            <div className="fg-filesystem-node__children">{renderTree(entry.path, depth + 1)}</div>
          ) : null}
        </div>
      );
    });
  }

  const directoryEntries = selectedDirectory?.entries ?? [];
  const isSyntheticStorageRootSelected =
    isStorageMode &&
    selectedNode?.kind === "dir" &&
    isPersistentStorageCollectionRoot(selectedNode.path);
  const selectedDirectoryStatus =
    !composer && selectedNode?.kind === "dir"
      ? selectedDirectory?.status ?? (selectedNode.path === workspaceRoot ? rootStatus : "loading")
      : "idle";
  const showDirectoryPlaceholder =
    isSyntheticStorageRootSelected ||
    selectedDirectoryStatus === "loading" ||
    directoryEntries.length === 0;
  const directoryPlaceholderTitle = isSyntheticStorageRootSelected
    ? "Select a mounted file or directory"
    : selectedDirectoryStatus === "loading"
      ? "Loading folder"
      : "This folder is empty";
  const directoryPlaceholderCopy = isSyntheticStorageRootSelected
    ? "Choose a mounted path from the explorer to inspect or edit it."
    : selectedDirectoryStatus === "loading"
      ? "Fetching the current directory contents."
      : "Create a file or folder from the explorer toolbar.";
  const saveDisabled = Boolean(
    busyAction ||
      (
        composer
          ? !composer.path.trim()
          : !selectedFile || !selectedFile.dirty || selectedFile.status !== "ready" || selectedFile.truncated
      ),
  );
  const isSelectedFileLoading =
    !composer &&
    selectedNode?.kind === "file" &&
    (!selectedFile || selectedFile.status === "loading");

  return (
    <div className="fg-workbench-section">
      <div className="fg-filesystem-layout">
        <div
          className={cx(
            "fg-filesystem__topbar",
            !hasPersistentStorage && "is-toolbar-only",
          )}
        >
          {hasPersistentStorage ? (
            <div className="fg-filesystem__mode-slot">
              <SegmentedControl
                ariaLabel="Filesystem scope"
                className="fg-project-toolbar__panels-switch fg-filesystem__mode-switch"
                onChange={setRootMode}
                options={rootModeOptions}
                value={rootMode}
              />
            </div>
          ) : null}

          <div className="fg-filesystem__controls">
            {composer ? (
              <div className="fg-route-composer fg-filesystem__path-composer">
                <div className="fg-route-composer__shell">
                  <input
                    aria-label={composer.kind === "directory" ? "New folder path" : "New file path"}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    autoFocus
                    className="fg-route-composer__field"
                    inputMode="text"
                    onChange={(event) => {
                      updateComposerPath(event.target.value);
                    }}
                    spellCheck={false}
                    value={composer.path}
                  />
                </div>
              </div>
            ) : null}

            <div
              className="fg-filesystem__actions"
              role="toolbar"
              aria-label="Filesystem actions"
            >
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
                disabled={Boolean(busyAction) || Boolean(composer) || !canCreateInsideCurrentScope}
                icon={<FilePlusIcon />}
                onClick={startNewFile}
                size="compact"
                type="button"
                variant="secondary"
              >
                New file
              </Button>
              <Button
                disabled={Boolean(busyAction) || Boolean(composer) || !canCreateInsideCurrentScope}
                icon={<FolderPlusIcon />}
                onClick={startNewDirectory}
                size="compact"
                type="button"
                variant="secondary"
              >
                New folder
              </Button>
              {!composer && canDeleteSelection ? (
                <Button
                  disabled={Boolean(busyAction)}
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
              ) : null}
              {composer ? (
                <Button
                  disabled={Boolean(busyAction)}
                  icon={<CloseIcon />}
                  onClick={cancelComposer}
                  size="compact"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              ) : null}
              {composer || selectedNode?.kind === "file" ? (
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
              ) : null}
            </div>
          </div>
        </div>

        <div className="fg-filesystem-shell">
          <div className="fg-filesystem">
            <aside className="fg-filesystem__browser">
              <div className="fg-filesystem__tree">
                {rootStatus === "loading" && !directories[workspaceRoot]?.entries.length ? (
                  <div className="fg-filesystem-tree__placeholder">
                    <div className="fg-filesystem-tree__skeleton" />
                    <div className="fg-filesystem-tree__skeleton" />
                    <div className="fg-filesystem-tree__skeleton" />
                  </div>
                ) : null}

                {rootStatus === "error" ? (
                  <InlineAlert variant="error">
                    {isStorageMode
                      ? "Unable to load persistent storage."
                      : "Unable to load this filesystem root."}
                  </InlineAlert>
                ) : null}

                {renderTree(workspaceRoot, 0)}
              </div>
            </aside>

            <section className="fg-filesystem__editor">

            {composer?.kind === "directory" ? (
              <div className="fg-filesystem-editor">
                <details className="fg-filesystem-editor__advanced">
                  <summary>Options</summary>
                  <div className="fg-filesystem-editor__advanced-grid">
                    <input
                      aria-label="Folder mode"
                      className="fg-input"
                      id={`filesystem-dir-mode-${appId}`}
                      onChange={(event) =>
                        setComposer((current) =>
                          current?.kind === "directory"
                            ? { ...current, mode: event.target.value }
                            : current,
                        )
                      }
                      placeholder="Optional mode (493)"
                      spellCheck={false}
                      value={composer.mode}
                    />

                    <label className="fg-project-toggle fg-filesystem-editor__toggle">
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
                </details>

                <div className="fg-filesystem-editor__placeholder">
                  <p className="fg-filesystem-editor__placeholder-title">New folder</p>
                  <p className="fg-filesystem-editor__placeholder-copy">
                    Save to create this folder in the current scope.
                  </p>
                </div>
              </div>
            ) : null}

            {composer?.kind === "file" ? (
              <div className="fg-filesystem-editor fg-filesystem-editor--code">
                <details className="fg-filesystem-editor__advanced">
                  <summary>Options</summary>
                  <div className="fg-filesystem-editor__advanced-grid">
                    <input
                      aria-label="File mode"
                      className="fg-input"
                      id={`filesystem-file-mode-${appId}`}
                      onChange={(event) =>
                        setComposer((current) =>
                          current?.kind === "file"
                            ? { ...current, mode: event.target.value }
                            : current,
                        )
                      }
                      placeholder="Optional mode (420)"
                      spellCheck={false}
                      value={composer.mode}
                    />

                    <label className="fg-project-toggle fg-filesystem-editor__toggle">
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
                  </div>
                </details>

                <textarea
                  aria-label={`Draft editor for ${composer.path}`}
                  className="fg-project-textarea fg-filesystem-editor__textarea fg-filesystem-editor__textarea--code"
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
              </div>
            ) : null}

            {!composer && selectedNode?.kind === "dir" ? (
              <div className="fg-filesystem-editor">
                {selectedDirectory?.status === "error" ? (
                  <InlineAlert variant="error">Unable to load this folder. Try refreshing the current scope.</InlineAlert>
                ) : null}

                {selectedDirectory?.status !== "error" && showDirectoryPlaceholder ? (
                  <div className="fg-filesystem-editor__placeholder">
                    <p className="fg-filesystem-editor__placeholder-title">{directoryPlaceholderTitle}</p>
                    <p className="fg-filesystem-editor__placeholder-copy">{directoryPlaceholderCopy}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!composer && selectedNode?.kind === "file" ? (
              <div className="fg-filesystem-editor fg-filesystem-editor--code">
                {isSelectedFileLoading ? (
                  <div
                    aria-busy="true"
                    aria-label={`Loading ${basename(selectedNode.path)}`}
                    className="fg-console-loading fg-filesystem-loading"
                    role="status"
                  >
                    <div className="fg-filesystem-loading__body">
                      <span aria-hidden="true" className="fg-filesystem-loading__spinner" />
                      <p className="fg-filesystem-loading__label">Loading…</p>
                    </div>
                  </div>
                ) : null}

                {!isSelectedFileLoading && selectedFile?.status === "error" ? (
                  <InlineAlert variant="error">Unable to load this file. Refresh the current scope to try again.</InlineAlert>
                ) : null}

                {!isSelectedFileLoading && selectedFile?.encoding === "base64" ? (
                  <InlineAlert variant="info">
                    This file is shown as base64 because it is not valid utf-8 text.
                  </InlineAlert>
                ) : null}

                {!isSelectedFileLoading && selectedFile?.truncated ? (
                  <InlineAlert variant="error">
                    This preview was truncated at 1 MB. Save is disabled to avoid overwriting the file with partial content.
                  </InlineAlert>
                ) : null}

                {!isSelectedFileLoading ? (
                  <textarea
                    aria-label={`File editor for ${selectedNode.path}`}
                    className="fg-project-textarea fg-filesystem-editor__textarea fg-filesystem-editor__textarea--code"
                    onChange={(event) =>
                      updateSelectedFile({
                        content: event.target.value,
                      })
                    }
                    readOnly={selectedFile?.status !== "ready" || selectedFile?.truncated}
                    spellCheck={false}
                    value={selectedFile?.content ?? ""}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
        </div>
      </div>
    </div>
  );
}
