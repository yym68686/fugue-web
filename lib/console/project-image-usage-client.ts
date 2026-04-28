"use client";

import {
  createAbortRequestError,
  requestJson,
} from "@/lib/ui/request-json";

export type ProjectImageUsageSummary = {
  projectId: string;
  reclaimableSizeBytes: number;
  totalSizeBytes: number;
  versionCount: number;
};

type ProjectImageUsageResponse = {
  projects?: ProjectImageUsageSummary[];
};

type CachedProjectImageUsage = {
  cachedAt: number;
  projects: ProjectImageUsageSummary[];
};

const PROJECT_IMAGE_USAGE_CACHE_TTL_MS = 300_000;

let cachedProjectImageUsage: CachedProjectImageUsage | null = null;
let projectImageUsageRequestCache: Promise<ProjectImageUsageSummary[]> | null =
  null;

export function readCachedProjectImageUsage() {
  if (
    !cachedProjectImageUsage ||
    Date.now() - cachedProjectImageUsage.cachedAt >
      PROJECT_IMAGE_USAGE_CACHE_TTL_MS
  ) {
    cachedProjectImageUsage = null;
    return null;
  }

  return cachedProjectImageUsage.projects;
}

function writeCachedProjectImageUsage(projects: ProjectImageUsageSummary[]) {
  cachedProjectImageUsage = {
    cachedAt: Date.now(),
    projects,
  };
}

export async function fetchCachedProjectImageUsage(options?: {
  force?: boolean;
  signal?: AbortSignal;
}) {
  if (options?.signal?.aborted) {
    throw createAbortRequestError();
  }

  if (!options?.force) {
    const cachedProjects = readCachedProjectImageUsage();

    if (cachedProjects) {
      return cachedProjects;
    }

    if (projectImageUsageRequestCache) {
      return projectImageUsageRequestCache;
    }
  }

  const request = requestJson<ProjectImageUsageResponse>(
    "/api/fugue/projects/image-usage",
    {
      cache: "no-store",
      signal: options?.signal,
    },
  )
    .then((response) => {
      const nextProjects = response.projects ?? [];
      writeCachedProjectImageUsage(nextProjects);
      return readCachedProjectImageUsage() ?? nextProjects;
    })
    .finally(() => {
      if (projectImageUsageRequestCache === request) {
        projectImageUsageRequestCache = null;
      }
    });

  projectImageUsageRequestCache = request;
  return request;
}

export function buildProjectImageUsageMap(
  projects: ProjectImageUsageSummary[],
) {
  return projects.reduce<Record<string, ProjectImageUsageSummary>>(
    (accumulator, project) => {
      if (project.projectId.trim()) {
        accumulator[project.projectId] = project;
      }

      return accumulator;
    },
    {},
  );
}
