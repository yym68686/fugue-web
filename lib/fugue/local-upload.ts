export type LocalUploadItem = {
  file: File;
  path: string;
  size: number;
};

export type LocalUploadArchive = {
  contentType: string;
  file: File;
  name: string;
  size: number;
};

export type LocalUploadState =
  | {
      kind: "archive";
      archive: LocalUploadArchive;
      label: string | null;
    }
  | {
      kind: "files";
      items: LocalUploadItem[];
      label: string | null;
    };

export type LocalUploadInspection = {
  archiveFormat: "zip" | "tarball" | null;
  archiveName: string | null;
  hasArchive: boolean;
  hasCompose: boolean;
  hasDockerfile: boolean;
  hasFugueManifest: boolean;
  hasTopologyDefinition: boolean;
  itemCount: number;
  mode: "archive" | "files";
  previewPaths: string[];
  totalBytes: number;
};

const COMPOSE_FILE_NAMES = new Set([
  "compose.yaml",
  "compose.yml",
  "docker-compose.yaml",
  "docker-compose.yml",
]);

const FUGUE_MANIFEST_FILE_NAMES = new Set(["fugue.yaml", "fugue.yml"]);
const LOCAL_UPLOAD_PREVIEW_PATH_LIMIT = 4;
const localUploadInspectionCache = new WeakMap<
  LocalUploadState,
  LocalUploadInspection
>();

function isSupportedLocalUploadArchivePath(path: string) {
  const normalized = readBasename(path).trim().toLowerCase();

  return (
    normalized.endsWith(".zip") ||
    normalized.endsWith(".tgz") ||
    normalized.endsWith(".tar.gz")
  );
}

function stripArchiveExtension(value: string) {
  return value
    .replace(/\.tar\.gz$/i, "")
    .replace(/\.tgz$/i, "")
    .replace(/\.zip$/i, "")
    .replace(/\.[^.]+$/u, "");
}

function inferLocalUploadArchiveContentType(file: File, path: string) {
  const contentType = file.type.trim();

  if (contentType) {
    return contentType;
  }

  const normalized = path.trim().toLowerCase();

  if (normalized.endsWith(".zip")) {
    return "application/zip";
  }

  if (normalized.endsWith(".tgz") || normalized.endsWith(".tar.gz")) {
    return "application/gzip";
  }

  return "application/octet-stream";
}

function normalizeLocalUploadPath(value: string) {
  const sanitized = value.replace(/\\/g, "/").trim();

  if (!sanitized) {
    return "";
  }

  const segments = sanitized
    .replace(/^\/+/, "")
    .replace(/^\.\//, "")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..");

  return segments.join("/");
}

function readBasename(path: string) {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
}

function inferLocalUploadLabel(
  items: LocalUploadItem[],
  label?: string | null,
) {
  const normalizedLabel = label?.trim();

  if (normalizedLabel) {
    return normalizedLabel;
  }

  let sharedTopLevelFolder: string | null = null;

  for (const item of items) {
    const segments = item.path.split("/");
    const [firstSegment] = segments;

    if (!firstSegment || segments.length < 2) {
      sharedTopLevelFolder = null;
      break;
    }

    if (sharedTopLevelFolder === null) {
      sharedTopLevelFolder = firstSegment;
      continue;
    }

    if (sharedTopLevelFolder !== firstSegment) {
      sharedTopLevelFolder = null;
      break;
    }
  }

  return sharedTopLevelFolder || (items[0] ? readBasename(items[0].path) : null);
}

export function createLocalUploadState(): LocalUploadState {
  return {
    kind: "files",
    items: [],
    label: null,
  };
}

export function normalizeLocalUploadItems(
  entries: Iterable<{ file: File; path: string }>,
  label?: string | null,
): LocalUploadState {
  const deduped = new Map<string, LocalUploadItem>();

  for (const entry of entries) {
    const path = normalizeLocalUploadPath(entry.path);

    if (!path) {
      continue;
    }

    deduped.set(path, {
      file: entry.file,
      path,
      size: entry.file.size,
    });
  }

  // Preserve the browser-provided order so large folder selections do not pay
  // an extra O(n log n) sort on the main thread before we even render feedback.
  const items = Array.from(deduped.values());

  if (items.length === 1 && isSupportedLocalUploadArchivePath(items[0].path)) {
    const [archiveItem] = items;

    return {
      kind: "archive",
      archive: {
        contentType: inferLocalUploadArchiveContentType(
          archiveItem.file,
          archiveItem.path,
        ),
        file: archiveItem.file,
        name: readBasename(archiveItem.path),
        size: archiveItem.size,
      },
      label:
        label?.trim() ||
        stripArchiveExtension(readBasename(archiveItem.path)) ||
        null,
    };
  }

  return {
    kind: "files",
    items,
    label: inferLocalUploadLabel(items, label),
  };
}

export function buildLocalUploadFormData(
  payload: Record<string, unknown>,
  localUpload: LocalUploadState,
) {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));

  if (localUpload.label?.trim()) {
    formData.set("label", localUpload.label.trim());
  }

  if (localUpload.kind === "archive") {
    formData.set("archive", localUpload.archive.file, localUpload.archive.name);
    return formData;
  }

  for (const item of localUpload.items) {
    formData.append("files", item.file, item.file.name);
    formData.append("paths", item.path);
  }

  return formData;
}

