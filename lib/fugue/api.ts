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
  disabledAt: string | null;
  id: string;
  label: string;
  lastUsedAt: string | null;
  prefix: string | null;
  scopes: string[];
  status: string | null;
  tenantId: string | null;
};

export type FugueNodeKey = {
  createdAt: string | null;
  hash: string | null;
  id: string;
  label: string;
  lastUsedAt: string | null;
  prefix: string | null;
  revokedAt: string | null;
  status: string | null;
  tenantId: string | null;
  updatedAt: string | null;
};

export type FugueBackingService = {
  createdAt: string | null;
  currentResourceUsage: FugueResourceUsage | null;
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

export type FugueAppWorkspace = {
  mountPath: string | null;
};

export type FugueFilesystemEntry = {
  hasChildren: boolean;
  kind: string;
  mode: number | null;
  modifiedAt: string | null;
  name: string;
  path: string;
  size: number | null;
};

export type FugueAppTechnology = {
  kind: string;
  name: string;
  slug: string;
  source: string | null;
};

export type FugueResourceUsage = {
  cpuMillicores: number | null;
  ephemeralStorageBytes: number | null;
  memoryBytes: number | null;
};

export type FugueAppSource = {
  type: string | null;
  repoUrl: string | null;
  repoBranch: string | null;
  buildStrategy: string | null;
  composeService: string | null;
  detectedProvider: string | null;
  detectedStack: string | null;
  dockerfilePath: string | null;
  commitSha: string | null;
  commitCommittedAt: string | null;
  sourceDir: string | null;
  uploadFilename: string | null;
};

export type FugueApp = {
  id: string;
  tenantId: string | null;
  projectId: string | null;
  name: string;
  createdAt: string | null;
  currentResourceUsage: FugueResourceUsage | null;
  updatedAt: string | null;
  route: {
    baseDomain: string | null;
    hostname: string | null;
    publicUrl: string | null;
    servicePort: number | null;
  };
  source: FugueAppSource;
  spec: {
    runtimeId: string | null;
    replicas: number | null;
    disabled: boolean | null;
    workspace: FugueAppWorkspace | null;
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
  techStack: FugueAppTechnology[];
};

export type FugueRuntime = {
  id: string;
  tenantId: string | null;
  name: string | null;
  machineName: string | null;
  labels: Record<string, string>;
  type: string | null;
  accessMode: string | null;
  poolMode: string | null;
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

export type FugueRuntimeAccessGrant = {
  runtimeId: string;
  tenantId: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type FugueClusterNodeCondition = {
  lastTransitionAt: string | null;
  message: string | null;
  reason: string | null;
  status: string | null;
};

export type FugueClusterNodeCPUStats = {
  allocatableMilliCores: number | null;
  capacityMilliCores: number | null;
  usagePercent: number | null;
  usedMilliCores: number | null;
};

export type FugueClusterNodeMemoryStats = {
  allocatableBytes: number | null;
  capacityBytes: number | null;
  usagePercent: number | null;
  usedBytes: number | null;
};

export type FugueClusterNodeStorageStats = {
  allocatableBytes: number | null;
  capacityBytes: number | null;
  usagePercent: number | null;
  usedBytes: number | null;
};

export type FugueClusterNodeWorkloadPod = {
  name: string;
  phase: string | null;
};

export type FugueClusterNodeWorkload = {
  id: string;
  kind: string;
  name: string;
  namespace: string | null;
  ownerAppId: string | null;
  podCount: number;
  pods: FugueClusterNodeWorkloadPod[];
  projectId: string | null;
  runtimeId: string | null;
  serviceType: string | null;
  tenantId: string | null;
};

export type FugueClusterNode = {
  conditions: Record<string, FugueClusterNodeCondition>;
  containerRuntime: string | null;
  cpu: FugueClusterNodeCPUStats | null;
  createdAt: string | null;
  ephemeralStorage: FugueClusterNodeStorageStats | null;
  externalIp: string | null;
  internalIp: string | null;
  publicIp: string | null;
  kernelVersion: string | null;
  kubeletVersion: string | null;
  memory: FugueClusterNodeMemoryStats | null;
  name: string;
  osImage: string | null;
  region: string | null;
  roles: string[];
  runtimeId: string | null;
  status: string | null;
  tenantId: string | null;
  workloads: FugueClusterNodeWorkload[];
  zone: string | null;
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
  desiredSource: FugueAppSource | null;
  resultMessage: string | null;
  errorMessage: string | null;
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

export type FugueAppRouteAvailability = {
  available: boolean;
  baseDomain: string | null;
  current: boolean;
  hostname: string | null;
  input: string | null;
  label: string | null;
  publicUrl: string | null;
  reason: string | null;
  valid: boolean;
};

export type FugueAppRouteAvailabilityResult = {
  availability: FugueAppRouteAvailability | null;
};

export type FugueAppRouteResult = {
  alreadyCurrent: boolean;
  app: FugueApp | null;
  availability: FugueAppRouteAvailability | null;
};

export type FugueAppDomain = {
  appId: string | null;
  createdAt: string | null;
  hostname: string;
  lastCheckedAt: string | null;
  lastMessage: string | null;
  routeTarget: string | null;
  status: string | null;
  tenantId: string | null;
  tlsLastCheckedAt: string | null;
  tlsLastMessage: string | null;
  tlsReadyAt: string | null;
  tlsStatus: string | null;
  updatedAt: string | null;
  verificationTxtName: string | null;
  verificationTxtValue: string | null;
  verifiedAt: string | null;
};

export type FugueAppDomainAvailability = {
  available: boolean;
  current: boolean;
  hostname: string | null;
  input: string | null;
  reason: string | null;
  valid: boolean;
};

export type FugueAppDomainListResult = {
  domains: FugueAppDomain[];
};

export type FugueAppDomainAvailabilityResult = {
  availability: FugueAppDomainAvailability | null;
};

export type FugueAppDomainResult = {
  alreadyCurrent: boolean;
  availability: FugueAppDomainAvailability | null;
  domain: FugueAppDomain | null;
};

export type FugueAppDomainDeleteResult = {
  domain: FugueAppDomain | null;
};

export type FugueAppDomainVerifyResult = {
  domain: FugueAppDomain | null;
  verified: boolean;
};

export type FugueAppFilesResult = {
  alreadyCurrent: boolean;
  files: FugueAppFile[];
  operation: FugueOperation | null;
};

export type FugueAppFilesystemTreeResult = {
  component: string | null;
  depth: number | null;
  entries: FugueFilesystemEntry[];
  path: string | null;
  pod: string | null;
  workspaceRoot: string | null;
};

export type FugueAppFilesystemFileResult = {
  component: string | null;
  content: string;
  encoding: string | null;
  mode: number | null;
  modifiedAt: string | null;
  path: string | null;
  pod: string | null;
  size: number | null;
  truncated: boolean;
  workspaceRoot: string | null;
};

export type FugueAppFilesystemMutationResult = {
  component: string | null;
  deleted: boolean;
  kind: string | null;
  mode: number | null;
  modifiedAt: string | null;
  path: string | null;
  pod: string | null;
  size: number | null;
  workspaceRoot: string | null;
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
    disabledAt: readString(record, "disabled_at"),
    id,
    label,
    lastUsedAt: readString(record, "last_used_at"),
    prefix: readString(record, "prefix"),
    scopes: readStringArray(record, "scopes"),
    status: readString(record, "status"),
    tenantId: readString(record, "tenant_id"),
  };
}

function sanitizeNodeKey(value: unknown): FugueNodeKey | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const label = readString(record, "label");

  if (!id || !label) {
    return null;
  }

  return {
    createdAt: readString(record, "created_at"),
    hash: readString(record, "hash"),
    id,
    label,
    lastUsedAt: readString(record, "last_used_at"),
    prefix: readString(record, "prefix"),
    revokedAt: readString(record, "revoked_at"),
    status: readString(record, "status"),
    tenantId: readString(record, "tenant_id"),
    updatedAt: readString(record, "updated_at"),
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
    currentResourceUsage: sanitizeResourceUsage(record?.current_resource_usage),
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

function sanitizeAppWorkspace(value: unknown): FugueAppWorkspace | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    mountPath: readString(record, "mount_path"),
  };
}

function sanitizeFilesystemEntry(value: unknown): FugueFilesystemEntry | null {
  const record = asRecord(value);
  const path = readString(record, "path");
  const name = readString(record, "name");
  const kind = readString(record, "kind");

  if (!path || !name || !kind) {
    return null;
  }

  return {
    hasChildren: readBoolean(record, "has_children") ?? false,
    kind,
    mode: readNumber(record, "mode"),
    modifiedAt: readString(record, "modified_at"),
    name,
    path,
    size: readNumber(record, "size"),
  };
}

function sanitizeAppTechnology(value: unknown): FugueAppTechnology | null {
  const record = asRecord(value);
  const kind = readString(record, "kind");
  const name = readString(record, "name");
  const slug = readString(record, "slug");

  if (!kind || !name || !slug) {
    return null;
  }

  return {
    kind,
    name,
    slug,
    source: readString(record, "source"),
  };
}

function sanitizeResourceUsage(value: unknown): FugueResourceUsage | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  const usage = {
    cpuMillicores: readNumber(record, "cpu_millicores"),
    ephemeralStorageBytes: readNumber(record, "ephemeral_storage_bytes"),
    memoryBytes: readNumber(record, "memory_bytes"),
  } satisfies FugueResourceUsage;

  return usage.cpuMillicores !== null ||
    usage.memoryBytes !== null ||
    usage.ephemeralStorageBytes !== null
    ? usage
    : null;
}

function sanitizeAppSource(value: unknown): FugueAppSource {
  const source = asRecord(value);

  return {
    type: readString(source, "type"),
    repoUrl: readString(source, "repo_url"),
    repoBranch: readString(source, "repo_branch"),
    buildStrategy: readString(source, "build_strategy"),
    composeService: readString(source, "compose_service"),
    detectedProvider: readString(source, "detected_provider"),
    detectedStack: readString(source, "detected_stack"),
    dockerfilePath: readString(source, "dockerfile_path"),
    commitSha: readString(source, "commit_sha"),
    commitCommittedAt: readString(source, "commit_committed_at"),
    sourceDir: readString(source, "source_dir"),
    uploadFilename: readString(source, "upload_filename"),
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
  const spec = asRecord(record?.spec);
  const status = asRecord(record?.status);
  const bindings = Array.isArray(record?.bindings) ? record.bindings : [];
  const backingServices = Array.isArray(record?.backing_services)
    ? record.backing_services
    : [];
  const techStack = Array.isArray(record?.tech_stack) ? record.tech_stack : [];

  return {
    id,
    tenantId: readString(record, "tenant_id"),
    projectId: readString(record, "project_id"),
    name,
    createdAt: readString(record, "created_at"),
    currentResourceUsage: sanitizeResourceUsage(record?.current_resource_usage),
    updatedAt: readString(record, "updated_at"),
    route: {
      baseDomain: readString(route, "base_domain"),
      hostname: readString(route, "hostname"),
      publicUrl: readString(route, "public_url"),
      servicePort: readNumber(route, "service_port"),
    },
    source: sanitizeAppSource(record?.source),
    spec: {
      runtimeId: readString(spec, "runtime_id"),
      replicas: readNumber(spec, "replicas"),
      disabled: readBoolean(spec, "disabled"),
      workspace: sanitizeAppWorkspace(spec?.workspace),
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
    techStack: techStack
      .map(sanitizeAppTechnology)
      .filter((item): item is FugueAppTechnology => Boolean(item)),
  };
}

function sanitizeAppRouteAvailability(value: unknown): FugueAppRouteAvailability | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    available: Boolean(readBoolean(record, "available")),
    baseDomain: readString(record, "base_domain"),
    current: Boolean(readBoolean(record, "current")),
    hostname: readString(record, "hostname"),
    input: readString(record, "input"),
    label: readString(record, "label"),
    publicUrl: readString(record, "public_url"),
    reason: readString(record, "reason"),
    valid: Boolean(readBoolean(record, "valid")),
  };
}

function sanitizeAppDomain(value: unknown): FugueAppDomain | null {
  const record = asRecord(value);
  const hostname = readString(record, "hostname");

  if (!hostname) {
    return null;
  }

  return {
    appId: readString(record, "app_id"),
    createdAt: readString(record, "created_at"),
    hostname,
    lastCheckedAt: readString(record, "last_checked_at"),
    lastMessage: readString(record, "last_message"),
    routeTarget: readString(record, "route_target"),
    status: readString(record, "status"),
    tenantId: readString(record, "tenant_id"),
    tlsLastCheckedAt: readString(record, "tls_last_checked_at"),
    tlsLastMessage: readString(record, "tls_last_message"),
    tlsReadyAt: readString(record, "tls_ready_at"),
    tlsStatus: readString(record, "tls_status"),
    updatedAt: readString(record, "updated_at"),
    verificationTxtName: readString(record, "verification_txt_name"),
    verificationTxtValue: readString(record, "verification_txt_value"),
    verifiedAt: readString(record, "verified_at"),
  };
}

function sanitizeAppDomainAvailability(value: unknown): FugueAppDomainAvailability | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    available: Boolean(readBoolean(record, "available")),
    current: Boolean(readBoolean(record, "current")),
    hostname: readString(record, "hostname"),
    input: readString(record, "input"),
    reason: readString(record, "reason"),
    valid: Boolean(readBoolean(record, "valid")),
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
    labels: readStringMap(record?.labels),
    type: readString(record, "type"),
    accessMode: readString(record, "access_mode"),
    poolMode: readString(record, "pool_mode"),
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

function sanitizeRuntimeAccessGrant(value: unknown): FugueRuntimeAccessGrant | null {
  const record = asRecord(value);
  const runtimeId = readString(record, "runtime_id");
  const tenantId = readString(record, "tenant_id");

  if (!runtimeId || !tenantId) {
    return null;
  }

  return {
    runtimeId,
    tenantId,
    createdAt: readString(record, "created_at"),
    updatedAt: readString(record, "updated_at"),
  };
}

function sanitizeClusterNodeCondition(value: unknown): FugueClusterNodeCondition | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    lastTransitionAt: readString(record, "last_transition_at"),
    message: readString(record, "message"),
    reason: readString(record, "reason"),
    status: readString(record, "status"),
  };
}

