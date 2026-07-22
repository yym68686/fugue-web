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

async function fugueSend<T>(
  adminKey: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${readApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${adminKey}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new FugueApiError(
      response.status,
      `fugue ${method} ${path} failed with ${response.status}`,
    );
  }

  // Some mutations return 204 No Content.
  if (response.status === 204) {
    return {} as T;
  }
  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export function isFugueNotFound(error: unknown): boolean {
  return error instanceof FugueApiError && error.status === 404;
}

/** The public HTTP status carried by a FugueApiError, or null. */
export function fugueErrorStatus(error: unknown): number | null {
  return error instanceof FugueApiError ? error.status : null;
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

/* ------------------------------------------------------------------ *
 * App detail — full spec/status for a single app (workbench view).    *
 * ------------------------------------------------------------------ */

export type AppSpec = {
  image_mirror_limit?: number;
  network_mode?: string;
  runtime_id?: string;
  replicas?: number;
  command?: string;
  failover?: unknown;
  persistent_storage?: unknown;
  resources?: unknown;
};

export type AppRouteInfo = {
  base_domain?: string;
  domain_name?: string;
  entrypoint_name?: string;
  hostname?: string;
  path_prefix?: string;
  public_url?: string;
  service_port?: number;
};

export type AppSource = {
  type?: string;
  repo_url?: string;
  repo_branch?: string;
  commit_sha?: string;
};

export type AppDetailStatus = {
  phase?: string;
  current_runtime_id?: string;
  current_release_ready_at?: string;
  current_release_started_at?: string;
  current_replicas?: number;
  last_operation_id?: string;
  last_message?: string;
  updated_at?: string;
};

/** A backing service (database) attached to an app/project. */
export type BackingService = {
  id?: string;
  name?: string;
  type?: string;
  status?: string;
  owner_app_id?: string;
  owner_app_name?: string;
  database_runtime_id?: string;
  location_label?: string;
  failover_configured?: boolean;
  failover_target_runtime_id?: string;
  transfer_target_runtime_id?: string;
  continuity?: { label?: string; tone?: string; live?: boolean };
};

export type ConsoleAppDetail = {
  id: string;
  tenant_id?: string;
  project_id?: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  current_resource_usage?: ConsoleResourceUsage | null;
  internal_service?: {
    host?: string;
    name?: string;
    namespace?: string;
    port?: number;
  };
  route?: AppRouteInfo | null;
  build_source?: AppSource | null;
  origin_source?: AppSource | null;
  spec?: AppSpec;
  status?: AppDetailStatus;
  backing_services?: BackingService[];
  tech_stack?: string[];
};

export type AppEnv = {
  env: Record<string, string>;
  already_current?: boolean;
};

export type RuntimeLogs = {
  component?: string;
  container?: string;
  logs: string;
  namespace?: string;
  pods?: string[];
  selector?: string;
  warnings?: string[];
};

export type BuildLogs = {
  available?: boolean;
  build_strategy?: string;
  completed_at?: string;
  error_message?: string;
  job_name?: string;
  last_updated_at?: string;
  logs: string;
  operation_id?: string;
  operation_status?: string;
  result_message?: string;
  source?: string;
  started_at?: string;
};

export type FilesystemEntry = {
  name: string;
  path: string;
  kind: "file" | "directory" | null;
  size?: number;
  mode?: string;
  modified_at?: string;
  has_children?: boolean;
};

export type FilesystemTree = {
  component?: string;
  depth?: number;
  entries: FilesystemEntry[];
  path?: string;
  pod?: string;
  workspace_root?: string;
};

export type FilesystemFile = {
  component?: string;
  content: string;
  encoding?: string;
  mode?: string;
  modified_at?: string;
  path: string;
  pod?: string;
  size?: number;
  truncated?: boolean;
  workspace_root?: string;
};

export type ImageVersion = {
  current?: boolean;
  delete_supported?: boolean;
  digest?: string;
  image_ref: string;
  last_deployed_at?: string;
  reclaimable_size_bytes?: number;
  redeploy_supported?: boolean;
  runtime_image_ref?: string;
  size_bytes?: number;
  status?: string;
  source?: string;
};

export type ImageInventory = {
  app_id?: string;
  registry_configured?: boolean;
  reclaim_requires_gc?: boolean;
  reclaim_note?: string;
  summary?: Record<string, number>;
  versions: ImageVersion[];
};

export type AppDomain = {
  hostname: string;
  status?: string;
  dns_mode?: string;
  dns_record_id?: string;
  dns_zone_id?: string;
  dns_status?: string;
  route_target?: string;
  tls_status?: string;
  verification_txt_name?: string;
  verification_txt_value?: string;
  verified_at?: string;
  last_message?: string;
  created_at?: string;
  updated_at?: string;
};

export type ObservabilitySource = {
  available?: boolean;
  status?: string;
  mode?: string;
  retention?: string;
  reason?: string;
};

export type ObservabilityMetric = {
  name: string;
  value: number;
  unit?: string;
  labels?: Record<string, string>;
};

export type ObservabilityMetricsSummary = {
  source?: ObservabilitySource;
  window?: { since?: string; until?: string };
  metrics: ObservabilityMetric[];
};

export type ObservabilityRequest = {
  timestamp?: string;
  trace_id?: string;
  request_id?: string;
  route?: string;
  method?: string;
  status_code?: number;
  duration_ms?: number;
  ttft_ms?: number;
  summary?: string;
};

export type ObservabilityRequests = {
  source?: ObservabilitySource;
  window?: { since?: string; until?: string };
  requests: ObservabilityRequest[];
};

export type RouteAvailability = {
  available?: boolean;
  base_domain?: string;
  current?: boolean;
  hostname?: string;
  label?: string;
  path_prefix?: string;
  public_url?: string;
  reason?: string;
  valid?: boolean;
};

const appPath = (id: string, suffix = "") =>
  `/v1/apps/${encodeURIComponent(id)}${suffix}`;

/** Fetch a single app's full detail (spec, status, route, backing services). */
export async function getConsoleApp(
  adminKey: string,
  appId: string,
): Promise<ConsoleAppDetail> {
  const data = await fugueGet<{ app: ConsoleAppDetail }>(
    adminKey,
    appPath(appId),
  );
  return data.app;
}

export async function getAppEnv(
  adminKey: string,
  appId: string,
): Promise<AppEnv> {
  const data = await fugueGet<AppEnv>(adminKey, appPath(appId, "/env"));
  return { env: data.env ?? {}, already_current: data.already_current };
}

export async function getAppRuntimeLogs(
  adminKey: string,
  appId: string,
  opts: { component?: string; tailLines?: number } = {},
): Promise<RuntimeLogs> {
  const params = new URLSearchParams();
  params.set("tail_lines", String(opts.tailLines ?? 200));
  if (opts.component) params.set("component", opts.component);
  return fugueGet<RuntimeLogs>(
    adminKey,
    appPath(appId, `/runtime-logs?${params.toString()}`),
  );
}

export async function getAppBuildLogs(
  adminKey: string,
  appId: string,
  opts: { operationId?: string; tailLines?: number } = {},
): Promise<BuildLogs> {
  const params = new URLSearchParams();
  params.set("tail_lines", String(opts.tailLines ?? 200));
  if (opts.operationId) params.set("operation_id", opts.operationId);
  return fugueGet<BuildLogs>(
    adminKey,
    appPath(appId, `/build-logs?${params.toString()}`),
  );
}

export async function getAppFilesystemTree(
  adminKey: string,
  appId: string,
  opts: { depth?: number; path?: string } = {},
): Promise<FilesystemTree> {
  const params = new URLSearchParams();
  params.set("depth", String(opts.depth ?? 2));
  if (opts.path) params.set("path", opts.path);
  const data = await fugueGet<FilesystemTree>(
    adminKey,
    appPath(appId, `/filesystem/tree?${params.toString()}`),
  );
  return { ...data, entries: Array.isArray(data.entries) ? data.entries : [] };
}

export async function getAppFilesystemFile(
  adminKey: string,
  appId: string,
  path: string,
): Promise<FilesystemFile> {
  const params = new URLSearchParams();
  params.set("path", path);
  params.set("max_bytes", "262144");
  return fugueGet<FilesystemFile>(
    adminKey,
    appPath(appId, `/filesystem/file?${params.toString()}`),
  );
}

export async function getAppImages(
  adminKey: string,
  appId: string,
): Promise<ImageInventory> {
  const data = await fugueGet<ImageInventory>(adminKey, appPath(appId, "/images"));
  return { ...data, versions: Array.isArray(data.versions) ? data.versions : [] };
}

export async function getAppDomains(
  adminKey: string,
  appId: string,
): Promise<AppDomain[]> {
  const data = await fugueGet<{ domains?: AppDomain[] }>(
    adminKey,
    appPath(appId, "/domains"),
  );
  return Array.isArray(data.domains) ? data.domains : [];
}

export async function getAppObservabilityMetrics(
  adminKey: string,
  appId: string,
  since: string,
): Promise<ObservabilityMetricsSummary> {
  const params = new URLSearchParams({ since });
  const data = await fugueGet<ObservabilityMetricsSummary>(
    adminKey,
    appPath(appId, `/observability/metrics/summary?${params.toString()}`),
  );
  return { ...data, metrics: Array.isArray(data.metrics) ? data.metrics : [] };
}

export async function getAppObservabilityRequests(
  adminKey: string,
  appId: string,
  since: string,
): Promise<ObservabilityRequests> {
  const params = new URLSearchParams({ since, limit: "20" });
  const data = await fugueGet<ObservabilityRequests>(
    adminKey,
    appPath(appId, `/observability/requests?${params.toString()}`),
  );
  return { ...data, requests: Array.isArray(data.requests) ? data.requests : [] };
}

/* ------------------------------------------------------------------ *
 * Mutations — all tenant-scoped via the workspace admin key.          *
 * Called only from protected /api/console routes, never the client.   *
 * ------------------------------------------------------------------ */

export type OperationResult = { operation?: unknown };

/** Restart an app (rolling restart, keeps replica count). */
export async function restartApp(adminKey: string, appId: string) {
  return fugueSend<OperationResult>(adminKey, "POST", appPath(appId, "/restart"));
}

/** Start / unpause an app by scaling it back to N replicas (default 1). */
export async function scaleApp(adminKey: string, appId: string, replicas = 1) {
  return fugueSend<OperationResult>(adminKey, "POST", appPath(appId, "/scale"), {
    replicas,
  });
}

/** Pause / disable an app (scale to zero). */
export async function disableApp(adminKey: string, appId: string) {
  return fugueSend<OperationResult>(adminKey, "POST", appPath(appId, "/disable"));
}

/** Delete an app. force=true tears it down even if operations are pending. */
export async function deleteApp(adminKey: string, appId: string, force = false) {
  const suffix = force ? "?force=true" : "";
  return fugueSend<OperationResult>(adminKey, "DELETE", appPath(appId) + suffix);
}

/** Patch environment variables: set new/changed keys and delete removed ones. */
export async function patchAppEnv(
  adminKey: string,
  appId: string,
  changes: { set?: Record<string, string>; delete?: string[] },
) {
  return fugueSend<AppEnv>(adminKey, "PATCH", appPath(appId, "/env"), changes);
}

/** Patch app spec settings (image retention, startup command, storage). */
export async function patchApp(
  adminKey: string,
  appId: string,
  patch: {
    image_mirror_limit?: number;
    startup_command?: string;
    persistent_storage?: unknown;
  },
) {
  return fugueSend<OperationResult>(adminKey, "PATCH", appPath(appId), patch);
}

/** Change the app's primary ingress route. */
export async function patchAppRoute(
  adminKey: string,
  appId: string,
  route: { hostname: string; path_prefix?: string },
) {
  return fugueSend<{ availability?: RouteAvailability }>(
    adminKey,
    "PATCH",
    appPath(appId, "/route"),
    route,
  );
}

export async function checkRouteAvailability(
  adminKey: string,
  appId: string,
  hostname: string,
  pathPrefix?: string,
): Promise<RouteAvailability> {
  const params = new URLSearchParams({ hostname });
  if (pathPrefix) params.set("path_prefix", pathPrefix);
  const data = await fugueGet<{ availability: RouteAvailability }>(
    adminKey,
    appPath(appId, `/route/availability?${params.toString()}`),
  );
  return data.availability ?? {};
}

/** Add a custom domain to the app. */
export async function addAppDomain(
  adminKey: string,
  appId: string,
  body: { hostname: string; dns_mode?: string; overwrite?: boolean },
) {
  return fugueSend<{ domain?: AppDomain; availability?: unknown }>(
    adminKey,
    "POST",
    appPath(appId, "/domains"),
    body,
  );
}

export async function verifyAppDomain(
  adminKey: string,
  appId: string,
  hostname: string,
) {
  return fugueSend<{ domain?: AppDomain; verified?: boolean }>(
    adminKey,
    "POST",
    appPath(appId, "/domains/verify"),
    { hostname },
  );
}

export async function deleteAppDomain(
  adminKey: string,
  appId: string,
  hostname: string,
) {
  const params = new URLSearchParams({ hostname });
  return fugueSend<{ domain?: AppDomain }>(
    adminKey,
    "DELETE",
    appPath(appId, `/domains?${params.toString()}`),
  );
}

/** Redeploy a saved image version. */
export async function redeployImage(
  adminKey: string,
  appId: string,
  imageRef: string,
) {
  return fugueSend<OperationResult>(adminKey, "POST", appPath(appId, "/images/redeploy"), {
    image_ref: imageRef,
  });
}

/** Delete a saved image version from the registry. */
export async function deleteImage(
  adminKey: string,
  appId: string,
  imageRef: string,
) {
  return fugueSend<{ deleted?: boolean; reclaimed_size_bytes?: number }>(
    adminKey,
    "POST",
    appPath(appId, "/images/delete"),
    { image_ref: imageRef },
  );
}

/** Trigger a rebuild of the app from source. */
export async function rebuildApp(
  adminKey: string,
  appId: string,
  opts: { branch?: string } = {},
) {
  return fugueSend<OperationResult>(adminKey, "POST", appPath(appId, "/rebuild"), opts);
}

/** Write a file into the live app filesystem. */
export async function putAppFilesystemFile(
  adminKey: string,
  appId: string,
  body: { path: string; content: string; encoding?: string; mkdir_parents?: boolean },
) {
  return fugueSend<{ path?: string; size?: number }>(
    adminKey,
    "PUT",
    appPath(appId, "/filesystem/file"),
    body,
  );
}

/* ------------------------------------------------------------------ *
 * Project-level read/write.                                           *
 * ------------------------------------------------------------------ */

export async function patchProject(
  adminKey: string,
  projectId: string,
  patch: { name?: string; description?: string },
) {
  return fugueSend<{ project?: ConsoleProject }>(
    adminKey,
    "PATCH",
    `/v1/projects/${encodeURIComponent(projectId)}`,
    patch,
  );
}

export async function deleteProject(adminKey: string, projectId: string) {
  return fugueSend<{ deleted?: boolean }>(
    adminKey,
    "DELETE",
    `/v1/projects/${encodeURIComponent(projectId)}`,
  );
}
