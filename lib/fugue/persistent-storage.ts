export type PersistentStorageMountKind = "directory" | "file";

export type PersistentStorageMountDraft = {
  id: string;
  kind: PersistentStorageMountKind;
  mode: number | null;
  path: string;
  secret: boolean;
  seedContent: string;
};

export type PersistentStoragePayloadMount = {
  kind: PersistentStorageMountKind;
  mode?: number;
  path: string;
  secret?: boolean;
  seedContent?: string;
};

export type PersistentStoragePayload = {
  mounts: PersistentStoragePayloadMount[];
};

let mountDraftIdCounter = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nextMountDraftId() {
  mountDraftIdCounter += 1;
  return `persistent-storage-mount-${mountDraftIdCounter}`;
}

function normalizeMountKind(raw: unknown): PersistentStorageMountKind {
  return typeof raw === "string" && raw.trim().toLowerCase() === "file"
    ? "file"
    : "directory";
}

function readOptionalMode(raw: unknown) {
  return typeof raw === "number" &&
    Number.isInteger(raw) &&
    Number.isFinite(raw) &&
    raw >= 0
    ? raw
    : null;
}

function countMountKinds(value: PersistentStorageMountDraft[]) {
  let directoryCount = 0;
  let fileCount = 0;

  for (const mount of value) {
    if (mount.kind === "file") {
      fileCount += 1;
    } else {
      directoryCount += 1;
    }
  }

  return {
    directoryCount,
    fileCount,
  };
}

export function createPersistentStorageMountDraft(
  kind: PersistentStorageMountKind = "directory",
): PersistentStorageMountDraft {
  return {
    id: nextMountDraftId(),
    kind,
    mode: null,
    path: "",
    secret: false,
    seedContent: "",
  };
}

export function createPersistentStorageDraft() {
  return [] as PersistentStorageMountDraft[];
}

export function readPersistentStorageDraft(
  value?:
    | {
        mounts?:
          | Array<{
              kind?: string | null;
              mode?: number | null;
              path?: string | null;
              secret?: boolean | null;
              seedContent?: string | null;
            } | null>
          | null;
      }
    | null,
) {
  return (value?.mounts ?? []).flatMap((mount) => {
    if (!mount) {
      return [];
    }

    return [
      {
        id: nextMountDraftId(),
        kind: normalizeMountKind(mount.kind),
        mode: readOptionalMode(mount.mode),
        path: mount.path?.trim() ?? "",
        secret: mount.secret === true,
        seedContent: mount.seedContent ?? "",
      } satisfies PersistentStorageMountDraft,
    ];
  });
}

export function persistentStorageDraftEqual(
  left: PersistentStorageMountDraft[],
  right: PersistentStorageMountDraft[],
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((mount, index) => {
    const candidate = right[index];

    return (
      candidate?.kind === mount.kind &&
      candidate?.mode === mount.mode &&
      candidate?.path === mount.path &&
      candidate?.secret === mount.secret &&
      candidate?.seedContent === mount.seedContent
    );
  });
}

export function hasPersistentStorageDraft(value: PersistentStorageMountDraft[]) {
  return value.length > 0;
}

export function summarizePersistentStorageDraft(
  value: PersistentStorageMountDraft[],
) {
  if (value.length === 0) {
    return null;
  }

  if (value.length === 1) {
    const mount = value[0];
    const normalizedPath = mount?.path.trim();
    const kindLabel = mount?.kind === "file" ? "File" : "Directory";

    if (normalizedPath) {
      return `${kindLabel} · ${normalizedPath}`;
    }

    return `${kindLabel} mount`;
  }

  const { directoryCount, fileCount } = countMountKinds(value);
  const parts = [
    directoryCount > 0
      ? `${directoryCount} ${directoryCount === 1 ? "directory" : "directories"}`
      : null,
    fileCount > 0 ? `${fileCount} ${fileCount === 1 ? "file" : "files"}` : null,
  ].filter((part): part is string => Boolean(part));

  return `${value.length} ${value.length === 1 ? "mount" : "mounts"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
}

export function validatePersistentStorageDraft(
  value: PersistentStorageMountDraft[],
) {
  for (const [index, mount] of value.entries()) {
    const path = mount.path.trim();

    if (!path) {
      return `Persistent storage mount ${index + 1} is missing a path.`;
    }

    if (!path.startsWith("/")) {
      return `Persistent storage mount ${index + 1} must use an absolute path.`;
    }

    if (mount.kind === "file" && path.endsWith("/")) {
      return `Persistent storage file mount ${index + 1} must point to a file.`;
    }
  }

  return null;
}

export function serializePersistentStorageDraft(
  value: PersistentStorageMountDraft[],
  options?: {
    preserveEmpty?: boolean;
  },
) {
  if (value.length === 0) {
    return options?.preserveEmpty ? ({ mounts: [] } satisfies PersistentStoragePayload) : undefined;
  }

  return {
    mounts: value.map((mount) => ({
      kind: mount.kind,
      ...(mount.mode !== null ? { mode: mount.mode } : {}),
      path: mount.path.trim(),
      ...(mount.secret ? { secret: true } : {}),
      ...(mount.kind === "file" ? { seedContent: mount.seedContent } : {}),
    })),
  } satisfies PersistentStoragePayload;
}

export function readPersistentStorageInput(
  value: unknown,
): PersistentStoragePayload | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return {
      mounts: [],
    };
  }

  if (!isRecord(value)) {
    throw new Error("Persistent storage must be an object.");
  }

  const mountsValue = value.mounts;

  if (mountsValue === undefined || mountsValue === null) {
    return {
      mounts: [],
    };
  }

  if (!Array.isArray(mountsValue)) {
    throw new Error("Persistent storage mounts must be an array.");
  }

  return {
    mounts: mountsValue.map((entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(
          `Persistent storage mount ${index + 1} must be an object.`,
        );
      }

      const kind = normalizeMountKind(entry.kind);
      const path = typeof entry.path === "string" ? entry.path.trim() : "";
      const secret =
        entry.secret === undefined
          ? undefined
          : typeof entry.secret === "boolean"
            ? entry.secret
            : null;
      const seedContent =
        entry.seedContent === undefined
          ? ""
          : typeof entry.seedContent === "string"
            ? entry.seedContent
            : null;
      const mode =
        entry.mode === undefined
          ? undefined
          : typeof entry.mode === "number" &&
              Number.isInteger(entry.mode) &&
              Number.isFinite(entry.mode) &&
              entry.mode >= 0
            ? entry.mode
            : null;

      if (!path) {
        throw new Error(
          `Persistent storage mount ${index + 1} is missing a path.`,
        );
      }

      if (secret === null) {
        throw new Error(
          `Persistent storage mount ${index + 1} must use a boolean secret flag.`,
        );
      }

      if (seedContent === null) {
        throw new Error(
          `Persistent storage mount ${index + 1} must use text seed content.`,
        );
      }

      if (mode === null) {
        throw new Error(
          `Persistent storage mount ${index + 1} must use a whole-number mode.`,
        );
      }

      return {
        kind,
        ...(mode !== undefined ? { mode } : {}),
        path,
        ...(secret ? { secret: true } : {}),
        ...(kind === "file" ? { seedContent } : {}),
      } satisfies PersistentStoragePayloadMount;
    }),
  };
}