function sanitizeClusterNodeConditionMap(value: unknown) {
  const record = asRecord(value);

  if (!record) {
    return {} as Record<string, FugueClusterNodeCondition>;
  }

  const out: Record<string, FugueClusterNodeCondition> = {};

  for (const [key, rawValue] of Object.entries(record)) {
    const condition = sanitizeClusterNodeCondition(rawValue);

    if (!key.trim() || !condition) {
      continue;
    }

    out[key] = condition;
  }

  return out;
}

function sanitizeClusterNodeCPUStats(value: unknown): FugueClusterNodeCPUStats | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    allocatableMilliCores: readNumber(record, "allocatable_millicores"),
    capacityMilliCores: readNumber(record, "capacity_millicores"),
    usagePercent: readNumber(record, "usage_percent"),
    usedMilliCores: readNumber(record, "used_millicores"),
  };
}

function sanitizeClusterNodeMemoryStats(value: unknown): FugueClusterNodeMemoryStats | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    allocatableBytes: readNumber(record, "allocatable_bytes"),
    capacityBytes: readNumber(record, "capacity_bytes"),
    usagePercent: readNumber(record, "usage_percent"),
    usedBytes: readNumber(record, "used_bytes"),
  };
}

function sanitizeClusterNodeStorageStats(value: unknown): FugueClusterNodeStorageStats | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  return {
    allocatableBytes: readNumber(record, "allocatable_bytes"),
    capacityBytes: readNumber(record, "capacity_bytes"),
    usagePercent: readNumber(record, "usage_percent"),
    usedBytes: readNumber(record, "used_bytes"),
  };
}

