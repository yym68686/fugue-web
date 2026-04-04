import type {
  ConsoleGalleryProjectView,
  ConsoleProjectDetailData,
} from "@/lib/console/gallery-types";
import {
  createAbortRequestError,
  isAbortRequestError,
  requestJson,
} from "@/lib/ui/request-json";

const PROJECT_DETAIL_CACHE_TTL_MS = 60_000;
const PROJECT_DETAIL_PREFETCH_CONCURRENCY = 3;

type ConsoleProjectDetailWarmupData = {
  errors?: string[];
  projects?: ConsoleGalleryProjectView[];
};

type CachedProjectDetail = {
  cachedAt: number;
  detail: ConsoleProjectDetailData;
};

const projectDetailCache = new Map<string, CachedProjectDetail>();
const projectDetailRequestCache = new Map<
  string,
  Promise<ConsoleProjectDetailData>
>();
let projectDetailWarmupAt = 0;
let projectDetailWarmupRequest: Promise<void> | null = null;
let projectDetailEpoch = 0;

export function readCachedConsoleProjectDetail(projectId: string) {
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    return null;
  }

  const cached = projectDetailCache.get(normalizedProjectId);

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > PROJECT_DETAIL_CACHE_TTL_MS) {
    projectDetailCache.delete(normalizedProjectId);
    return null;
  }

  return cached.detail;
}

function writeCachedConsoleProjectDetail(
  projectId: string,
  detail: ConsoleProjectDetailData,
) {
  projectDetailCache.set(projectId, {
    cachedAt: Date.now(),
    detail,
  });
}

export function invalidateConsoleProjectDetails(projectIds: string | string[]) {
  const normalizedProjectIds = [
    ...(typeof projectIds === "string" ? [projectIds] : projectIds),
  ]
    .map((projectId) => projectId.trim())
    .filter(Boolean);

  if (!normalizedProjectIds.length) {
    return;
  }

  projectDetailEpoch += 1;
  projectDetailWarmupAt = 0;
  projectDetailWarmupRequest = null;

  for (const projectId of normalizedProjectIds) {
    projectDetailCache.delete(projectId);
    projectDetailRequestCache.delete(projectId);
  }
}

function hasFreshProjectDetailWarmup() {
  return Date.now() - projectDetailWarmupAt < PROJECT_DETAIL_CACHE_TTL_MS;
}

export function primeConsoleProjectDetails(projects: ConsoleGalleryProjectView[]) {
  const normalizedProjects = projects
    .map((project) => ({
      ...project,
      id: project.id.trim(),
    }))
    .filter((project) => project.id);

  for (const project of normalizedProjects) {
    writeCachedConsoleProjectDetail(project.id, {
      project,
    });
  }

  if (normalizedProjects.length > 0) {
    projectDetailWarmupAt = Date.now();
  }
}

async function warmAllConsoleProjectDetails(options?: {
  force?: boolean;
  signal?: AbortSignal;
}) {
  if (options?.signal?.aborted) {
    throw createAbortRequestError();
  }

  if (!options?.force && hasFreshProjectDetailWarmup()) {
    return;
  }

  if (!options?.force && projectDetailWarmupRequest) {
    return projectDetailWarmupRequest;
  }

  const requestEpoch = projectDetailEpoch;

  const request = requestJson<ConsoleProjectDetailWarmupData>(
    "/api/fugue/console/projects",
    {
      cache: "no-store",
    },
  )
    .then((data) => {
      if (projectDetailEpoch !== requestEpoch) {
        return;
      }

      primeConsoleProjectDetails(data.projects ?? []);

      if ((data.projects ?? []).length === 0) {
        projectDetailWarmupAt = Date.now();
      }
    })
    .finally(() => {
      if (projectDetailWarmupRequest === request) {
        projectDetailWarmupRequest = null;
      }
    });

  projectDetailWarmupRequest = request;
  return request;
}

export async function fetchConsoleProjectDetail(
  projectId: string,
  options?: {
    force?: boolean;
    signal?: AbortSignal;
  },
) {
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    throw new Error("Project id is required.");
  }

  if (options?.signal?.aborted) {
    throw createAbortRequestError();
  }

  if (!options?.force) {
    const cached = readCachedConsoleProjectDetail(normalizedProjectId);

    if (cached) {
      return cached;
    }
  }

  const pendingRequest = projectDetailRequestCache.get(normalizedProjectId);

  if (pendingRequest) {
    return pendingRequest;
  }

  const requestEpoch = projectDetailEpoch;

  const request = requestJson<ConsoleProjectDetailData>(
    `/api/fugue/console/projects/${normalizedProjectId}`,
    {
      cache: "no-store",
    },
  )
    .then((detail) => {
      if (projectDetailEpoch === requestEpoch) {
        writeCachedConsoleProjectDetail(normalizedProjectId, detail);
      }

      return detail;
    })
    .finally(() => {
      if (projectDetailRequestCache.get(normalizedProjectId) === request) {
        projectDetailRequestCache.delete(normalizedProjectId);
      }
    });

  projectDetailRequestCache.set(normalizedProjectId, request);
  return request;
}

export async function warmConsoleProjectDetails(
  projectIds: string[],
  options?: {
    concurrency?: number;
    signal?: AbortSignal;
  },
) {
  const queue = Array.from(
    new Set(projectIds.map((projectId) => projectId.trim()).filter(Boolean)),
  ).filter((projectId) => !readCachedConsoleProjectDetail(projectId));

  if (!queue.length) {
    return;
  }

  if (queue.length > 1) {
    try {
      await warmAllConsoleProjectDetails({
        signal: options?.signal,
      });
    } catch (error) {
      if (options?.signal?.aborted || isAbortRequestError(error)) {
        return;
      }
    }
  }

  const remainingQueue = queue.filter(
    (projectId) => !readCachedConsoleProjectDetail(projectId),
  );

  if (!remainingQueue.length) {
    return;
  }

  const concurrency = Math.max(
    1,
    Math.min(
      options?.concurrency ?? PROJECT_DETAIL_PREFETCH_CONCURRENCY,
      remainingQueue.length,
    ),
  );
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (!options?.signal?.aborted) {
        const projectId = remainingQueue[nextIndex];
        nextIndex += 1;

        if (!projectId) {
          return;
        }

        try {
          await fetchConsoleProjectDetail(projectId, {
            signal: options?.signal,
          });
        } catch (error) {
          if (options?.signal?.aborted || isAbortRequestError(error)) {
            return;
          }
        }
      }
    }),
  );
}
