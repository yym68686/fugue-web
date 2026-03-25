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

export function readGitHubSourceHref(input?: string | null) {
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

    return url.toString();
  } catch {
    return null;
  }
}