function sanitizeClusterNodeWorkloadPod(value: unknown): FugueClusterNodeWorkloadPod | null {
  const record = asRecord(value);
  const name = readString(record, "name");

  if (!name) {
    return null;
  }

  return {
    name,
    phase: readString(record, "phase"),
  };
}

function sanitizeClusterNodeWorkload(value: unknown): FugueClusterNodeWorkload | null {
  const record = asRecord(value);
  const id = readString(record, "id");
  const kind = readString(record, "kind");
  const name = readString(record, "name");

  if (!id || !kind || !name) {
    return null;
  }

  const pods = Array.isArray(record?.pods) ? record.pods : [];

  return {
    id,
    kind,
    name,
    namespace: readString(record, "namespace"),
    ownerAppId: readString(record, "owner_app_id"),
    podCount:
      readNumber(record, "pod_count") ??
      pods.filter((item): item is FugueClusterNodeWorkloadPod => Boolean(sanitizeClusterNodeWorkloadPod(item))).length,
    pods: pods
      .map(sanitizeClusterNodeWorkloadPod)
      .filter((item): item is FugueClusterNodeWorkloadPod => Boolean(item)),
    projectId: readString(record, "project_id"),
    runtimeId: readString(record, "runtime_id"),
    serviceType: readString(record, "service_type"),
    tenantId: readString(record, "tenant_id"),
  };
}

