import "server-only";

/**
 * Minimal client for the fugue backend "console" aggregation endpoints.
 *
 * These endpoints are purpose-built for the web console: they return the
 * project gallery and per-project detail (apps + resource usage) already
 * scoped to the caller's workspace, because the admin key we authenticate
 * with is tenant-scoped. That gives us multi-tenant isolation for free — the
 * backend only ever returns projects the key can see.
 */

export type ConsoleResourceUsage = {
  cpu_millicores?: number;
  memory_bytes?: number;
  ephemeral_storage_bytes?: number;
};

export type ConsoleProjectBadge = {
  kind: string;
  label: string;
  meta: string;
};

export type ConsoleProjectLifecycle = {
  label: string;
  live: boolean;
  sync_mode: string;
  tone: string;
};

export type ConsoleProjectSummary = {
  id: string;
  name: string;
  app_count: number;
  service_count: number;
  resource_usage_snapshot: ConsoleResourceUsage;
  service_badges: ConsoleProjectBadge[];
  lifecycle: ConsoleProjectLifecycle;
};

export type ConsoleAppStatus = {
  phase?: string;
  current_replicas?: number;
  current_release_ready_at?: string;
  last_message?: string;
  updated_at?: string;
};

export type ConsoleAppRoute = {
  host?: string;
  path?: string;
  url?: string;
};

export type ConsoleApp = {
  id: string;
  tenant_id?: string;
  project_id?: string;
  name: string;
  description?: string;
  route?: ConsoleAppRoute | null;
  status?: ConsoleAppStatus;
  current_resource_usage?: ConsoleResourceUsage | null;
  created_at?: string;
  updated_at?: string;
};

export type ConsoleProject = {
  id?: string;
  tenant_id?: string;
  name?: string;
  slug?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export type ConsoleProjectDetail = {
  project: ConsoleProject | null;
  project_id: string;
  project_name: string;
  apps: ConsoleApp[];
};

class FugueApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "FugueApiError";
    this.status = status;
  }
}

function readApiBaseUrl(): string {
  const raw = process.env.FUGUE_API_URL?.trim();
  if (!raw) {
    throw new Error("Missing FUGUE_API_URL. Configure the fugue backend URL.");
  }
  return raw.replace(/\/+$/, "");
}

async function fugueGet<T>(adminKey: string, path: string): Promise<T> {
  const url = `${readApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${adminKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new FugueApiError(
      response.status,
      `fugue GET ${path} failed with ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export function isFugueNotFound(error: unknown): boolean {
  return error instanceof FugueApiError && error.status === 404;
}

/** List the projects visible to this workspace's admin key. */
export async function listConsoleGallery(
  adminKey: string,
): Promise<ConsoleProjectSummary[]> {
  const data = await fugueGet<{ projects?: ConsoleProjectSummary[] }>(
    adminKey,
    "/v1/console/gallery",
  );
  return Array.isArray(data.projects) ? data.projects : [];
}

/** Fetch a single project's detail (apps + resource usage) by id. */
export async function getConsoleProject(
  adminKey: string,
  projectId: string,
): Promise<ConsoleProjectDetail> {
  const data = await fugueGet<ConsoleProjectDetail>(
    adminKey,
    `/v1/console/projects/${encodeURIComponent(projectId)}`,
  );
  return {
    project: data.project ?? null,
    project_id: data.project_id ?? projectId,
    project_name: data.project_name ?? "",
    apps: Array.isArray(data.apps) ? data.apps : [],
  };
}
