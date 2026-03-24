import "server-only";

import { getFugueEnv } from "@/lib/fugue/env";

type UnknownRecord = Record<string, unknown>;

export type FugueTenant = {
  createdAt: string | null;
  id: string;
  name: string;
  slug: string | null;
  status: string | null;
  updatedAt: string | null;
};

export type FugueProject = {
  createdAt: string | null;
  description: string | null;
  id: string;
  name: string;
  slug: string | null;
  tenantId: string | null;
  updatedAt: string | null;
};

export type FugueApiKey = {
  createdAt: string | null;
  id: string;
  label: string;
  lastUsedAt: string | null;
  prefix: string | null;
  scopes: string[];
  tenantId: string | null;
};

export type FugueBackingService = {
  createdAt: string | null;
  description: string | null;
  id: string;
  name: string;
  ownerAppId: string | null;
  projectId: string | null;
  provisioner: string | null;
  spec: {
    postgres: {
      database: string | null;
      image: string | null;
      password: string | null;
      serviceName: string | null;
      storagePath: string | null;
      user: string | null;
    } | null;
  };
  status: string | null;
  tenantId: string | null;
  type: string | null;
  updatedAt: string | null;
};

export type FugueServiceBinding = {
  alias: string | null;
  appId: string | null;
  createdAt: string | null;
  env: Record<string, string>;
  id: string;
  serviceId: string | null;
  tenantId: string | null;
  updatedAt: string | null;
};

export type FugueAppFile = {
  content: string | null;
  mode: number | null;
  path: string;
  secret: boolean;
};

export type FugueApp = {
  id: string;
  tenantId: string | null;
  projectId: string | null;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
  route: {
    hostname: string | null;
    publicUrl: string | null;
    servicePort: number | null;
  };
  source: {
    type: string | null;
    repoUrl: string | null;
    repoBranch: string | null;
    buildStrategy: string | null;
    composeService: string | null;
    dockerfilePath: string | null;
  };
  spec: {
    runtimeId: string | null;
    replicas: number | null;
    disabled: boolean | null;
  };
  status: {
    phase: string | null;
    currentRuntimeId: string | null;
    currentReplicas: number | null;
    lastOperationId: string | null;
    lastMessage: string | null;
    updatedAt: string | null;
  };
  bindings: FugueServiceBinding[];
  backingServices: FugueBackingService[];
};

