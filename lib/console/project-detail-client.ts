import type { ConsoleProjectDetailData } from "@/lib/console/gallery-types";
import {
  createAbortRequestError,
  isAbortRequestError,
  requestJson,
} from "@/lib/ui/request-json";

const PROJECT_DETAIL_CACHE_TTL_MS = 60_000;
const PROJECT_DETAIL_PREFETCH_CONCURRENCY = 1;

type CachedProjectDetail = {
  cachedAt: number;
  detail: ConsoleProjectDetailData;
};

const projectDetailCache = new Map<string, CachedProjectDetail>();
const projectDetailRequestCache = new Map<
  string,
  Promise<ConsoleProjectDetailData>
>();

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

  const request = requestJson<ConsoleProjectDetailData>(
    `/api/fugue/console/projects/${normalizedProjectId}`,
    {
      cache: "no-store",
    },
  )
    .then((detail) => {
      writeCachedConsoleProjectDetail(normalizedProjectId, detail);

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

  const concurrency = Math.max(
    1,
    Math.min(
      options?.concurrency ?? PROJECT_DETAIL_PREFETCH_CONCURRENCY,
      queue.length,
    ),
  );
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (!options?.signal?.aborted) {
        const projectId = queue[nextIndex];
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