function sanitizeClusterNode(value: unknown): FugueClusterNode | null {
  const record = asRecord(value);
  const name = readString(record, "name");

  if (!name) {
    return null;
  }

  const workloads = Array.isArray(record?.workloads) ? record.workloads : [];

  return {
    conditions: sanitizeClusterNodeConditionMap(record?.conditions),
    containerRuntime: readString(record, "container_runtime"),
    cpu: sanitizeClusterNodeCPUStats(record?.cpu),
    createdAt: readString(record, "created_at"),
    ephemeralStorage: sanitizeClusterNodeStorageStats(record?.ephemeral_storage),
    externalIp: readString(record, "external_ip"),
    internalIp: readString(record, "internal_ip"),
    publicIp: readString(record, "public_ip"),
    kernelVersion: readString(record, "kernel_version"),
    kubeletVersion: readString(record, "kubelet_version"),
    memory: sanitizeClusterNodeMemoryStats(record?.memory),
    name,
    osImage: readString(record, "os_image"),
    region: readString(record, "region"),
    roles: readStringArray(record, "roles"),
    runtimeId: readString(record, "runtime_id"),
    status: readString(record, "status"),
    tenantId: readString(record, "tenant_id"),
    workloads: workloads
      .map(sanitizeClusterNodeWorkload)
      .filter((item): item is FugueClusterNodeWorkload => Boolean(item)),
    zone: readString(record, "zone"),
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
    desiredSource: record?.desired_source ? sanitizeAppSource(record.desired_source) : null,
    resultMessage: readString(record, "result_message"),
    errorMessage: readString(record, "error_message"),
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
    throw new Error("Fugue access-key response was malformed.");
  }

  return {
    apiKey,
    secret,
  };
}