export type FugueRuntime = {
  id: string;
  tenantId: string | null;
  name: string | null;
  machineName: string | null;
  type: string | null;
  connectionMode: string | null;
  status: string | null;
  endpoint: string | null;
  clusterNodeName: string | null;
  fingerprintPrefix: string | null;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type FugueOperation = {
  id: string;
  tenantId: string | null;
  type: string | null;
  status: string | null;
  executionMode: string | null;
  requestedByType: string | null;
  requestedById: string | null;
  appId: string | null;
  sourceRuntimeId: string | null;
  targetRuntimeId: string | null;
  resultMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type FugueAuditEvent = {
  id: string;
  tenantId: string | null;
  actorType: string | null;
  actorId: string | null;
  action: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string | null;
  metadata: {
    appId: string | null;
    component: string | null;
    hostname: string | null;
    label: string | null;
    name: string | null;
    operationId: string | null;
    repoUrl: string | null;
    runtimeId: string | null;
  };
};

export type FugueImportResult = {
  app: FugueApp | null;
  idempotencyKey: string | null;
  operation: FugueOperation | null;
  replayed: boolean;
  requestInProgress: boolean;
};

export type FugueAppEnvResult = {
  alreadyCurrent: boolean;
  env: Record<string, string>;
  operation: FugueOperation | null;
};

export type FugueAppFilesResult = {
  alreadyCurrent: boolean;
  files: FugueAppFile[];
  operation: FugueOperation | null;
};

export type FugueBuildLogsResult = {
  available: boolean;
  buildStrategy: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  jobName: string | null;
  lastUpdatedAt: string | null;
  logs: string;
  operationId: string | null;
  operationStatus: string | null;
  resultMessage: string | null;
  source: string | null;
  startedAt: string | null;
};

export type FugueRuntimeLogsResult = {
  component: string | null;
  container: string | null;
  logs: string;
  namespace: string | null;
  pods: string[];
  selector: string | null;
  warnings: string[];
};

type FugueRequestOptions = {
  accessToken: string;
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function readString(record: UnknownRecord | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(record: UnknownRecord | null, key: string) {
  const value = record?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readStringMap(value: unknown) {
  const record = asRecord(value);

  if (!record) {
    return {} as Record<string, string>;
  }

  const out: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(record)) {
    if (typeof rawValue === "string") {
      out[key] = rawValue;
    }
  }

  return out;
}

function readNumber(record: UnknownRecord | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(record: UnknownRecord | null, key: string) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

async function fugueRequest(path: string, options: FugueRequestOptions) {
  const env = getFugueEnv();
  const url = new URL(path, env.apiUrl);
  const response = await fetch(url, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.accessToken}`,
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    method: options.method ?? "GET",
  });

  if (!response.ok) {
    const body = await response.text();
    const detail = body.trim() ? ` ${body.trim().slice(0, 220)}` : "";
    throw new Error(
      `Fugue request failed for ${path}: ${response.status} ${response.statusText}.${detail}`,
    );
  }

  return response.json();
}

function sanitizeTenant(value: unknown): FugueTenant | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const name = readString(record, "name");

  if (!id || !name) {
    return null;
  }

  return {
    createdAt: readString(record, "created_at"),
    id,
    name,
    slug: readString(record, "slug"),
    status: readString(record, "status"),
    updatedAt: readString(record, "updated_at"),
  };
}

function sanitizeProject(value: unknown): FugueProject | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const name = readString(record, "name");

  if (!id || !name) {
    return null;
  }

  return {
    createdAt: readString(record, "created_at"),
    description: readString(record, "description"),
    id,
    name,
    slug: readString(record, "slug"),
    tenantId: readString(record, "tenant_id"),
    updatedAt: readString(record, "updated_at"),
  };
}

function sanitizeApiKey(value: unknown): FugueApiKey | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const label = readString(record, "label");

  if (!id || !label) {
    return null;
  }

  return {
    createdAt: readString(record, "created_at"),
    id,
    label,
    lastUsedAt: readString(record, "last_used_at"),
    prefix: readString(record, "prefix"),
    scopes: readStringArray(record, "scopes"),
    tenantId: readString(record, "tenant_id"),
  };
}

function sanitizeBackingService(value: unknown): FugueBackingService | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const name = readString(record, "name");

  if (!id || !name) {
    return null;
  }

  const spec = asRecord(record?.spec);
  const postgres = asRecord(spec?.postgres);

  return {
    createdAt: readString(record, "created_at"),
    description: readString(record, "description"),
    id,
    name,
    ownerAppId: readString(record, "owner_app_id"),
    projectId: readString(record, "project_id"),
    provisioner: readString(record, "provisioner"),
    spec: {
      postgres: postgres
        ? {
            database: readString(postgres, "database"),
            image: readString(postgres, "image"),
            password: readString(postgres, "password"),
            serviceName: readString(postgres, "service_name"),
            storagePath: readString(postgres, "storage_path"),
            user: readString(postgres, "user"),
          }
        : null,
    },
    status: readString(record, "status"),
    tenantId: readString(record, "tenant_id"),
    type: readString(record, "type"),
    updatedAt: readString(record, "updated_at"),
  };
}

function sanitizeServiceBinding(value: unknown): FugueServiceBinding | null {
  const record = asRecord(value);
  const id = readString(record, "id");

  if (!id) {
    return null;
  }

  return {
    alias: readString(record, "alias"),
    appId: readString(record, "app_id"),
    createdAt: readString(record, "created_at"),
    env: readStringMap(record?.env),
    id,
    serviceId: readString(record, "service_id"),
    tenantId: readString(record, "tenant_id"),
    updatedAt: readString(record, "updated_at"),
  };
}

function sanitizeAppFile(value: unknown): FugueAppFile | null {
  const record = asRecord(value);
  const path = readString(record, "path");

  if (!path) {
    return null;
  }

  return {
    content: readString(record, "content"),
    mode: readNumber(record, "mode"),
    path,
    secret: readBoolean(record, "secret") ?? false,
  };
}

function sanitizeApp(value: unknown): FugueApp | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const name = readString(record, "name");

  if (!id || !name) {
    return null;
  }

  const route = asRecord(record?.route);
  const source = asRecord(record?.source);
  const spec = asRecord(record?.spec);
  const status = asRecord(record?.status);
  const bindings = Array.isArray(record?.bindings) ? record.bindings : [];
  const backingServices = Array.isArray(record?.backing_services)
    ? record.backing_services
    : [];

  return {
    id,
    tenantId: readString(record, "tenant_id"),
    projectId: readString(record, "project_id"),
    name,
    createdAt: readString(record, "created_at"),
    updatedAt: readString(record, "updated_at"),
    route: {
      hostname: readString(route, "hostname"),
      publicUrl: readString(route, "public_url"),
      servicePort: readNumber(route, "service_port"),
    },
    source: {
      type: readString(source, "type"),
      repoUrl: readString(source, "repo_url"),
      repoBranch: readString(source, "repo_branch"),
      buildStrategy: readString(source, "build_strategy"),
      composeService: readString(source, "compose_service"),
      dockerfilePath: readString(source, "dockerfile_path"),
    },
    spec: {
      runtimeId: readString(spec, "runtime_id"),
      replicas: readNumber(spec, "replicas"),
      disabled: readBoolean(spec, "disabled"),
    },
    status: {
      phase: readString(status, "phase"),
      currentRuntimeId: readString(status, "current_runtime_id"),
      currentReplicas: readNumber(status, "current_replicas"),
      lastOperationId: readString(status, "last_operation_id"),
      lastMessage: readString(status, "last_message"),
      updatedAt: readString(status, "updated_at"),
    },
    bindings: bindings
      .map(sanitizeServiceBinding)
      .filter((item): item is FugueServiceBinding => Boolean(item)),
    backingServices: backingServices
      .map(sanitizeBackingService)
      .filter((item): item is FugueBackingService => Boolean(item)),
  };
}

function sanitizeRuntime(value: unknown): FugueRuntime | null {
  const record = asRecord(value);
  const id = readString(record, "id");

  if (!id) {
    return null;
  }

  return {
    id,
    tenantId: readString(record, "tenant_id"),
    name: readString(record, "name"),
    machineName: readString(record, "machine_name"),
    type: readString(record, "type"),
    connectionMode: readString(record, "connection_mode"),
    status: readString(record, "status"),
    endpoint: readString(record, "endpoint"),
    clusterNodeName: readString(record, "cluster_node_name"),
    fingerprintPrefix: readString(record, "fingerprint_prefix"),
    lastSeenAt: readString(record, "last_seen_at"),
    lastHeartbeatAt: readString(record, "last_heartbeat_at"),
    createdAt: readString(record, "created_at"),
    updatedAt: readString(record, "updated_at"),
  };
}

function sanitizeOperation(value: unknown): FugueOperation | null {
  const record = asRecord(value);
  const id = readString(record, "id");

  if (!id) {
    return null;
  }

  return {
    id,
    tenantId: readString(record, "tenant_id"),
    type: readString(record, "type"),
    status: readString(record, "status"),
    executionMode: readString(record, "execution_mode"),
    requestedByType: readString(record, "requested_by_type"),
    requestedById: readString(record, "requested_by_id"),
    appId: readString(record, "app_id"),
    sourceRuntimeId: readString(record, "source_runtime_id"),
    targetRuntimeId: readString(record, "target_runtime_id"),
    resultMessage: readString(record, "result_message"),
    createdAt: readString(record, "created_at"),
    updatedAt: readString(record, "updated_at"),
    startedAt: readString(record, "started_at"),
    completedAt: readString(record, "completed_at"),
  };
}

function sanitizeAuditEvent(value: unknown): FugueAuditEvent | null {
  const record = asRecord(value);
  const id = readString(record, "id");

  if (!id) {
    return null;
  }

  const metadata = asRecord(record?.metadata);

  return {
    id,
    tenantId: readString(record, "tenant_id"),
    actorType: readString(record, "actor_type"),
    actorId: readString(record, "actor_id"),
    action: readString(record, "action"),
    targetType: readString(record, "target_type"),
    targetId: readString(record, "target_id"),
    createdAt: readString(record, "created_at"),
    metadata: {
      appId: readString(metadata, "app_id"),
      component: readString(metadata, "component"),
      hostname: readString(metadata, "hostname"),
      label: readString(metadata, "label"),
      name: readString(metadata, "name"),
      operationId: readString(metadata, "operation_id"),
      repoUrl: readString(metadata, "repo_url"),
      runtimeId: readString(metadata, "runtime_id"),
    },
  };
}

export async function createFugueTenant(
  accessToken: string,
  payload: { name: string },
) {
  const response = asRecord(
    await fugueRequest("/v1/tenants", {
      accessToken,
      body: payload,
      method: "POST",
    }),
  );
  const tenant = sanitizeTenant(response?.tenant);

  if (!tenant) {
    throw new Error("Fugue tenant response was malformed.");
  }

  return tenant;
}

export async function createFugueApiKey(
  accessToken: string,
  payload: {
    label: string;
    scopes: string[];
    tenantId?: string;
  },
) {
  const response = asRecord(
    await fugueRequest("/v1/api-keys", {
      accessToken,
      body: {
        ...(payload.tenantId ? { tenant_id: payload.tenantId } : {}),
        label: payload.label,
        scopes: payload.scopes,
      },
      method: "POST",
    }),
  );
  const apiKey = sanitizeApiKey(response?.api_key);
  const secret = readString(response, "secret");

  if (!apiKey || !secret) {
    throw new Error("Fugue API key response was malformed.");
  }

  return {
    apiKey,
    secret,
  };
}

export async function createFugueProject(
  accessToken: string,
  payload: {
    description?: string;
    name: string;
    tenantId?: string;
  },
) {
  const response = asRecord(
    await fugueRequest("/v1/projects", {
      accessToken,
      body: {
        ...(payload.tenantId ? { tenant_id: payload.tenantId } : {}),
        ...(payload.description ? { description: payload.description } : {}),
        name: payload.name,
      },
      method: "POST",
    }),
  );
  const project = sanitizeProject(response?.project);

  if (!project) {
    throw new Error("Fugue project response was malformed.");
  }

  return project;
}

export async function importFugueGitHubApp(
  accessToken: string,
  payload: {
    branch?: string;
    buildStrategy?: string;
    name?: string;
    projectId?: string;
    repoUrl: string;
    tenantId?: string;
  },
  idempotencyKey?: string,
) {
  const response = asRecord(
    await fugueRequest("/v1/apps/import-github", {
      accessToken,
      body: {
        ...(payload.tenantId ? { tenant_id: payload.tenantId } : {}),
        ...(payload.projectId ? { project_id: payload.projectId } : {}),
        ...(payload.branch ? { branch: payload.branch } : {}),
        ...(payload.buildStrategy ? { build_strategy: payload.buildStrategy } : {}),
        ...(payload.name ? { name: payload.name } : {}),
        repo_url: payload.repoUrl,
      },
      headers: idempotencyKey
        ? {
            "Idempotency-Key": idempotencyKey,
          }
        : undefined,
      method: "POST",
    }),
  );

  return {
    app: sanitizeApp(response?.app),
    idempotencyKey:
      readString(asRecord(response?.idempotency), "key") ?? idempotencyKey ?? null,
    operation: sanitizeOperation(response?.operation),
    replayed: Boolean(asRecord(response?.idempotency)?.replayed),
    requestInProgress: Boolean(response?.request_in_progress),
  } satisfies FugueImportResult;
}

export async function getFugueTenants(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/tenants", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.tenants) ? payload.tenants : [];
  return items.map(sanitizeTenant).filter((item): item is FugueTenant => Boolean(item));
}

export async function getFugueProjects(
  accessToken: string,
  tenantId?: string,
) {
  const searchParams = tenantId
    ? `?tenant_id=${encodeURIComponent(tenantId)}`
    : "";
  const payload = asRecord(
    await fugueRequest(`/v1/projects${searchParams}`, {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.projects) ? payload.projects : [];
  return items.map(sanitizeProject).filter((item): item is FugueProject => Boolean(item));
}

export async function getFugueApiKeys(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/api-keys", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.api_keys) ? payload.api_keys : [];
  return items.map(sanitizeApiKey).filter((item): item is FugueApiKey => Boolean(item));
}

export async function getFugueApps(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/apps", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.apps) ? payload.apps : [];
  return items.map(sanitizeApp).filter((item): item is FugueApp => Boolean(item));
}

export async function getFugueBackingServices(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/backing-services", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.backing_services)
    ? payload.backing_services
    : [];
  return items
    .map(sanitizeBackingService)
    .filter((item): item is FugueBackingService => Boolean(item));
}

export async function getFugueAppBindings(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/bindings`, {
      accessToken,
    }),
  );

  return {
    backingServices: (Array.isArray(payload?.backing_services)
      ? payload.backing_services
      : []
    )
      .map(sanitizeBackingService)
      .filter((item): item is FugueBackingService => Boolean(item)),
    bindings: (Array.isArray(payload?.bindings) ? payload.bindings : [])
      .map(sanitizeServiceBinding)
      .filter((item): item is FugueServiceBinding => Boolean(item)),
  };
}

export async function getFugueAppEnv(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/env`, {
      accessToken,
    }),
  );

  return {
    alreadyCurrent: Boolean(payload?.already_current),
    env: readStringMap(payload?.env),
    operation: sanitizeOperation(payload?.operation),
  } satisfies FugueAppEnvResult;
}

export async function patchFugueAppEnv(
  accessToken: string,
  appId: string,
  payload: {
    delete?: string[];
    set?: Record<string, string>;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/env`, {
      accessToken,
      body: {
        ...(payload.set ? { set: payload.set } : {}),
        ...(payload.delete ? { delete: payload.delete } : {}),
      },
      method: "PATCH",
    }),
  );

  return {
    alreadyCurrent: Boolean(response?.already_current),
    env: readStringMap(response?.env),
    operation: sanitizeOperation(response?.operation),
  } satisfies FugueAppEnvResult;
}

export async function getFugueAppFiles(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/files`, {
      accessToken,
    }),
  );

  return {
    alreadyCurrent: Boolean(payload?.already_current),
    files: (Array.isArray(payload?.files) ? payload.files : [])
      .map(sanitizeAppFile)
      .filter((item): item is FugueAppFile => Boolean(item)),
    operation: sanitizeOperation(payload?.operation),
  } satisfies FugueAppFilesResult;
}

export async function putFugueAppFiles(
  accessToken: string,
  appId: string,
  files: Array<{
    content?: string;
    mode?: number;
    path: string;
    secret?: boolean;
  }>,
) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/files`, {
      accessToken,
      body: {
        files,
      },
      method: "PUT",
    }),
  );

  return {
    alreadyCurrent: Boolean(payload?.already_current),
    files: (Array.isArray(payload?.files) ? payload.files : [])
      .map(sanitizeAppFile)
      .filter((item): item is FugueAppFile => Boolean(item)),
    operation: sanitizeOperation(payload?.operation),
  } satisfies FugueAppFilesResult;
}

