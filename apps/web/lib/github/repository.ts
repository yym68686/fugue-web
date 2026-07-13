export type GitHubRepoVisibility = "private" | "public";

const GITHUB_SOURCE_TYPES = new Set(["github-private", "github-public"]);

export function normalizeSourceType(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function isGitHubSourceType(value?: string | null) {
  return GITHUB_SOURCE_TYPES.has(normalizeSourceType(value));
}

export function isPrivateGitHubSourceType(value?: string | null) {
  return normalizeSourceType(value) === "github-private";
}

export function normalizeGitHubRepoVisibility(
  value?: string | null,
): GitHubRepoVisibility | "" {
  switch (value?.trim().toLowerCase()) {
    case "private":
      return "private";
    case "public":
      return "public";
    default:
      return "";
  }
}

export function resolveGitHubRepoVisibility(
  value?: string | null,
  hasToken = false,
): GitHubRepoVisibility {
  const normalized = normalizeGitHubRepoVisibility(value);

  if (normalized) {
    return normalized;
  }

  return hasToken ? "private" : "public";
}

export function isGitHubRepoUrl(value: string) {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\/)?(?:\.git)?$/i.test(
    value.trim(),
  );
}
