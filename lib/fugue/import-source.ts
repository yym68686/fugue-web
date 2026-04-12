import type { GitHubRepoVisibility } from "@/lib/github/repository";
import type { LocalUploadState } from "@/lib/fugue/local-upload";
import { hasLocalUploadSelection } from "@/lib/fugue/local-upload";
import {
  createPersistentStorageDraft,
  hasPersistentStorageDraft,
  serializePersistentStorageDraft,
  validatePersistentStorageDraft,
  type PersistentStorageMountDraft,
} from "@/lib/fugue/persistent-storage";
import { PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE } from "@/lib/github/messages";
import {
  buildRawEnvFeedback,
  type RawEnvFeedback,
} from "@/lib/console/raw-env";
import { translate, type Locale } from "@/lib/i18n/core";

export type ImportSourceMode = "github" | "docker-image" | "local-upload";
export type ImportNetworkMode = "background" | "public";

export const BUILD_STRATEGY_OPTIONS = [
  { label: "Auto detect", value: "auto" },
  { label: "Static site", value: "static-site" },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "Buildpacks", value: "buildpacks" },
  { label: "Nixpacks", value: "nixpacks" },
] as const;

export const IMPORT_NETWORK_MODE_OPTIONS = [
  { label: "Public service", value: "public" },
  { label: "Background worker", value: "background" },
] as const;

export type BuildStrategyValue =
  (typeof BUILD_STRATEGY_OPTIONS)[number]["value"];

export type PersistentStorageSeedFileDraft = {
  path: string;
  seedContent: string;
  service: string;
};

export type ImportServiceDraft = {
  branch: string;
  buildContextDir: string;
  buildStrategy: BuildStrategyValue;
  dockerfilePath: string;
  envRaw: string;
  imageRef: string;
  name: string;
  networkMode: ImportNetworkMode;
  persistentStorage: PersistentStorageMountDraft[];
  persistentStorageSeedFiles: PersistentStorageSeedFileDraft[];
  repoAuthToken: string;
  repoUrl: string;
  repoVisibility: GitHubRepoVisibility;
  runtimeId: string | null;
  servicePort: string;
  startupCommand: string;
  sourceDir: string;
  sourceMode: ImportSourceMode;
};

export function normalizeImportSourceMode(
  value?: string | null,
): ImportSourceMode | "" {
  switch (value?.trim().toLowerCase()) {
    case "github":
      return "github";
    case "docker-image":
      return "docker-image";
    case "local-upload":
      return "local-upload";
    default:
      return "";
  }
}

export function normalizeImportNetworkMode(
  value?: string | null,
): ImportNetworkMode | "" {
  switch (value?.trim().toLowerCase()) {
    case "public":
      return "public";
    case "background":
      return "background";
    default:
      return "";
  }
}

export function createImportServiceDraft(
  runtimeId: string | null = null,
): ImportServiceDraft {
  return {
    branch: "",
    buildContextDir: "",
    buildStrategy: "auto",
    dockerfilePath: "",
    envRaw: "",
    imageRef: "",
    name: "",
    networkMode: "public",
    persistentStorage: createPersistentStorageDraft(),
    persistentStorageSeedFiles: [],
    repoAuthToken: "",
    repoUrl: "",
    repoVisibility: "public",
    runtimeId,
    servicePort: "",
    startupCommand: "",
    sourceDir: "",
    sourceMode: "github",
  };
}

export function supportsGitHubSourceDir(buildStrategy: BuildStrategyValue) {
  return (
    buildStrategy === "auto" ||
    buildStrategy === "static-site" ||
    buildStrategy === "buildpacks" ||
    buildStrategy === "nixpacks"
  );
}

export function supportsGitHubDockerInputs(buildStrategy: BuildStrategyValue) {
  return buildStrategy === "auto" || buildStrategy === "dockerfile";
}

export function preservesGitHubTopologyImport(value: {
  buildContextDir?: string | null;
  buildStrategy?: string | null;
  dockerfilePath?: string | null;
  sourceDir?: string | null;
}) {
  const buildStrategy = value.buildStrategy?.trim() ?? "";

  return (
    (!buildStrategy || buildStrategy === "auto") &&
    !value.sourceDir?.trim() &&
    !value.dockerfilePath?.trim() &&
    !value.buildContextDir?.trim()
  );
}

export function localUploadPreservesDetectedTopology(
  draft: ImportServiceDraft,
) {
  return (
    draft.buildStrategy === "auto" &&
    !draft.sourceDir.trim() &&
    !draft.dockerfilePath.trim() &&
    !draft.buildContextDir.trim()
  );
}

