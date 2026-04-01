import type { GitHubRepoVisibility } from "@/lib/github/repository";

export type ImportSourceMode = "github" | "docker-image";

export const BUILD_STRATEGY_OPTIONS = [
  { label: "Auto detect", value: "auto" },
  { label: "Static site", value: "static-site" },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "Buildpacks", value: "buildpacks" },
  { label: "Nixpacks", value: "nixpacks" },
] as const;

export type BuildStrategyValue = (typeof BUILD_STRATEGY_OPTIONS)[number]["value"];

export type ImportServiceDraft = {
  branch: string;
  buildContextDir: string;
  buildStrategy: BuildStrategyValue;
  dockerfilePath: string;
  imageRef: string;
  name: string;
  repoAuthToken: string;
  repoUrl: string;
  repoVisibility: GitHubRepoVisibility;
  runtimeId: string | null;
  servicePort: string;
  sourceDir: string;
  sourceMode: ImportSourceMode;
};

export function normalizeImportSourceMode(value?: string | null): ImportSourceMode | "" {
  switch (value?.trim().toLowerCase()) {
    case "github":
      return "github";
    case "docker-image":
      return "docker-image";
    default:
      return "";
  }
}

export function createImportServiceDraft(runtimeId: string | null = null): ImportServiceDraft {
  return {
    branch: "",
    buildContextDir: "",
    buildStrategy: "auto",
    dockerfilePath: "",
    imageRef: "",
    name: "",
    repoAuthToken: "",
    repoUrl: "",
    repoVisibility: "public",
    runtimeId,
    servicePort: "",
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

export function validateImportServiceDraft(draft: ImportServiceDraft) {
  if (draft.sourceMode === "github") {
    if (!draft.repoUrl.trim()) {
      return "Repository link is required.";
    }

    if (draft.repoVisibility === "private" && !draft.repoAuthToken.trim()) {
      return "Private GitHub repositories require a GitHub token.";
    }
  }

  if (draft.sourceMode === "docker-image" && !draft.imageRef.trim()) {
    return "Image reference is required.";
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
  const payload: Record<string, string> = {
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

    return payload;
  }

  payload.imageRef = draft.imageRef.trim();
  return payload;
}
