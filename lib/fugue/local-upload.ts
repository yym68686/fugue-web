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

const COMPOSE_FILE_NAMES = new Set([
  "compose.yaml",
  "compose.yml",
  "docker-compose.yaml",
  "docker-compose.yml",
]);

const FUGUE_MANIFEST_FILE_NAMES = new Set(["fugue.yaml", "fugue.yml"]);

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

function readCommonTopLevelFolder(paths: string[]) {
  if (!paths.length) {
    return null;
  }

  const [firstPath] = paths;
  const [firstSegment] = firstPath.split("/");

  if (!firstSegment) {
    return null;
  }

  if (
    paths.some((path) => {
      const segments = path.split("/");
      return segments.length < 2 || segments[0] !== firstSegment;
    })
  ) {
    return null;
  }

  return firstSegment;
}

function readBasename(path: string) {
  const segments = path.split("/");
  return segments[segments.length - 1] ?? path;
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

  const items = Array.from(deduped.values()).sort((left, right) =>
    left.path.localeCompare(right.path),
  );

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
    label:
      label?.trim() ||
      readCommonTopLevelFolder(items.map((item) => item.path)) ||
      (items[0] ? readBasename(items[0].path) : null),
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

export function inspectLocalUploadState(localUpload: LocalUploadState) {
  if (localUpload.kind === "archive") {
    const archiveName = localUpload.archive.name.trim();
    const normalized = archiveName.toLowerCase();

    return {
      archiveFormat:
        normalized.endsWith(".zip") ? "zip" : "tarball",
      archiveName,
      hasArchive: true,
      hasCompose: false,
      hasDockerfile: false,
      hasFugueManifest: false,
      hasTopologyDefinition: false,
      itemCount: 1,
      mode: "archive" as const,
      previewPaths: archiveName ? [archiveName] : [],
      totalBytes: localUpload.archive.size,
    };
  }

  const basenames = localUpload.items.map((item) =>
    readBasename(item.path).trim().toLowerCase(),
  );
  const hasCompose = basenames.some((name) => COMPOSE_FILE_NAMES.has(name));
  const hasFugueManifest = basenames.some((name) =>
    FUGUE_MANIFEST_FILE_NAMES.has(name),
  );

  return {
    archiveFormat: null,
    archiveName: null,
    hasArchive: false,
    hasCompose,
    hasDockerfile: basenames.some((name) => name === "dockerfile"),
    hasFugueManifest,
    hasTopologyDefinition: hasCompose || hasFugueManifest,
    itemCount: localUpload.items.length,
    mode: "files" as const,
    previewPaths: localUpload.items.slice(0, 4).map((item) => item.path),
    totalBytes: localUpload.items.reduce((total, item) => total + item.size, 0),
  };
}

export function hasLocalUploadSelection(localUpload: LocalUploadState | null | undefined) {
  if (!localUpload) {
    return false;
  }

  return localUpload.kind === "archive" || localUpload.items.length > 0;
}