export async function deleteFugueAppFiles(
  accessToken: string,
  appId: string,
  paths: string[],
) {
  const searchParams = new URLSearchParams();

  for (const path of paths) {
    searchParams.append("path", path);
  }

  const payload = asRecord(
    await fugueRequest(
      `/v1/apps/${encodeURIComponent(appId)}/files?${searchParams.toString()}`,
      {
        accessToken,
        method: "DELETE",
      },
    ),
  );

  return {
    alreadyCurrent: Boolean(payload?.already_current),
    files: (Array.isArray(payload?.files) ? payload.files : [])
      .map(sanitizeAppFile)
      .filter((item): item is FugueAppFile => Boolean(item)),
    operation: sanitizeOperation(payload?.operation),
  } satisfies FugueAppFilesResult;
}

export async function getFugueAppBuildLogs(
  accessToken: string,
  appId: string,
  options?: {
    operationId?: string;
    tailLines?: number;
  },
) {
  const searchParams = new URLSearchParams();

  if (options?.operationId) {
    searchParams.set("operation_id", options.operationId);
  }

  if (typeof options?.tailLines === "number" && Number.isFinite(options.tailLines)) {
    searchParams.set("tail_lines", String(options.tailLines));
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/build-logs${suffix}`, {
      accessToken,
    }),
  );

  return {
    available: Boolean(payload?.available),
    buildStrategy: readString(payload, "build_strategy"),
    completedAt: readString(payload, "completed_at"),
    errorMessage: readString(payload, "error_message"),
    jobName: readString(payload, "job_name"),
    lastUpdatedAt: readString(payload, "last_updated_at"),
    logs: readString(payload, "logs") ?? "",
    operationId: readString(payload, "operation_id"),
    operationStatus: readString(payload, "operation_status"),
    resultMessage: readString(payload, "result_message"),
    source: readString(payload, "source"),
    startedAt: readString(payload, "started_at"),
  } satisfies FugueBuildLogsResult;
}

export async function getFugueAppRuntimeLogs(
  accessToken: string,
  appId: string,
  options?: {
    component?: "app" | "postgres";
    pod?: string;
    previous?: boolean;
    tailLines?: number;
  },
) {
  const searchParams = new URLSearchParams();

  if (options?.component) {
    searchParams.set("component", options.component);
  }

  if (options?.pod) {
    searchParams.set("pod", options.pod);
  }

  if (typeof options?.tailLines === "number" && Number.isFinite(options.tailLines)) {
    searchParams.set("tail_lines", String(options.tailLines));
  }

  if (typeof options?.previous === "boolean") {
    searchParams.set("previous", String(options.previous));
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/runtime-logs${suffix}`, {
      accessToken,
    }),
  );

  return {
    component: readString(payload, "component"),
    container: readString(payload, "container"),
    logs: readString(payload, "logs") ?? "",
    namespace: readString(payload, "namespace"),
    pods: readStringArray(payload, "pods"),
    selector: readString(payload, "selector"),
    warnings: readStringArray(payload, "warnings"),
  } satisfies FugueRuntimeLogsResult;
}