export function validateImportServiceDraft(
  draft: ImportServiceDraft,
  options?: {
    environmentFeedback?: Pick<RawEnvFeedback, "message" | "valid"> | null;
    localUpload?: LocalUploadState | null;
    locale?: Locale;
    persistentStorageSupported?: boolean;
    privateGitHubAuthorized?: boolean;
  },
) {
  const locale = options?.locale ?? "en";

  if (draft.sourceMode === "github") {
    if (!draft.repoUrl.trim()) {
      return translate(locale, "Repository link is required.");
    }

    if (
      draft.repoVisibility === "private" &&
      !draft.repoAuthToken.trim() &&
      !options?.privateGitHubAuthorized
    ) {
      return PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE;
    }
  }

  if (draft.sourceMode === "docker-image" && !draft.imageRef.trim()) {
    return translate(locale, "Image reference is required.");
  }

  if (
    draft.sourceMode === "local-upload" &&
    !hasLocalUploadSelection(options?.localUpload)
  ) {
    return translate(
      locale,
      "Choose a folder, a .zip or .tgz archive, docker-compose.yml, Dockerfile, or source files to upload.",
    );
  }

  const normalizedServicePort = draft.servicePort.trim();

  if (
    draft.networkMode !== "background" &&
    normalizedServicePort &&
    (!/^\d+$/.test(normalizedServicePort) || Number(normalizedServicePort) <= 0)
  ) {
    return translate(locale, "Service port must be a positive integer.");
  }

  if (options?.persistentStorageSupported !== false) {
    const persistentStorageError = validatePersistentStorageDraft(
      draft.persistentStorage,
    );

    if (persistentStorageError) {
      return persistentStorageError;
    }
  }

  if (options?.environmentFeedback && !options.environmentFeedback.valid) {
    return options.environmentFeedback.message;
  }

  const envFeedback = buildRawEnvFeedback(draft.envRaw, "console", locale);

  if (!envFeedback.valid) {
    return envFeedback.message;
  }

  return null;
}

export function buildImportServicePayload(
  draft: ImportServiceDraft,
  options?: {
    includePersistentStorage?: boolean;
    locale?: Locale;
  },
) {
  const payload: Record<string, unknown> = {
    sourceMode: draft.sourceMode,
  };

  const normalizedName = draft.name.trim();
  const normalizedServicePort = draft.servicePort.trim();

  if (draft.runtimeId) {
    payload.runtimeId = draft.runtimeId;
  }

  if (normalizedName) {
    payload.name = normalizedName;
  }

  if (draft.networkMode === "background") {
    payload.networkMode = "background";
  }

  if (draft.networkMode !== "background" && normalizedServicePort) {
    payload.servicePort = normalizedServicePort;
  }

  if (draft.startupCommand.trim()) {
    payload.startupCommand = draft.startupCommand.trim();
  }

  const envFeedback = buildRawEnvFeedback(
    draft.envRaw,
    "console",
    options?.locale ?? "en",
  );

  if (envFeedback.valid && Object.keys(envFeedback.env).length > 0) {
    payload.env = envFeedback.env;
  }

  if (options?.includePersistentStorage !== false) {
    const persistentStorage = serializePersistentStorageDraft(
      draft.persistentStorage,
    );

    if (persistentStorage) {
      payload.persistentStorage = persistentStorage;
    }
  }

  if (draft.sourceMode === "github") {
    payload.repoUrl = draft.repoUrl.trim();
    payload.repoVisibility = draft.repoVisibility;
    payload.buildStrategy = draft.buildStrategy;

    if (draft.branch.trim()) {
      payload.branch = draft.branch.trim();
    }

    if (draft.repoVisibility === "private" && draft.repoAuthToken.trim()) {
      payload.repoAuthToken = draft.repoAuthToken.trim();
    }

    if (draft.sourceDir.trim()) {
      payload.sourceDir = draft.sourceDir.trim();
    }

    if (draft.dockerfilePath.trim()) {
      payload.dockerfilePath = draft.dockerfilePath.trim();
    }

    if (draft.buildContextDir.trim()) {
      payload.buildContextDir = draft.buildContextDir.trim();
    }

    if (preservesGitHubTopologyImport(draft)) {
      const persistentStorageSeedFiles =
        draft.persistentStorageSeedFiles.flatMap((file) => {
          const service = file.service.trim();
          const path = file.path.trim();

          if (!service || !path) {
            return [];
          }

          return [
            {
              path,
              seedContent: file.seedContent,
              service,
            },
          ];
        });

      if (persistentStorageSeedFiles.length > 0) {
        payload.persistentStorageSeedFiles = persistentStorageSeedFiles;
      }
    }

    return payload;
  }

  if (draft.sourceMode === "local-upload") {
    payload.buildStrategy = draft.buildStrategy;

    if (draft.sourceDir.trim()) {
      payload.sourceDir = draft.sourceDir.trim();
    }

    if (draft.dockerfilePath.trim()) {
      payload.dockerfilePath = draft.dockerfilePath.trim();
    }

    if (draft.buildContextDir.trim()) {
      payload.buildContextDir = draft.buildContextDir.trim();
    }

    return payload;
  }

  payload.imageRef = draft.imageRef.trim();
  return payload;
}

export function importDraftHasPersistentStorage(draft: ImportServiceDraft) {
  return hasPersistentStorageDraft(draft.persistentStorage);
}