export function inspectLocalUploadState(
  localUpload: LocalUploadState,
): LocalUploadInspection {
  const cached = localUploadInspectionCache.get(localUpload);

  if (cached) {
    return cached;
  }

  if (localUpload.kind === "archive") {
    const archiveName = localUpload.archive.name.trim();
    const normalized = archiveName.toLowerCase();
    const inspection: LocalUploadInspection = {
      archiveFormat:
        normalized.endsWith(".zip") ? "zip" : "tarball",
      archiveName,
      hasArchive: true,
      hasCompose: false,
      hasDockerfile: false,
      hasFugueManifest: false,
      hasTopologyDefinition: false,
      itemCount: 1,
      mode: "archive",
      previewPaths: archiveName ? [archiveName] : [],
      totalBytes: localUpload.archive.size,
    };

    localUploadInspectionCache.set(localUpload, inspection);
    return inspection;
  }

  const previewPaths: string[] = [];
  let hasCompose = false;
  let hasDockerfile = false;
  let hasFugueManifest = false;
  let totalBytes = 0;

  for (const item of localUpload.items) {
    totalBytes += item.size;

    if (previewPaths.length < LOCAL_UPLOAD_PREVIEW_PATH_LIMIT) {
      previewPaths.push(item.path);
    }

    if (hasCompose && hasDockerfile && hasFugueManifest) {
      continue;
    }

    const basename = readBasename(item.path).trim().toLowerCase();

    if (!hasCompose && COMPOSE_FILE_NAMES.has(basename)) {
      hasCompose = true;
    }

    if (!hasFugueManifest && FUGUE_MANIFEST_FILE_NAMES.has(basename)) {
      hasFugueManifest = true;
    }

    if (!hasDockerfile && basename === "dockerfile") {
      hasDockerfile = true;
    }
  }

  const inspection: LocalUploadInspection = {
    archiveFormat: null,
    archiveName: null,
    hasArchive: false,
    hasCompose,
    hasDockerfile,
    hasFugueManifest,
    hasTopologyDefinition: hasCompose || hasFugueManifest,
    itemCount: localUpload.items.length,
    mode: "files",
    previewPaths,
    totalBytes,
  };

  localUploadInspectionCache.set(localUpload, inspection);
  return inspection;
}

export function hasLocalUploadSelection(localUpload: LocalUploadState | null | undefined) {
  if (!localUpload) {
    return false;
  }

  return localUpload.kind === "archive" || localUpload.items.length > 0;
}
