export type LocalUploadItem = {
  file: File;
  path: string;
  size: number;
};

export type LocalUploadState = {
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

  return {
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

  for (const item of localUpload.items) {
    formData.append("files", item.file, item.file.name);
    formData.append("paths", item.path);
  }

  return formData;
}

export function inspectLocalUploadState(localUpload: LocalUploadState) {
  const basenames = localUpload.items.map((item) =>
    readBasename(item.path).trim().toLowerCase(),
  );
  const hasCompose = basenames.some((name) => COMPOSE_FILE_NAMES.has(name));
  const hasFugueManifest = basenames.some((name) =>
    FUGUE_MANIFEST_FILE_NAMES.has(name),
  );

  return {
    hasCompose,
    hasDockerfile: basenames.some((name) => name === "dockerfile"),
    hasFugueManifest,
    hasTopologyDefinition: hasCompose || hasFugueManifest,
    itemCount: localUpload.items.length,
    previewPaths: localUpload.items.slice(0, 4).map((item) => item.path),
    totalBytes: localUpload.items.reduce((total, item) => total + item.size, 0),
  };
}
