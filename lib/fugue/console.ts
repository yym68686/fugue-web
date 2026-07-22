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

export type ProjectImageUsage = {
  project_id: string;
  version_count: number;
  current_version_count: number;
  stale_version_count: number;
  total_size_bytes: number;
  current_size_bytes: number;
  stale_size_bytes: number;
  reclaimable_size_bytes: number;
};

export type ProjectImageUsageResponse = {
  registry_configured: boolean;
  reclaim_requires_gc: boolean;
  projects: ProjectImageUsage[];
};

/** Aggregated resource usage for a single project, computed on the frontend. */
export type ProjectResourceRollup = {
  cpu_millicores: number;
  memory_bytes: number;
  ephemeral_storage_bytes: number;
  image_total_bytes: number;
};

export type ClusterNodeStat = {
  capacity_bytes?: number;
  allocatable_bytes?: number;
  used_bytes?: number;
  usage_percent?: number;
  requested_bytes?: number;
  request_percent?: number;
};

export type ClusterNodeCpuStat = {
  capacity_millicores?: number;
  allocatable_millicores?: number;
  used_millicores?: number;
  usage_percent?: number;
  requested_millicores?: number;
  request_percent?: number;
};

export type ClusterNode = {
  name: string;
  status: string;
  roles?: string[];
  region?: string;
  internal_ip?: string;
  kubelet_version?: string;
  cpu?: ClusterNodeCpuStat;
  memory?: ClusterNodeStat;
  ephemeral_storage?: ClusterNodeStat;
  image_filesystem?: ClusterNodeStat | null;
  created_at?: string;
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

function readBootstrapKey(): string {
  const raw = process.env.FUGUE_BOOTSTRAP_KEY?.trim();
  if (!raw) {
    throw new Error(
      "Missing FUGUE_BOOTSTRAP_KEY. Platform-admin views require the bootstrap key.",
    );
  }
  return raw;
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

/**
 * List all apps with their current resource usage. The gallery endpoint
 * deliberately skips resource usage, so we fetch it here and roll it up by
 * project on the frontend.
 */
export async function listAppsWithUsage(adminKey: string): Promise<ConsoleApp[]> {
  const data = await fugueGet<{ apps?: ConsoleApp[] }>(
    adminKey,
    "/v1/apps?include_resource_usage=true&include_live_status=false",
  );
  return Array.isArray(data.apps) ? data.apps : [];
}

/** Per-project container-image disk usage. */
export async function listProjectImageUsage(
  adminKey: string,
): Promise<ProjectImageUsage[]> {
  const data = await fugueGet<ProjectImageUsageResponse>(
    adminKey,
    "/v1/projects/image-usage",
  );
  return Array.isArray(data.projects) ? data.projects : [];
}

/**
 * Roll up per-app resource usage into per-project totals, keyed by project_id.
 * Image usage is merged in from the image-usage endpoint.
 */
export function rollupProjectResources(
  apps: ConsoleApp[],
  imageUsage: ProjectImageUsage[],
): Map<string, ProjectResourceRollup> {
  const rollup = new Map<string, ProjectResourceRollup>();

  const ensure = (projectId: string): ProjectResourceRollup => {
    let entry = rollup.get(projectId);
    if (!entry) {
      entry = {
        cpu_millicores: 0,
        memory_bytes: 0,
        ephemeral_storage_bytes: 0,
        image_total_bytes: 0,
      };
      rollup.set(projectId, entry);
    }
    return entry;
  };

  for (const app of apps) {
    const projectId = app.project_id;
    if (!projectId) continue;
    const usage = app.current_resource_usage;
    if (!usage) continue;
    const entry = ensure(projectId);
    entry.cpu_millicores += usage.cpu_millicores ?? 0;
    entry.memory_bytes += usage.memory_bytes ?? 0;
    entry.ephemeral_storage_bytes += usage.ephemeral_storage_bytes ?? 0;
  }

  for (const image of imageUsage) {
    if (!image.project_id) continue;
    ensure(image.project_id).image_total_bytes += image.total_size_bytes ?? 0;
  }

  return rollup;
}

/**
 * List every cluster node with CPU/memory/disk stats. Requires platform-admin
 * scope, so this authenticates with the bootstrap key rather than a workspace
 * key. Only ever called from server components behind an is-admin gate.
 */
export async function listClusterNodes(): Promise<ClusterNode[]> {
  const data = await fugueGet<{ cluster_nodes?: ClusterNode[] }>(
    readBootstrapKey(),
    "/v1/cluster/nodes?sync_locations=false",
  );
  return Array.isArray(data.cluster_nodes) ? data.cluster_nodes : [];
}