export async function updateFugueApiKey(
  accessToken: string,
  id: string,
  payload: {
    label?: string;
    scopes?: string[];
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/api-keys/${encodeURIComponent(id)}`, {
      accessToken,
      body: {
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.scopes !== undefined ? { scopes: payload.scopes } : {}),
      },
      method: "PATCH",
    }),
  );
  const apiKey = sanitizeApiKey(response?.api_key);

  if (!apiKey) {
    throw new Error("Fugue access-key update response was malformed.");
  }

  return apiKey;
}

export async function rotateFugueApiKey(
  accessToken: string,
  id: string,
  payload?: {
    label?: string;
    scopes?: string[];
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/api-keys/${encodeURIComponent(id)}/rotate`, {
      accessToken,
      body:
        payload && (payload.label !== undefined || payload.scopes !== undefined)
          ? {
              ...(payload.label !== undefined ? { label: payload.label } : {}),
              ...(payload.scopes !== undefined ? { scopes: payload.scopes } : {}),
            }
          : {},
      method: "POST",
    }),
  );
  const apiKey = sanitizeApiKey(response?.api_key);
  const secret = readString(response, "secret");

  if (!apiKey || !secret) {
    throw new Error("Fugue access-key rotate response was malformed.");
  }

  return {
    apiKey,
    secret,
  };
}

export async function disableFugueApiKey(
  accessToken: string,
  id: string,
) {
  const response = asRecord(
    await fugueRequest(`/v1/api-keys/${encodeURIComponent(id)}/disable`, {
      accessToken,
      method: "POST",
    }),
  );
  const apiKey = sanitizeApiKey(response?.api_key);

  if (!apiKey) {
    throw new Error("Fugue access-key disable response was malformed.");
  }

  return apiKey;
}

export async function enableFugueApiKey(
  accessToken: string,
  id: string,
) {
  const response = asRecord(
    await fugueRequest(`/v1/api-keys/${encodeURIComponent(id)}/enable`, {
      accessToken,
      method: "POST",
    }),
  );
  const apiKey = sanitizeApiKey(response?.api_key);

  if (!apiKey) {
    throw new Error("Fugue access-key enable response was malformed.");
  }

  return apiKey;
}

export async function deleteFugueApiKey(
  accessToken: string,
  id: string,
) {
  const response = asRecord(
    await fugueRequest(`/v1/api-keys/${encodeURIComponent(id)}`, {
      accessToken,
      method: "DELETE",
    }),
  );
  const apiKey = sanitizeApiKey(response?.api_key);
  const deleted = readBoolean(response, "deleted");

  if (!apiKey || !deleted) {
    throw new Error("Fugue access-key delete response was malformed.");
  }

  return {
    apiKey,
    deleted,
  };
}

export async function createFugueNodeKey(
  accessToken: string,
  payload?: {
    label?: string;
    tenantId?: string;
  },
) {
  const response = asRecord(
    await fugueRequest("/v1/node-keys", {
      accessToken,
      body:
        payload && (payload.label !== undefined || payload.tenantId !== undefined)
          ? {
              ...(payload.label !== undefined ? { label: payload.label } : {}),
              ...(payload.tenantId !== undefined ? { tenant_id: payload.tenantId } : {}),
            }
          : {},
      method: "POST",
    }),
  );
  const nodeKey = sanitizeNodeKey(response?.node_key);
  const secret = readString(response, "secret");

  if (!nodeKey || !secret) {
    throw new Error("Fugue node key response was malformed.");
  }

  return {
    nodeKey,
    secret,
  };
}