export async function restartFugueApp(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/restart`, {
      accessToken,
      body: {},
      method: "POST",
    }),
  );

  return {
    operation: sanitizeOperation(payload?.operation),
    restartToken: readString(payload, "restart_token"),
  };
}

export async function disableFugueApp(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/disable`, {
      accessToken,
      body: {},
      method: "POST",
    }),
  );

  return {
    alreadyDisabled: Boolean(payload?.already_disabled),
    app: sanitizeApp(payload?.app),
    operation: sanitizeOperation(payload?.operation),
  };
}

export async function deleteFugueApp(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}`, {
      accessToken,
      method: "DELETE",
    }),
  );

  return {
    alreadyDeleting: Boolean(payload?.already_deleting),
    operation: sanitizeOperation(payload?.operation),
  };
}

export async function getFugueRuntimes(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/runtimes", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.runtimes) ? payload.runtimes : [];
  return items
    .map(sanitizeRuntime)
    .filter((item): item is FugueRuntime => Boolean(item));
}

export async function getFugueOperations(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/operations", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.operations) ? payload.operations : [];
  return items
    .map(sanitizeOperation)
    .filter((item): item is FugueOperation => Boolean(item));
}

export async function getFugueAuditEvents(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/audit-events", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.audit_events) ? payload.audit_events : [];
  return items
    .map(sanitizeAuditEvent)
    .filter((item): item is FugueAuditEvent => Boolean(item));
}
