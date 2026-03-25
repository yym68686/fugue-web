function normalizeGitHubSourceInput(input: string) {
  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  if (/^github\.com\//i.test(input)) {
    return `https://${input}`;
  }

  if (/^[^/\s]+\/[^/\s]+(?:\.git)?$/i.test(input)) {
    return `https://github.com/${input}`;
  }

  return null;
}

function readNormalizedGitHubRepo(input?: string | null) {
  const trimmed = input?.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = normalizeGitHubSourceInput(trimmed);

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);

    if (!/^(www\.)?github\.com$/i.test(url.hostname)) {
      return null;
    }

    const segments = url.pathname
      .replace(/\/+$/g, "")
      .replace(/\.git$/i, "")
      .split("/")
      .filter(Boolean);

    if (segments.length < 2) {
      return null;
    }

    url.protocol = "https:";
    url.hostname = "github.com";
    url.pathname = `/${segments[0]}/${segments[1]}`;
    url.search = "";
    url.hash = "";

    return url;
  } catch {
    return null;
  }
}

function readRepositoryParts(input?: string | null) {
  const url = readNormalizedGitHubRepo(input);

  if (!url) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  return {
    owner: segments[0],
    repo: segments[1],
    url,
  };
}

export function readGitHubSourceHref(input?: string | null) {
  return readNormalizedGitHubRepo(input)?.toString() ?? null;
}

export function readGitHubBranchHref(repoUrl?: string | null, branch?: string | null) {
  const branchName = branch?.trim();
  const repository = readRepositoryParts(repoUrl);

  if (!repository || !branchName) {
    return null;
  }

  repository.url.pathname = `/${repository.owner}/${repository.repo}/tree/${encodeURIComponent(branchName)}`;
  return repository.url.toString();
}

export function readGitHubCommitHref(repoUrl?: string | null, commitSha?: string | null) {
  const commit = commitSha?.trim();
  const repository = readRepositoryParts(repoUrl);

  if (!repository || !commit) {
    return null;
  }

  repository.url.pathname = `/${repository.owner}/${repository.repo}/commit/${encodeURIComponent(commit)}`;
  return repository.url.toString();
}