export async function revokeFugueNodeKey(
  accessToken: string,
  id: string,
) {
  const response = asRecord(
    await fugueRequest(`/v1/node-keys/${encodeURIComponent(id)}/revoke`, {
      accessToken,
      body: {},
      method: "POST",
    }),
  );
  const nodeKey = sanitizeNodeKey(response?.node_key);

  if (!nodeKey) {
    throw new Error("Fugue node key revoke response was malformed.");
  }

  return nodeKey;
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

export async function patchFugueProject(
  accessToken: string,
  id: string,
  payload: {
    description?: string;
    name?: string;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/projects/${encodeURIComponent(id)}`, {
      accessToken,
      body: {
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
      },
      method: "PATCH",
    }),
  );
  const project = sanitizeProject(response?.project);

  if (!project) {
    throw new Error("Fugue project update response was malformed.");
  }

  return project;
}

export async function deleteFugueProject(accessToken: string, id: string) {
  const response = asRecord(
    await fugueRequest(`/v1/projects/${encodeURIComponent(id)}`, {
      accessToken,
      method: "DELETE",
    }),
  );
  const project = sanitizeProject(response?.project);

  if (!project) {
    throw new Error("Fugue project delete response was malformed.");
  }

  return project;
}

export async function importFugueGitHubApp(
  accessToken: string,
  payload: {
    branch?: string;
    buildStrategy?: string;
    buildContextDir?: string;
    dockerfilePath?: string;
    name?: string;
    project?: {
      description?: string;
      name: string;
    };
    projectId?: string;
    repoUrl: string;
    runtimeId?: string;
    servicePort?: number;
    sourceDir?: string;
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
        ...(payload.project
          ? {
              project: {
                ...(payload.project.description
                  ? { description: payload.project.description }
                  : {}),
                name: payload.project.name,
              },
            }
          : {}),
        ...(payload.branch ? { branch: payload.branch } : {}),
        ...(payload.buildStrategy ? { build_strategy: payload.buildStrategy } : {}),
        ...(payload.sourceDir ? { source_dir: payload.sourceDir } : {}),
        ...(payload.dockerfilePath ? { dockerfile_path: payload.dockerfilePath } : {}),
        ...(payload.buildContextDir ? { build_context_dir: payload.buildContextDir } : {}),
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.runtimeId ? { runtime_id: payload.runtimeId } : {}),
        ...(typeof payload.servicePort === "number"
          ? { service_port: payload.servicePort }
          : {}),
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

export async function getFugueNodeKeys(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/node-keys", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.node_keys) ? payload.node_keys : [];
  return items.map(sanitizeNodeKey).filter((item): item is FugueNodeKey => Boolean(item));
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

export async function getFugueApp(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}`, {
      accessToken,
    }),
  );

  return sanitizeApp(payload?.app);
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

export async function getFugueAppRouteAvailability(
  accessToken: string,
  appId: string,
  hostname: string,
) {
  const searchParams = new URLSearchParams();
  searchParams.set("hostname", hostname);
  const payload = asRecord(
    await fugueRequest(
      `/v1/apps/${encodeURIComponent(appId)}/route/availability?${searchParams.toString()}`,
      {
        accessToken,
      },
    ),
  );

  return {
    availability: sanitizeAppRouteAvailability(payload?.availability),
  } satisfies FugueAppRouteAvailabilityResult;
}

export async function patchFugueAppRoute(
  accessToken: string,
  appId: string,
  payload: {
    hostname: string;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/route`, {
      accessToken,
      body: {
        hostname: payload.hostname,
      },
      method: "PATCH",
    }),
  );

  return {
    alreadyCurrent: Boolean(response?.already_current),
    app: sanitizeApp(response?.app),
    availability: sanitizeAppRouteAvailability(response?.availability),
  } satisfies FugueAppRouteResult;
}

export async function getFugueAppDomains(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/domains`, {
      accessToken,
    }),
  );

  return {
    domains: (Array.isArray(payload?.domains) ? payload.domains : [])
      .map(sanitizeAppDomain)
      .filter((item): item is FugueAppDomain => Boolean(item)),
  } satisfies FugueAppDomainListResult;
}

export async function getFugueAppDomainAvailability(
  accessToken: string,
  appId: string,
  hostname: string,
) {
  const searchParams = new URLSearchParams();
  searchParams.set("hostname", hostname);
  const payload = asRecord(
    await fugueRequest(
      `/v1/apps/${encodeURIComponent(appId)}/domains/availability?${searchParams.toString()}`,
      {
        accessToken,
      },
    ),
  );

  return {
    availability: sanitizeAppDomainAvailability(payload?.availability),
  } satisfies FugueAppDomainAvailabilityResult;
}

export async function createFugueAppDomain(
  accessToken: string,
  appId: string,
  payload: {
    hostname: string;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/domains`, {
      accessToken,
      body: {
        hostname: payload.hostname,
      },
      method: "POST",
    }),
  );

  return {
    alreadyCurrent: Boolean(response?.already_current),
    availability: sanitizeAppDomainAvailability(response?.availability),
    domain: sanitizeAppDomain(response?.domain),
  } satisfies FugueAppDomainResult;
}

export async function verifyFugueAppDomain(
  accessToken: string,
  appId: string,
  payload: {
    hostname: string;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/domains/verify`, {
      accessToken,
      body: {
        hostname: payload.hostname,
      },
      method: "POST",
    }),
  );

  return {
    domain: sanitizeAppDomain(response?.domain),
    verified: Boolean(response?.verified),
  } satisfies FugueAppDomainVerifyResult;
}

