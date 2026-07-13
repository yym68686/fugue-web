import { readGitHubSourceHref } from "@/lib/fugue/source-links";
import { isGitHubSourceType } from "@/lib/github/repository";

type FugueSourceDisplayRecord = {
  buildStrategy?: string | null;
  composeService?: string | null;
  dockerfilePath?: string | null;
  imageRef?: string | null;
  repoBranch?: string | null;
  repoUrl?: string | null;
  resolvedImageRef?: string | null;
  type?: string | null;
};

function humanize(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatRepoLabel(repoUrl?: string | null, branch?: string | null) {
  if (!repoUrl) {
    return "Unspecified source";
  }

  try {
    const url = new URL(repoUrl);
    const repo = url.pathname.replace(/^\/|\/$/g, "");
    return branch ? `${repo} · ${branch}` : repo;
  } catch {
    return branch ? `${repoUrl} · ${branch}` : repoUrl;
  }
}

export function isDockerImageSourceType(value?: string | null) {
  return value?.trim().toLowerCase() === "docker-image";
}

export function readFugueSourceHref(source?: FugueSourceDisplayRecord | null) {
  if (!isGitHubSourceType(source?.type)) {
    return null;
  }

  return readGitHubSourceHref(source?.repoUrl);
}

export function readFugueSourceLabel(source?: FugueSourceDisplayRecord | null) {
  if (!source) {
    return "Unspecified source";
  }

  if (source.repoUrl) {
    return formatRepoLabel(source.repoUrl, source.repoBranch);
  }

  const imageRef = source.imageRef?.trim() || source.resolvedImageRef?.trim();

  if (imageRef) {
    return imageRef;
  }

  if (source.type?.trim()) {
    if (source.type.trim().toLowerCase() === "upload") {
      return "Local upload";
    }

    return humanize(source.type);
  }

  return "Unspecified source";
}

export function readFugueSourceMeta(source?: FugueSourceDisplayRecord | null) {
  if (!source) {
    return "Unknown";
  }

  const details = [
    humanize(source.buildStrategy),
    source.composeService?.trim() || null,
    source.dockerfilePath?.trim() || null,
  ].filter((value): value is string => Boolean(value) && value !== "Unknown");

  if (details.length) {
    return details.join(" / ");
  }

  if (isDockerImageSourceType(source.type)) {
    return source.resolvedImageRef?.trim()
      ? "Docker image / internal mirror"
      : "Docker image";
  }

  return humanize(source.type);
}
