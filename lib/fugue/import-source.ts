import type { GitHubRepoVisibility } from "@/lib/github/repository";
import type { LocalUploadState } from "@/lib/fugue/local-upload";
import { PRIVATE_GITHUB_AUTH_REQUIRED_MESSAGE } from "@/lib/github/messages";

export type ImportSourceMode = "github" | "docker-image" | "local-upload";

export const BUILD_STRATEGY_OPTIONS = [
  { label: "Auto detect", value: "auto" },
  { label: "Static site", value: "static-site" },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "Buildpacks", value: "buildpacks" },
  { label: "Nixpacks", value: "nixpacks" },
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
  imageRef: string;
  name: string;
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

export function createImportServiceDraft(
  runtimeId: string | null = null,
): ImportServiceDraft {
  return {
    branch: "",
    buildContextDir: "",
    buildStrategy: "auto",
    dockerfilePath: "",
    imageRef: "",
    name: "",
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
    localUpload?: LocalUploadState | null;
    privateGitHubAuthorized?: boolean;
  },
) {
  if (draft.sourceMode === "github") {
    if (!draft.repoUrl.trim()) {
      return "Repository link is required.";
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
    return "Image reference is required.";
  }

  if (
    draft.sourceMode === "local-upload" &&
    !options?.localUpload?.items.length
  ) {
    return "Choose a folder, docker-compose.yml, Dockerfile, or source files to upload.";
  }

  const normalizedServicePort = draft.servicePort.trim();

  if (
    normalizedServicePort &&
    (!/^\d+$/.test(normalizedServicePort) || Number(normalizedServicePort) <= 0)
  ) {
    return "Service port must be a positive integer.";
  }

  return null;
}

export function buildImportServicePayload(draft: ImportServiceDraft) {
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

  if (normalizedServicePort) {
    payload.servicePort = normalizedServicePort;
  }

  if (draft.startupCommand.trim()) {
    payload.startupCommand = draft.startupCommand.trim();
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