export async function deleteFugueAppDomain(
  accessToken: string,
  appId: string,
  hostname: string,
) {
  const searchParams = new URLSearchParams();
  searchParams.set("hostname", hostname);
  const response = asRecord(
    await fugueRequest(
      `/v1/apps/${encodeURIComponent(appId)}/domains?${searchParams.toString()}`,
      {
        accessToken,
        method: "DELETE",
      },
    ),
  );

  return {
    domain: sanitizeAppDomain(response?.domain),
  } satisfies FugueAppDomainDeleteResult;
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

export async function getFugueAppFilesystemTree(
  accessToken: string,
  appId: string,
  options?: {
    depth?: number;
    path?: string;
    pod?: string;
  },
) {
  const searchParams = new URLSearchParams();

  if (options?.depth !== undefined) {
    searchParams.set("depth", String(options.depth));
  }

  if (options?.path) {
    searchParams.set("path", options.path);
  }

  if (options?.pod) {
    searchParams.set("pod", options.pod);
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/filesystem/tree${suffix}`, {
      accessToken,
    }),
  );

  return {
    component: readString(payload, "component"),
    depth: readNumber(payload, "depth"),
    entries: (Array.isArray(payload?.entries) ? payload.entries : [])
      .map(sanitizeFilesystemEntry)
      .filter((item): item is FugueFilesystemEntry => Boolean(item)),
    path: readString(payload, "path"),
    pod: readString(payload, "pod"),
    workspaceRoot: readString(payload, "workspace_root"),
  } satisfies FugueAppFilesystemTreeResult;
}

export async function getFugueAppFilesystemFile(
  accessToken: string,
  appId: string,
  options: {
    maxBytes?: number;
    path: string;
    pod?: string;
  },
) {
  const searchParams = new URLSearchParams();
  searchParams.set("path", options.path);

  if (options.maxBytes !== undefined) {
    searchParams.set("max_bytes", String(options.maxBytes));
  }

  if (options.pod) {
    searchParams.set("pod", options.pod);
  }

  const payload = asRecord(
    await fugueRequest(
      `/v1/apps/${encodeURIComponent(appId)}/filesystem/file?${searchParams.toString()}`,
      {
        accessToken,
      },
    ),
  );

  return {
    component: readString(payload, "component"),
    content: readString(payload, "content") ?? "",
    encoding: readString(payload, "encoding"),
    mode: readNumber(payload, "mode"),
    modifiedAt: readString(payload, "modified_at"),
    path: readString(payload, "path"),
    pod: readString(payload, "pod"),
    size: readNumber(payload, "size"),
    truncated: readBoolean(payload, "truncated") ?? false,
    workspaceRoot: readString(payload, "workspace_root"),
  } satisfies FugueAppFilesystemFileResult;
}

export async function putFugueAppFilesystemFile(
  accessToken: string,
  appId: string,
  payload: {
    content: string;
    encoding?: "base64" | "utf-8";
    mkdirParents?: boolean;
    mode?: number;
    path: string;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/filesystem/file`, {
      accessToken,
      body: {
        content: payload.content,
        ...(payload.encoding ? { encoding: payload.encoding } : {}),
        ...(payload.mkdirParents !== undefined ? { mkdir_parents: payload.mkdirParents } : {}),
        ...(payload.mode !== undefined ? { mode: payload.mode } : {}),
        path: payload.path,
      },
      method: "PUT",
    }),
  );

  return {
    component: readString(response, "component"),
    deleted: false,
    kind: "file",
    mode: readNumber(response, "mode"),
    modifiedAt: readString(response, "modified_at"),
    path: readString(response, "path"),
    pod: readString(response, "pod"),
    size: readNumber(response, "size"),
    workspaceRoot: readString(response, "workspace_root"),
  } satisfies FugueAppFilesystemMutationResult;
}

