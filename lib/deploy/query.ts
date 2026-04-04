import type { GitHubRepoVisibility } from "@/lib/github/repository";
import { normalizeGitHubRepoVisibility } from "@/lib/github/repository";

export type DeploySourceMode = "repository" | "local-upload";

export type DeploySearchState = {
  branch: string;
  repoVisibility: GitHubRepoVisibility;
  repositoryUrl: string;
  sourceMode: DeploySourceMode;
};

type SearchParamRecord = Record<string, string | string[] | undefined>;

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
    case "local-upload":
      return "local-upload";
    case "repository":
    default:
      return "repository";
  }
}

export function readDeploySearchState(
  params: SearchParamRecord,
): DeploySearchState {
  return {
    branch: readFirstNonEmptyParam(params, ["branch", "ref"]),
    repoVisibility:
      normalizeGitHubRepoVisibility(
        readFirstNonEmptyParam(params, ["repo-visibility", "repoVisibility"]),
      ) || "public",
    repositoryUrl: readFirstNonEmptyParam(params, [
      "repository-url",
      "repositoryUrl",
      "repoUrl",
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

  if (search.repositoryUrl?.trim()) {
    params.set("repository-url", search.repositoryUrl.trim());
  }

  if (search.branch?.trim()) {
    params.set("branch", search.branch.trim());
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
