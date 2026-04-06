import type { GitHubRepoVisibility } from "@/lib/github/repository";
import { normalizeGitHubRepoVisibility } from "@/lib/github/repository";

export type DeploySourceMode =
  | "repository"
  | "local-upload"
  | "docker-image";

export type DeploySearchState = {
  appName: string;
  branch: string;
  env: Record<string, string>;
  imageRef: string;
  repoVisibility: GitHubRepoVisibility;
  repositoryUrl: string;
  servicePort: string;
  sourceMode: DeploySourceMode;
};

type SearchParamRecord = Record<string, string | string[] | undefined>;
const DEPLOY_ENV_PARAM_PATTERN = /^env\[([^\]]+)\]$/;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readFirstNonEmptyParam(
  params: SearchParamRecord,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = readValue(params[key]);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizeDeploySourceMode(value?: string | null): DeploySourceMode {
  switch (value?.trim().toLowerCase()) {
    case "container-image":
    case "docker":
    case "docker-image":
    case "image":
      return "docker-image";
    case "local-upload":
      return "local-upload";
    case "repository":
    default:
      return "repository";
  }
}

function readDeployEnv(params: SearchParamRecord) {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    const match = key.match(DEPLOY_ENV_PARAM_PATTERN);

    if (!match) {
      continue;
    }

    const envKey = match[1]?.trim();
    const envValue = readValue(value);

    if (!envKey || typeof envValue !== "string") {
      continue;
    }

    env[envKey] = envValue;
  }

  return env;
}

export function readDeploySearchState(
  params: SearchParamRecord,
): DeploySearchState {
  return {
    appName: readFirstNonEmptyParam(params, ["name", "app-name", "appName"]),
    branch: readFirstNonEmptyParam(params, ["branch", "ref"]),
    env: readDeployEnv(params),
    imageRef: readFirstNonEmptyParam(params, [
      "image-ref",
      "imageRef",
      "image",
      "container-image",
    ]),
    repoVisibility:
      normalizeGitHubRepoVisibility(
        readFirstNonEmptyParam(params, ["repo-visibility", "repoVisibility"]),
      ) || "public",
    repositoryUrl: readFirstNonEmptyParam(params, [
      "repository-url",
      "repositoryUrl",
      "repoUrl",
    ]),
    servicePort: readFirstNonEmptyParam(params, [
      "service-port",
      "servicePort",
      "port",
    ]),
    sourceMode: normalizeDeploySourceMode(
      readFirstNonEmptyParam(params, ["source-mode", "sourceMode"]),
    ),
  };
}

export function buildDeployHref(
  pathname: string,
  search: Partial<DeploySearchState>,
) {
  const params = new URLSearchParams();

  if (search.appName?.trim()) {
    params.set("name", search.appName.trim());
  }

  if (search.repositoryUrl?.trim()) {
    params.set("repository-url", search.repositoryUrl.trim());
  }

  if (search.imageRef?.trim()) {
    params.set("image-ref", search.imageRef.trim());
  }

  if (search.branch?.trim()) {
    params.set("branch", search.branch.trim());
  }

  if (search.env) {
    for (const [key, value] of Object.entries(search.env).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const normalizedKey = key.trim();

      if (!normalizedKey) {
        continue;
      }

      params.set(`env[${normalizedKey}]`, value);
    }
  }

  if (search.servicePort?.trim()) {
    params.set("service-port", search.servicePort.trim());
  }

  if (search.repoVisibility && search.repoVisibility !== "public") {
    params.set("repo-visibility", search.repoVisibility);
  }

  if (search.sourceMode && search.sourceMode !== "repository") {
    params.set("source-mode", search.sourceMode);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