export async function createFugueAppFilesystemDirectory(
  accessToken: string,
  appId: string,
  payload: {
    mode?: number;
    parents?: boolean;
    path: string;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/filesystem/directory`, {
      accessToken,
      body: {
        ...(payload.mode !== undefined ? { mode: payload.mode } : {}),
        ...(payload.parents !== undefined ? { parents: payload.parents } : {}),
        path: payload.path,
      },
      method: "POST",
    }),
  );

  return {
    component: readString(response, "component"),
    deleted: false,
    kind: readString(response, "kind"),
    mode: readNumber(response, "mode"),
    modifiedAt: readString(response, "modified_at"),
    path: readString(response, "path"),
    pod: readString(response, "pod"),
    size: readNumber(response, "size"),
    workspaceRoot: readString(response, "workspace_root"),
  } satisfies FugueAppFilesystemMutationResult;
}

export async function deleteFugueAppFilesystemPath(
  accessToken: string,
  appId: string,
  options: {
    path: string;
    recursive?: boolean;
  },
) {
  const searchParams = new URLSearchParams();
  searchParams.set("path", options.path);

  if (options.recursive !== undefined) {
    searchParams.set("recursive", String(options.recursive));
  }

  const payload = asRecord(
    await fugueRequest(
      `/v1/apps/${encodeURIComponent(appId)}/filesystem?${searchParams.toString()}`,
      {
        accessToken,
        method: "DELETE",
      },
    ),
  );

  return {
    component: readString(payload, "component"),
    deleted: readBoolean(payload, "deleted") ?? false,
    kind: null,
    mode: readNumber(payload, "mode"),
    modifiedAt: readString(payload, "modified_at"),
    path: readString(payload, "path"),
    pod: readString(payload, "pod"),
    size: readNumber(payload, "size"),
    workspaceRoot: readString(payload, "workspace_root"),
  } satisfies FugueAppFilesystemMutationResult;
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

export async function rebuildFugueApp(
  accessToken: string,
  appId: string,
  options?: {
    branch?: string;
    buildContextDir?: string;
    dockerfilePath?: string;
    sourceDir?: string;
  },
) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/rebuild`, {
      accessToken,
      body: {
        ...(options?.branch !== undefined ? { branch: options.branch } : {}),
        ...(options?.sourceDir !== undefined ? { source_dir: options.sourceDir } : {}),
        ...(options?.dockerfilePath !== undefined
          ? { dockerfile_path: options.dockerfilePath }
          : {}),
        ...(options?.buildContextDir !== undefined
          ? { build_context_dir: options.buildContextDir }
          : {}),
      },
      method: "POST",
    }),
  );

  return {
    build: asRecord(payload?.build),
    operation: sanitizeOperation(payload?.operation),
  };
}

export async function startFugueApp(accessToken: string, appId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/apps/${encodeURIComponent(appId)}/scale`, {
      accessToken,
      body: {
        replicas: 1,
      },
      method: "POST",
    }),
  );

  return {
    operation: sanitizeOperation(payload?.operation),
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

export async function getFugueRuntimeSharing(accessToken: string, runtimeId: string) {
  const payload = asRecord(
    await fugueRequest(`/v1/runtimes/${encodeURIComponent(runtimeId)}/sharing`, {
      accessToken,
    }),
  );
  const grants = Array.isArray(payload?.grants) ? payload.grants : [];

  return {
    grants: grants
      .map(sanitizeRuntimeAccessGrant)
      .filter((item): item is FugueRuntimeAccessGrant => Boolean(item)),
    runtime: sanitizeRuntime(payload?.runtime),
  };
}

export async function grantFugueRuntimeAccess(
  accessToken: string,
  runtimeId: string,
  payload: {
    tenantId: string;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/runtimes/${encodeURIComponent(runtimeId)}/sharing/grants`, {
      accessToken,
      body: {
        tenant_id: payload.tenantId,
      },
      method: "POST",
    }),
  );

  return {
    grant: sanitizeRuntimeAccessGrant(response?.grant),
  };
}

export async function revokeFugueRuntimeAccess(
  accessToken: string,
  runtimeId: string,
  tenantId: string,
) {
  const response = asRecord(
    await fugueRequest(
      `/v1/runtimes/${encodeURIComponent(runtimeId)}/sharing/grants/${encodeURIComponent(tenantId)}`,
      {
        accessToken,
        method: "DELETE",
      },
    ),
  );

  return {
    removed: Boolean(readBoolean(response, "removed")),
  };
}

export async function setFugueRuntimePoolMode(
  accessToken: string,
  runtimeId: string,
  payload: {
    poolMode: string;
  },
) {
  const response = asRecord(
    await fugueRequest(`/v1/runtimes/${encodeURIComponent(runtimeId)}/pool-mode`, {
      accessToken,
      body: {
        pool_mode: payload.poolMode,
      },
      method: "POST",
    }),
  );

  return {
    nodeReconciled: Boolean(readBoolean(response, "node_reconciled")),
    runtime: sanitizeRuntime(response?.runtime),
  };
}

export async function getFugueClusterNodes(accessToken: string) {
  const payload = asRecord(
    await fugueRequest("/v1/cluster/nodes", {
      accessToken,
    }),
  );
  const items = Array.isArray(payload?.cluster_nodes) ? payload.cluster_nodes : [];
  return items
    .map(sanitizeClusterNode)
    .filter((item): item is FugueClusterNode => Boolean(item));
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
