import "server-only";

import createClient from "openapi-fetch";

import { getFugueEnv } from "@/lib/fugue/env";
import type { GitHubRepoVisibility } from "@/lib/github/repository";

import type { components, paths } from "@/lib/fugue/openapi.generated";

type Primitive = bigint | boolean | null | number | string | symbol | undefined;
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : S;
type CamelizeDeep<T> = T extends Primitive
  ? T
  : T extends ReadonlyArray<infer Item>
    ? CamelizeDeep<Item>[]
    : T extends Array<infer Item>
      ? CamelizeDeep<Item>[]
      : T extends Record<string, unknown>
        ? {
            [K in keyof T as K extends string ? CamelCase<K> : K]: CamelizeDeep<T[K]>;
          }
        : T;

type Schemas = components["schemas"];
type CamelizedSchema<Name extends keyof Schemas> = Simplify<CamelizeDeep<Schemas[Name]>>;

const PRESERVE_DICTIONARY_KEYS = new Set(["conditions", "env", "labels", "metadata"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function camelizeKey(value: string) {
  return value.replace(/_([a-z])/g, (_match, segment: string) => segment.toUpperCase());
}

function camelizeValue<T>(value: T, parentKey?: string): CamelizeDeep<T> {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeValue(item)) as CamelizeDeep<T>;
  }

  if (!isPlainObject(value)) {
    return value as CamelizeDeep<T>;
  }

  const preserveKeys = Boolean(parentKey && PRESERVE_DICTIONARY_KEYS.has(parentKey));
  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    const nextKey = preserveKeys ? key : camelizeKey(key);
    output[nextKey] = camelizeValue(item, key);
  }

  return output as CamelizeDeep<T>;
}

function camelizeData<T>(value: T) {
  return camelizeValue(value);
}

function readErrorDetail(error: unknown) {
  if (isPlainObject(error) && typeof error.error === "string" && error.error.trim()) {
    return error.error.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return null;
}

async function expectData<T>(
  schemaPath: string,
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
) {
  const result = await request;

  if (result.data !== undefined) {
    return result.data;
  }

  const detail = readErrorDetail(result.error);
  const suffix = detail ? ` ${detail.slice(0, 220)}` : "";
  throw new Error(
    `Fugue request failed for ${schemaPath}: ${result.response.status} ${result.response.statusText}.${suffix}`,
  );
}

function getClient(accessToken: string) {
  const env = getFugueEnv();

  return createClient<paths>({
    baseUrl: env.apiUrl,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function readNullableString(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: string[] | undefined | null) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readStringMap(value: Record<string, string> | undefined | null) {
  if (!value) {
    return {} as Record<string, string>;
  }

  return { ...value };
}

function buildTenantView(tenant: CamelizedSchema<"Tenant">) {
  return {
    createdAt: readNullableString(tenant.createdAt),
    id: tenant.id,
    name: tenant.name,
    slug: readNullableString(tenant.slug),
    status: readNullableString(tenant.status),
    updatedAt: readNullableString(tenant.updatedAt),
  };
}

function buildProjectView(project: CamelizedSchema<"Project">) {
  return {
    createdAt: readNullableString(project.createdAt),
    description: readNullableString(project.description),
    id: project.id,
    name: project.name,
    slug: readNullableString(project.slug),
    tenantId: readNullableString(project.tenantId),
    updatedAt: readNullableString(project.updatedAt),
  };
}

function buildApiKeyView(apiKey: CamelizedSchema<"APIKey">) {
  return {
    createdAt: readNullableString(apiKey.createdAt),
    disabledAt: readNullableString(apiKey.disabledAt),
    id: apiKey.id,
    label: apiKey.label,
    lastUsedAt: readNullableString(apiKey.lastUsedAt),
    prefix: readNullableString(apiKey.prefix),
    scopes: readStringArray(apiKey.scopes),
    status: readNullableString(apiKey.status),
    tenantId: readNullableString(apiKey.tenantId),
  };
}

function buildNodeKeyView(nodeKey: CamelizedSchema<"NodeKey">) {
  return {
    createdAt: readNullableString(nodeKey.createdAt),
    hash: readNullableString(nodeKey.hash),
    id: nodeKey.id,
    label: nodeKey.label,
    lastUsedAt: readNullableString(nodeKey.lastUsedAt),
    prefix: readNullableString(nodeKey.prefix),
    revokedAt: readNullableString(nodeKey.revokedAt),
    status: readNullableString(nodeKey.status),
    tenantId: readNullableString(nodeKey.tenantId),
    updatedAt: readNullableString(nodeKey.updatedAt),
  };
}

function buildAppFileView(file: CamelizedSchema<"AppFile">) {
  return {
    content: readNullableString(file.content),
    mode: readNullableNumber(file.mode),
    path: file.path,
    secret: file.secret ?? false,
  };
}

function buildAppWorkspaceView(workspace?: CamelizedSchema<"AppWorkspaceSpec"> | null) {
  return {
    mountPath: readNullableString(workspace?.mountPath),
  };
}

function buildFilesystemEntryView(entry: CamelizedSchema<"AppFilesystemEntry">) {
  return {
    hasChildren: entry.hasChildren ?? false,
    kind: entry.kind,
    mode: readNullableNumber(entry.mode),
    modifiedAt: readNullableString(entry.modifiedAt),
    name: entry.name,
    path: entry.path,
    size: readNullableNumber(entry.size),
  };
}

function buildAppTechnologyView(technology: CamelizedSchema<"AppTechnology">) {
  return {
    kind: technology.kind,
    name: technology.name,
    slug: technology.slug,
    source: readNullableString(technology.source),
  };
}

function buildResourceSpecView(resource?: CamelizedSchema<"ResourceSpec"> | null) {
  return {
    cpuMillicores: readNullableNumber(resource?.cpuMillicores) ?? 0,
    memoryMebibytes: readNullableNumber(resource?.memoryMebibytes) ?? 0,
  };
}

function buildResourceUsageView(resource: CamelizedSchema<"ResourceUsage">) {
  return {
    cpuMillicores: readNullableNumber(resource.cpuMillicores),
    ephemeralStorageBytes: readNullableNumber(resource.ephemeralStorageBytes),
    memoryBytes: readNullableNumber(resource.memoryBytes),
  };
}

function toResourceUsage(resource?: CamelizedSchema<"ResourceUsage"> | null) {
  if (!resource) {
    return null;
  }

  const view = buildResourceUsageView(resource);

  return view.cpuMillicores !== null ||
    view.memoryBytes !== null ||
    view.ephemeralStorageBytes !== null
    ? view
    : null;
}

function buildBillingPriceBookView(priceBook: CamelizedSchema<"BillingPriceBook">) {
  return {
    currency: priceBook.currency,
    hoursPerMonth: priceBook.hoursPerMonth,
    cpuMicroCentsPerMillicoreHour: priceBook.cpuMicrocentsPerMillicoreHour,
    memoryMicroCentsPerMibHour: priceBook.memoryMicrocentsPerMibHour,
  };
}

function buildBillingEventView(event: CamelizedSchema<"TenantBillingEvent">) {
  return {
    amountMicroCents: event.amountMicrocents,
    balanceAfterMicroCents: event.balanceAfterMicrocents,
    createdAt: readNullableString(event.createdAt),
    id: event.id,
    metadata: readStringMap(event.metadata),
    tenantId: readNullableString(event.tenantId),
    type: event.type,
  };
}

function buildBillingSummaryView(summary: CamelizedSchema<"TenantBillingSummary">) {
  return {
    balanceMicroCents: summary.balanceMicrocents,
    balanceRestricted: summary.balanceRestricted,
    byoVpsFree: summary.byoVpsFree,
    currentUsage: toResourceUsage(summary.currentUsage),
    defaultAppResources: buildResourceSpecView(summary.defaultAppResources),
    defaultPostgresResources: buildResourceSpecView(summary.defaultPostgresResources),
    events: (summary.events ?? []).map(buildBillingEventView),
    hourlyRateMicroCents: summary.hourlyRateMicrocents,
    lastAccruedAt: readNullableString(summary.lastAccruedAt),
    managedAvailable: buildResourceSpecView(summary.managedAvailable),
    managedCap: buildResourceSpecView(summary.managedCap),
    managedCommitted: buildResourceSpecView(summary.managedCommitted),
    monthlyEstimateMicroCents: summary.monthlyEstimateMicrocents,
    overCap: summary.overCap,
    priceBook: buildBillingPriceBookView(summary.priceBook),
    runwayHours: readNullableNumber(summary.runwayHours),
    status: summary.status,
    statusReason: readNullableString(summary.statusReason),
    tenantId: summary.tenantId,
    updatedAt: readNullableString(summary.updatedAt),
  };
}

function buildAppSourceView(source?: CamelizedSchema<"AppSource"> | null) {
  return {
    buildStrategy: readNullableString(source?.buildStrategy),
    composeService: readNullableString(source?.composeService),
    commitSha: readNullableString(source?.commitSha),
    commitCommittedAt: readNullableString(source?.commitCommittedAt),
    detectedProvider: readNullableString(source?.detectedProvider),
    detectedStack: readNullableString(source?.detectedStack),
    dockerfilePath: readNullableString(source?.dockerfilePath),
    imageRef: readNullableString(source?.imageRef),
    repoBranch: readNullableString(source?.repoBranch),
    repoUrl: readNullableString(source?.repoUrl),
    resolvedImageRef: readNullableString(source?.resolvedImageRef),
    sourceDir: readNullableString(source?.sourceDir),
    type: readNullableString(source?.type),
    uploadFilename: readNullableString(source?.uploadFilename),
  };
}

function buildBackingServiceView(service: CamelizedSchema<"BackingService">) {
  const postgres = service.spec?.postgres;

  return {
    createdAt: readNullableString(service.createdAt),
    currentResourceUsage: toResourceUsage(service.currentResourceUsage),
    description: readNullableString(service.description),
    id: service.id,
    name: service.name,
    ownerAppId: readNullableString(service.ownerAppId),
    projectId: readNullableString(service.projectId),
    provisioner: readNullableString(service.provisioner),
    spec: {
      postgres: postgres
        ? {
            database: readNullableString(postgres.database),
            image: readNullableString(postgres.image),
            password: readNullableString(postgres.password),
            resources: postgres.resources ? buildResourceSpecView(postgres.resources) : null,
            serviceName: readNullableString(postgres.serviceName),
            storagePath: readNullableString(postgres.storagePath),
            user: readNullableString(postgres.user),
          }
        : null,
    },
    status: readNullableString(service.status),
    tenantId: readNullableString(service.tenantId),
    type: readNullableString(service.type),
    updatedAt: readNullableString(service.updatedAt),
  };
}

function buildServiceBindingView(binding: CamelizedSchema<"ServiceBinding">) {
  return {
    alias: readNullableString(binding.alias),
    appId: readNullableString(binding.appId),
    createdAt: readNullableString(binding.createdAt),
    env: readStringMap(binding.env),
    id: binding.id,
    serviceId: readNullableString(binding.serviceId),
    tenantId: readNullableString(binding.tenantId),
    updatedAt: readNullableString(binding.updatedAt),
  };
}

function buildAppView(app: CamelizedSchema<"App">) {
  const route = app.route;
  const spec = app.spec;
  const status = app.status;
  const replicas = readNullableNumber(spec?.replicas);

  return {
    id: app.id,
    tenantId: readNullableString(app.tenantId),
    projectId: readNullableString(app.projectId),
    name: app.name,
    createdAt: readNullableString(app.createdAt),
    currentResourceUsage: toResourceUsage(app.currentResourceUsage),
    updatedAt: readNullableString(app.updatedAt),
    route: {
      baseDomain: readNullableString(route?.baseDomain),
      hostname: readNullableString(route?.hostname),
      publicUrl: readNullableString(route?.publicUrl),
      servicePort: readNullableNumber(route?.servicePort),
    },
    source: buildAppSourceView(app.source),
    spec: {
      runtimeId: readNullableString(spec?.runtimeId),
      replicas,
      disabled: (replicas ?? 0) === 0,
      resources: spec?.resources ? buildResourceSpecView(spec.resources) : null,
      workspace: spec?.workspace ? buildAppWorkspaceView(spec.workspace) : null,
    },
    status: {
      phase: readNullableString(status?.phase),
      currentRuntimeId: readNullableString(status?.currentRuntimeId),
      currentReplicas: readNullableNumber(status?.currentReplicas),
      lastOperationId: readNullableString(status?.lastOperationId),
      lastMessage: readNullableString(status?.lastMessage),
      updatedAt: readNullableString(status?.updatedAt),
    },
    bindings: (app.bindings ?? []).map(buildServiceBindingView),
    backingServices: (app.backingServices ?? []).map(buildBackingServiceView),
    techStack: (app.techStack ?? []).map(buildAppTechnologyView),
  };
}

function buildAppRouteAvailabilityView(
  availability?: CamelizedSchema<"AppRouteAvailability"> | null,
) {
  return {
    available: availability?.available ?? false,
    baseDomain: readNullableString(availability?.baseDomain),
    current: availability?.current ?? false,
    hostname: readNullableString(availability?.hostname),
    input: readNullableString(availability?.input),
    label: readNullableString(availability?.label),
    publicUrl: readNullableString(availability?.publicUrl),
    reason: readNullableString(availability?.reason),
    valid: availability?.valid ?? false,
  };
}

function buildAppDomainView(domain: CamelizedSchema<"AppDomain">) {
  return {
    appId: readNullableString(domain.appId),
    createdAt: readNullableString(domain.createdAt),
    hostname: domain.hostname,
    lastCheckedAt: readNullableString(domain.lastCheckedAt),
    lastMessage: readNullableString(domain.lastMessage),
    routeTarget: readNullableString(domain.routeTarget),
    status: readNullableString(domain.status),
    tenantId: readNullableString(domain.tenantId),
    tlsLastCheckedAt: readNullableString(domain.tlsLastCheckedAt),
    tlsLastMessage: readNullableString(domain.tlsLastMessage),
    tlsReadyAt: readNullableString(domain.tlsReadyAt),
    tlsStatus: readNullableString(domain.tlsStatus),
    updatedAt: readNullableString(domain.updatedAt),
    verificationTxtName: readNullableString(domain.verificationTxtName),
    verificationTxtValue: readNullableString(domain.verificationTxtValue),
    verifiedAt: readNullableString(domain.verifiedAt),
  };
}

function buildAppDomainAvailabilityView(
  availability?: CamelizedSchema<"AppDomainAvailability"> | null,
) {
  return {
    available: availability?.available ?? false,
    current: availability?.current ?? false,
    hostname: readNullableString(availability?.hostname),
    input: readNullableString(availability?.input),
    reason: readNullableString(availability?.reason),
    valid: availability?.valid ?? false,
  };
}

function buildRuntimeView(runtime: CamelizedSchema<"Runtime">) {
  return {
    id: runtime.id,
    tenantId: readNullableString(runtime.tenantId),
    name: readNullableString(runtime.name),
    machineName: readNullableString(runtime.machineName),
    labels: readStringMap(runtime.labels),
    type: readNullableString(runtime.type),
    accessMode: readNullableString(runtime.accessMode),
    poolMode: readNullableString(runtime.poolMode),
    connectionMode: readNullableString(runtime.connectionMode),
    status: readNullableString(runtime.status),
    endpoint: readNullableString(runtime.endpoint),
    clusterNodeName: readNullableString(runtime.clusterNodeName),
    fingerprintPrefix: readNullableString(runtime.fingerprintPrefix),
    lastSeenAt: readNullableString(runtime.lastSeenAt),
    lastHeartbeatAt: readNullableString(runtime.lastHeartbeatAt),
    createdAt: readNullableString(runtime.createdAt),
    updatedAt: readNullableString(runtime.updatedAt),
  };
}

function buildRuntimeAccessGrantView(grant: CamelizedSchema<"RuntimeAccessGrant">) {
  return {
    runtimeId: grant.runtimeId,
    tenantId: grant.tenantId,
    createdAt: readNullableString(grant.createdAt),
    updatedAt: readNullableString(grant.updatedAt),
  };
}

function buildClusterNodeConditionView(condition: CamelizedSchema<"ClusterNodeCondition">) {
  return {
    lastTransitionAt: readNullableString(condition.lastTransitionAt),
    message: readNullableString(condition.message),
    reason: readNullableString(condition.reason),
    status: readNullableString(condition.status),
  };
}

function buildClusterNodeConditionMapView(
  conditions?: Record<string, CamelizedSchema<"ClusterNodeCondition">> | null,
) {
  const output: Record<string, ReturnType<typeof buildClusterNodeConditionView>> = {};

  if (!conditions) {
    return output;
  }

  for (const [key, value] of Object.entries(conditions)) {
    if (!key.trim()) {
      continue;
    }

    output[key] = buildClusterNodeConditionView(value);
  }

  return output;
}

function buildClusterNodeCpuStatsView(stats?: CamelizedSchema<"ClusterNodeCPUStats"> | null) {
  if (!stats) {
    return null;
  }

  return {
    allocatableMilliCores: readNullableNumber(stats.allocatableMillicores),
    capacityMilliCores: readNullableNumber(stats.capacityMillicores),
    usagePercent: readNullableNumber(stats.usagePercent),
    usedMilliCores: readNullableNumber(stats.usedMillicores),
  };
}

function buildClusterNodeMemoryStatsView(
  stats?: CamelizedSchema<"ClusterNodeMemoryStats"> | null,
) {
  if (!stats) {
    return null;
  }

  return {
    allocatableBytes: readNullableNumber(stats.allocatableBytes),
    capacityBytes: readNullableNumber(stats.capacityBytes),
    usagePercent: readNullableNumber(stats.usagePercent),
    usedBytes: readNullableNumber(stats.usedBytes),
  };
}

function buildClusterNodeStorageStatsView(
  stats?: CamelizedSchema<"ClusterNodeStorageStats"> | null,
) {
  if (!stats) {
    return null;
  }

  return {
    allocatableBytes: readNullableNumber(stats.allocatableBytes),
    capacityBytes: readNullableNumber(stats.capacityBytes),
    usagePercent: readNullableNumber(stats.usagePercent),
    usedBytes: readNullableNumber(stats.usedBytes),
  };
}

function buildClusterNodeWorkloadPodView(
  pod: CamelizedSchema<"ClusterNodeWorkloadPod">,
) {
  return {
    name: pod.name,
    phase: readNullableString(pod.phase),
  };
}

function buildClusterNodeWorkloadView(
  workload: CamelizedSchema<"ClusterNodeWorkload">,
) {
  const pods = (workload.pods ?? []).map(buildClusterNodeWorkloadPodView);

  return {
    id: workload.id,
    kind: workload.kind,
    name: workload.name,
    namespace: readNullableString(workload.namespace),
    ownerAppId: readNullableString(workload.ownerAppId),
    podCount: readNullableNumber(workload.podCount) ?? pods.length,
    pods,
    projectId: readNullableString(workload.projectId),
    runtimeId: readNullableString(workload.runtimeId),
    serviceType: readNullableString(workload.serviceType),
    tenantId: readNullableString(workload.tenantId),
  };
}

function buildClusterNodeView(node: CamelizedSchema<"ClusterNode">) {
  return {
    conditions: buildClusterNodeConditionMapView(node.conditions),
    containerRuntime: readNullableString(node.containerRuntime),
    cpu: buildClusterNodeCpuStatsView(node.cpu),
    createdAt: readNullableString(node.createdAt),
    ephemeralStorage: buildClusterNodeStorageStatsView(node.ephemeralStorage),
    externalIp: readNullableString(node.externalIp),
    internalIp: readNullableString(node.internalIp),
    publicIp: readNullableString(node.publicIp),
    kernelVersion: readNullableString(node.kernelVersion),
    kubeletVersion: readNullableString(node.kubeletVersion),
    memory: buildClusterNodeMemoryStatsView(node.memory),
    name: node.name,
    osImage: readNullableString(node.osImage),
    region: readNullableString(node.region),
    roles: readStringArray(node.roles),
    runtimeId: readNullableString(node.runtimeId),
    status: readNullableString(node.status),
    tenantId: readNullableString(node.tenantId),
    workloads: (node.workloads ?? []).map(buildClusterNodeWorkloadView),
    zone: readNullableString(node.zone),
  };
}

function buildOperationView(operation: CamelizedSchema<"Operation">) {
  return {
    id: operation.id,
    tenantId: readNullableString(operation.tenantId),
    type: readNullableString(operation.type),
    status: readNullableString(operation.status),
    executionMode: readNullableString(operation.executionMode),
    requestedByType: readNullableString(operation.requestedByType),
    requestedById: readNullableString(operation.requestedById),
    appId: readNullableString(operation.appId),
    sourceRuntimeId: readNullableString(operation.sourceRuntimeId),
    targetRuntimeId: readNullableString(operation.targetRuntimeId),
    desiredSource: operation.desiredSource ? buildAppSourceView(operation.desiredSource) : null,
    resultMessage: readNullableString(operation.resultMessage),
    errorMessage: readNullableString(operation.errorMessage),
    createdAt: readNullableString(operation.createdAt),
    updatedAt: readNullableString(operation.updatedAt),
    startedAt: readNullableString(operation.startedAt),
    completedAt: readNullableString(operation.completedAt),
  };
}

function buildAuditEventView(event: CamelizedSchema<"AuditEvent">) {
  return {
    id: event.id,
    tenantId: readNullableString(event.tenantId),
    actorType: readNullableString(event.actorType),
    actorId: readNullableString(event.actorId),
    action: readNullableString(event.action),
    targetType: readNullableString(event.targetType),
    targetId: readNullableString(event.targetId),
    createdAt: readNullableString(event.createdAt),
    metadata: readStringMap(event.metadata),
  };
}

function buildImportResultView(
  response: CamelizedSchema<"ImportGitHubResponse">,
  idempotencyKey?: string,
) {
  return {
    app: response.app ? buildAppView(response.app) : null,
    idempotencyKey: readNullableString(response.idempotency?.key) ?? idempotencyKey ?? null,
    operation: response.operation ? buildOperationView(response.operation) : null,
    replayed: response.idempotency?.replayed ?? false,
    requestInProgress: response.requestInProgress ?? false,
  };
}

function buildAppEnvResultView(response: CamelizedSchema<"AppEnvResponse">) {
  return {
    alreadyCurrent: response.alreadyCurrent ?? false,
    env: readStringMap(response.env),
    operation: response.operation ? buildOperationView(response.operation) : null,
  };
}

function buildAppRouteAvailabilityResultView(
  response: CamelizedSchema<"AppRouteAvailabilityResponse">,
) {
  return {
    availability: buildAppRouteAvailabilityView(response.availability),
  };
}

function buildAppRouteResultView(response: CamelizedSchema<"AppRoutePatchResponse">) {
  return {
    alreadyCurrent: response.alreadyCurrent ?? false,
    app: response.app ? buildAppView(response.app) : null,
    availability: buildAppRouteAvailabilityView(response.availability),
  };
}

function buildAppDomainListResultView(response: CamelizedSchema<"AppDomainListResponse">) {
  return {
    domains: (response.domains ?? []).map(buildAppDomainView),
  };
}

function buildAppDomainAvailabilityResultView(
  response: CamelizedSchema<"AppDomainAvailabilityResponse">,
) {
  return {
    availability: buildAppDomainAvailabilityView(response.availability),
  };
}

function buildAppDomainResultView(response: CamelizedSchema<"AppDomainPutResponse">) {
  return {
    alreadyCurrent: response.alreadyCurrent ?? false,
    availability: buildAppDomainAvailabilityView(response.availability),
    domain: response.domain ? buildAppDomainView(response.domain) : null,
  };
}

function buildAppDomainDeleteResultView(response: CamelizedSchema<"AppDomainResponse">) {
  return {
    domain: response.domain ? buildAppDomainView(response.domain) : null,
  };
}

function buildAppDomainVerifyResultView(
  response: CamelizedSchema<"AppDomainVerifyResponse">,
) {
  return {
    domain: response.domain ? buildAppDomainView(response.domain) : null,
    verified: response.verified ?? false,
  };
}

function buildAppFilesResultView(response: CamelizedSchema<"AppFilesResponse">) {
  return {
    alreadyCurrent: response.alreadyCurrent ?? false,
    files: (response.files ?? []).map(buildAppFileView),
    operation: response.operation ? buildOperationView(response.operation) : null,
  };
}

function buildAppFilesystemTreeResultView(
  response: CamelizedSchema<"AppFilesystemTreeResponse">,
) {
  return {
    component: readNullableString(response.component),
    depth: readNullableNumber(response.depth),
    entries: (response.entries ?? []).map(buildFilesystemEntryView),
    path: readNullableString(response.path),
    pod: readNullableString(response.pod),
    workspaceRoot: readNullableString(response.workspaceRoot),
  };
}

function buildAppFilesystemFileResultView(
  response: CamelizedSchema<"AppFilesystemFileResponse">,
) {
  return {
    component: readNullableString(response.component),
    content: readNullableString(response.content) ?? "",
    encoding: readNullableString(response.encoding),
    mode: readNullableNumber(response.mode),
    modifiedAt: readNullableString(response.modifiedAt),
    path: readNullableString(response.path),
    pod: readNullableString(response.pod),
    size: readNullableNumber(response.size),
    truncated: response.truncated ?? false,
    workspaceRoot: readNullableString(response.workspaceRoot),
  };
}

function buildAppFilesystemMutationResultView(
  response: CamelizedSchema<"AppFilesystemMutationResponse">,
) {
  return {
    component: readNullableString(response.component),
    deleted: response.deleted ?? false,
    kind: readNullableString(response.kind),
    mode: readNullableNumber(response.mode),
    modifiedAt: readNullableString(response.modifiedAt),
    path: readNullableString(response.path),
    pod: readNullableString(response.pod),
    size: readNullableNumber(response.size),
    workspaceRoot: readNullableString(response.workspaceRoot),
  };
}

function buildBuildLogsResultView(response: CamelizedSchema<"BuildLogsResponse">) {
  return {
    available: response.available ?? false,
    buildStrategy: readNullableString(response.buildStrategy),
    completedAt: readNullableString(response.completedAt),
    errorMessage: readNullableString(response.errorMessage),
    jobName: readNullableString(response.jobName),
    lastUpdatedAt: readNullableString(response.lastUpdatedAt),
    logs: readNullableString(response.logs) ?? "",
    operationId: readNullableString(response.operationId),
    operationStatus: readNullableString(response.operationStatus),
    resultMessage: readNullableString(response.resultMessage),
    source: readNullableString(response.source),
    startedAt: readNullableString(response.startedAt),
  };
}

function buildRuntimeLogsResultView(response: CamelizedSchema<"RuntimeLogsResponse">) {
  return {
    component: readNullableString(response.component),
    container: readNullableString(response.container),
    logs: readNullableString(response.logs) ?? "",
    namespace: readNullableString(response.namespace),
    pods: readStringArray(response.pods),
    selector: readNullableString(response.selector),
    warnings: readStringArray(response.warnings),
  };
}

function buildRuntimeSharingResultView(response: CamelizedSchema<"RuntimeSharingResponse">) {
  return {
    grants: (response.grants ?? []).map(buildRuntimeAccessGrantView),
    runtime: buildRuntimeView(response.runtime),
  };
}

function buildRuntimeAccessGrantResultView(
  response: CamelizedSchema<"RuntimeAccessGrantResponse">,
) {
  return {
    grant: response.grant ? buildRuntimeAccessGrantView(response.grant) : null,
  };
}

function buildRuntimeAccessRevokeResultView(
  response: CamelizedSchema<"RuntimeAccessRevokeResponse">,
) {
  return {
    removed: response.removed ?? false,
  };
}

function buildRuntimePoolModeResultView(
  response: CamelizedSchema<"RuntimePoolModeResponse">,
) {
  return {
    nodeReconciled: response.nodeReconciled ?? false,
    runtime: response.runtime ? buildRuntimeView(response.runtime) : null,
  };
}

function buildRestartResultView(response: CamelizedSchema<"AppRestartResponse">) {
  return {
    operation: response.operation ? buildOperationView(response.operation) : null,
    restartToken: readNullableString(response.restartToken),
  };
}

function buildRebuildResultView(response: CamelizedSchema<"AppRebuildResponse">) {
  return {
    build: response.build ? camelizeData(response.build) : null,
    operation: response.operation ? buildOperationView(response.operation) : null,
  };
}

function buildOperationResultView(response: CamelizedSchema<"OperationResponse">) {
  return {
    operation: response.operation ? buildOperationView(response.operation) : null,
  };
}

function buildDisableResultView(response: CamelizedSchema<"AppDisableResponse">) {
  return {
    alreadyDisabled: response.alreadyDisabled ?? false,
    app: response.app ? buildAppView(response.app) : null,
    operation: response.operation ? buildOperationView(response.operation) : null,
  };
}

function buildDeleteAppResultView(response: CamelizedSchema<"AppDeleteResponse">) {
  return {
    alreadyDeleting: response.alreadyDeleting ?? false,
    operation: response.operation ? buildOperationView(response.operation) : null,
  };
}

function buildNodeKeyUsageCountView(response: Record<string, unknown>) {
  const usageCount =
    typeof response.usageCount === "number" && Number.isFinite(response.usageCount)
      ? response.usageCount
      : Array.isArray(response.runtimes)
        ? response.runtimes.length
        : 0;

  return {
    usageCount,
  };
}

export type FugueTenant = ReturnType<typeof buildTenantView>;
export type FugueProject = ReturnType<typeof buildProjectView>;
export type FugueApiKey = ReturnType<typeof buildApiKeyView>;
export type FugueNodeKey = ReturnType<typeof buildNodeKeyView>;
export type FugueAppFile = ReturnType<typeof buildAppFileView>;
export type FugueAppWorkspace = ReturnType<typeof buildAppWorkspaceView>;
export type FugueFilesystemEntry = ReturnType<typeof buildFilesystemEntryView>;
export type FugueAppTechnology = ReturnType<typeof buildAppTechnologyView>;
export type FugueResourceSpec = ReturnType<typeof buildResourceSpecView>;
export type FugueResourceUsage = ReturnType<typeof buildResourceUsageView>;
export type FugueBillingPriceBook = ReturnType<typeof buildBillingPriceBookView>;
export type FugueBillingEvent = ReturnType<typeof buildBillingEventView>;
export type FugueBillingSummary = ReturnType<typeof buildBillingSummaryView>;
export type FugueAppSource = ReturnType<typeof buildAppSourceView>;
export type FugueBackingService = ReturnType<typeof buildBackingServiceView>;
export type FugueServiceBinding = ReturnType<typeof buildServiceBindingView>;
export type FugueApp = ReturnType<typeof buildAppView>;
export type FugueAppRouteAvailability = ReturnType<typeof buildAppRouteAvailabilityView>;
export type FugueAppDomain = ReturnType<typeof buildAppDomainView>;
export type FugueAppDomainAvailability = ReturnType<typeof buildAppDomainAvailabilityView>;
export type FugueRuntime = ReturnType<typeof buildRuntimeView>;
export type FugueRuntimeAccessGrant = ReturnType<typeof buildRuntimeAccessGrantView>;
export type FugueClusterNodeCondition = ReturnType<typeof buildClusterNodeConditionView>;
export type FugueClusterNodeCPUStats = NonNullable<
  ReturnType<typeof buildClusterNodeCpuStatsView>
>;
export type FugueClusterNodeMemoryStats = NonNullable<
  ReturnType<typeof buildClusterNodeMemoryStatsView>
>;
export type FugueClusterNodeStorageStats = NonNullable<
  ReturnType<typeof buildClusterNodeStorageStatsView>
>;
export type FugueClusterNodeWorkloadPod = ReturnType<typeof buildClusterNodeWorkloadPodView>;
export type FugueClusterNodeWorkload = ReturnType<typeof buildClusterNodeWorkloadView>;
export type FugueClusterNode = ReturnType<typeof buildClusterNodeView>;
export type FugueOperation = ReturnType<typeof buildOperationView>;
export type FugueAuditEvent = ReturnType<typeof buildAuditEventView>;
export type FugueImportResult = ReturnType<typeof buildImportResultView>;
export type FugueAppEnvResult = ReturnType<typeof buildAppEnvResultView>;
export type FugueAppRouteAvailabilityResult = ReturnType<
  typeof buildAppRouteAvailabilityResultView
>;
export type FugueAppRouteResult = ReturnType<typeof buildAppRouteResultView>;
export type FugueAppDomainListResult = ReturnType<typeof buildAppDomainListResultView>;
export type FugueAppDomainAvailabilityResult = ReturnType<
  typeof buildAppDomainAvailabilityResultView
>;
export type FugueAppDomainResult = ReturnType<typeof buildAppDomainResultView>;
export type FugueAppDomainDeleteResult = ReturnType<typeof buildAppDomainDeleteResultView>;
export type FugueAppDomainVerifyResult = ReturnType<typeof buildAppDomainVerifyResultView>;
export type FugueAppFilesResult = ReturnType<typeof buildAppFilesResultView>;
export type FugueAppFilesystemTreeResult = ReturnType<
  typeof buildAppFilesystemTreeResultView
>;
export type FugueAppFilesystemFileResult = ReturnType<
  typeof buildAppFilesystemFileResultView
>;
export type FugueAppFilesystemMutationResult = ReturnType<
  typeof buildAppFilesystemMutationResultView
>;
export type FugueBuildLogsResult = ReturnType<typeof buildBuildLogsResultView>;
export type FugueRuntimeLogsResult = ReturnType<typeof buildRuntimeLogsResultView>;

export async function createFugueTenant(
  accessToken: string,
  payload: { name: string },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/tenants", client.POST("/v1/tenants", { body: payload })),
  );

  return buildTenantView(response.tenant);
}

export async function createFugueApiKey(
  accessToken: string,
  payload: {
    label: string;
    scopes: string[];
    tenantId?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/api-keys",
      client.POST("/v1/api-keys", {
        body: {
          ...(payload.tenantId ? { tenant_id: payload.tenantId } : {}),
          label: payload.label,
          scopes: payload.scopes,
        },
      }),
    ),
  );

  return {
    apiKey: buildApiKeyView(response.apiKey),
    secret: response.secret,
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
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/api-keys/${encodeURIComponent(id)}`,
      client.PATCH("/v1/api-keys/{id}", {
        body: {
          ...(payload.label !== undefined ? { label: payload.label } : {}),
          ...(payload.scopes !== undefined ? { scopes: payload.scopes } : {}),
        },
        params: {
          path: { id },
        },
      }),
    ),
  );

  return buildApiKeyView(response.apiKey);
}

export async function rotateFugueApiKey(
  accessToken: string,
  id: string,
  payload?: {
    label?: string;
    scopes?: string[];
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/api-keys/${encodeURIComponent(id)}/rotate`,
      client.POST("/v1/api-keys/{id}/rotate", {
        body:
          payload && (payload.label !== undefined || payload.scopes !== undefined)
            ? {
                ...(payload.label !== undefined ? { label: payload.label } : {}),
                ...(payload.scopes !== undefined ? { scopes: payload.scopes } : {}),
              }
            : undefined,
        params: {
          path: { id },
        },
      }),
    ),
  );

  return {
    apiKey: buildApiKeyView(response.apiKey),
    secret: response.secret,
  };
}

export async function disableFugueApiKey(accessToken: string, id: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/api-keys/${encodeURIComponent(id)}/disable`,
      client.POST("/v1/api-keys/{id}/disable", {
        params: {
          path: { id },
        },
      }),
    ),
  );

  return buildApiKeyView(response.apiKey);
}

export async function enableFugueApiKey(accessToken: string, id: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/api-keys/${encodeURIComponent(id)}/enable`,
      client.POST("/v1/api-keys/{id}/enable", {
        params: {
          path: { id },
        },
      }),
    ),
  );

  return buildApiKeyView(response.apiKey);
}

export async function deleteFugueApiKey(accessToken: string, id: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/api-keys/${encodeURIComponent(id)}`,
      client.DELETE("/v1/api-keys/{id}", {
        params: {
          path: { id },
        },
      }),
    ),
  );

  return {
    apiKey: buildApiKeyView(response.apiKey),
    deleted: response.deleted ?? false,
  };
}

export async function createFugueNodeKey(
  accessToken: string,
  payload?: {
    label?: string;
    tenantId?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/node-keys",
      client.POST("/v1/node-keys", {
        body:
          payload && (payload.label !== undefined || payload.tenantId !== undefined)
            ? {
                ...(payload.label !== undefined ? { label: payload.label } : {}),
                ...(payload.tenantId !== undefined ? { tenant_id: payload.tenantId } : {}),
              }
            : undefined,
      }),
    ),
  );

  return {
    nodeKey: buildNodeKeyView(response.nodeKey),
    secret: response.secret,
  };
}

export async function revokeFugueNodeKey(accessToken: string, id: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/node-keys/${encodeURIComponent(id)}/revoke`,
      client.POST("/v1/node-keys/{id}/revoke", {
        params: {
          path: { id },
        },
      }),
    ),
  );

  return buildNodeKeyView(response.nodeKey);
}

export async function createFugueProject(
  accessToken: string,
  payload: {
    description?: string;
    name: string;
    tenantId?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/projects",
      client.POST("/v1/projects", {
        body: {
          ...(payload.tenantId ? { tenant_id: payload.tenantId } : {}),
          ...(payload.description ? { description: payload.description } : {}),
          name: payload.name,
        },
      }),
    ),
  );

  return buildProjectView(response.project);
}

export async function patchFugueProject(
  accessToken: string,
  id: string,
  payload: {
    description?: string;
    name?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/projects/${encodeURIComponent(id)}`,
      client.PATCH("/v1/projects/{id}", {
        body: {
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.name !== undefined ? { name: payload.name } : {}),
        },
        params: {
          path: { id },
        },
      }),
    ),
  );

  return buildProjectView(response.project);
}

export async function deleteFugueProject(accessToken: string, id: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/projects/${encodeURIComponent(id)}`,
      client.DELETE("/v1/projects/{id}", {
        params: {
          path: { id },
        },
      }),
    ),
  );

  return buildProjectView(response.project);
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
    repoAuthToken?: string;
    repoUrl: string;
    repoVisibility?: GitHubRepoVisibility;
    runtimeId?: string;
    servicePort?: number;
    sourceDir?: string;
    tenantId?: string;
  },
  idempotencyKey?: string,
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/apps/import-github",
      client.POST("/v1/apps/import-github", {
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
          ...(payload.repoVisibility ? { repo_visibility: payload.repoVisibility } : {}),
          ...(payload.repoAuthToken ? { repo_auth_token: payload.repoAuthToken } : {}),
          repo_url: payload.repoUrl,
        },
        params: idempotencyKey
          ? {
              header: {
                "Idempotency-Key": idempotencyKey,
              },
            }
          : undefined,
      }),
    ),
  );

  return buildImportResultView(response, idempotencyKey);
}

export async function getFugueTenants(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/tenants", client.GET("/v1/tenants")),
  );

  return (response.tenants ?? []).map(buildTenantView);
}

export async function getFugueProjects(accessToken: string, tenantId?: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/projects",
      client.GET("/v1/projects", {
        params: tenantId
          ? {
              query: {
                tenant_id: tenantId,
              },
            }
          : undefined,
      }),
    ),
  );

  return (response.projects ?? []).map(buildProjectView);
}

export async function getFugueApiKeys(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/api-keys", client.GET("/v1/api-keys")),
  );

  return (response.apiKeys ?? []).map(buildApiKeyView);
}

export async function getFugueNodeKeys(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/node-keys", client.GET("/v1/node-keys")),
  );

  return (response.nodeKeys ?? []).map(buildNodeKeyView);
}

export async function getFugueNodeKeyUsageCount(accessToken: string, id: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/node-keys/${encodeURIComponent(id)}/usages`,
      client.GET("/v1/node-keys/{id}/usages", {
        params: {
          path: { id },
        },
      }),
    ),
  ) as Record<string, unknown>;

  return buildNodeKeyUsageCountView(response).usageCount;
}

export async function getFugueBillingSummary(accessToken: string, tenantId?: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/billing",
      client.GET("/v1/billing", {
        params: tenantId
          ? {
              query: {
                tenant_id: tenantId,
              },
            }
          : undefined,
      }),
    ),
  );

  return buildBillingSummaryView(response.billing);
}

export async function updateFugueBilling(
  accessToken: string,
  payload: {
    managedCap: FugueResourceSpec;
    tenantId?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/billing",
      client.PATCH("/v1/billing", {
        body: {
          ...(payload.tenantId ? { tenant_id: payload.tenantId } : {}),
          managed_cap: {
            cpu_millicores: payload.managedCap.cpuMillicores,
            memory_mebibytes: payload.managedCap.memoryMebibytes,
          },
        },
      }),
    ),
  );

  return buildBillingSummaryView(response.billing);
}

export async function setFugueBillingBalance(
  accessToken: string,
  payload: {
    balanceCents: number;
    note?: string;
    tenantId?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/billing/balance",
      client.PATCH("/v1/billing/balance", {
        body: {
          balance_cents: payload.balanceCents,
          ...(payload.note ? { note: payload.note } : {}),
          ...(payload.tenantId ? { tenant_id: payload.tenantId } : {}),
        },
      }),
    ),
  );

  return buildBillingSummaryView(response.billing);
}

export async function topUpFugueBilling(
  accessToken: string,
  payload: {
    amountCents: number;
    note?: string;
    tenantId?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/billing/top-ups",
      client.POST("/v1/billing/top-ups", {
        body: {
          amount_cents: payload.amountCents,
          ...(payload.note ? { note: payload.note } : {}),
          ...(payload.tenantId ? { tenant_id: payload.tenantId } : {}),
        },
      }),
    ),
  );

  return buildBillingSummaryView(response.billing);
}

export async function getFugueApps(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(await expectData("/v1/apps", client.GET("/v1/apps")));

  return (response.apps ?? []).map(buildAppView);
}

export async function getFugueApp(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}`,
      client.GET("/v1/apps/{id}", {
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return response.app ? buildAppView(response.app) : null;
}

export async function getFugueBackingServices(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/backing-services", client.GET("/v1/backing-services")),
  );

  return (response.backingServices ?? []).map(buildBackingServiceView);
}

export async function getFugueAppBindings(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/bindings`,
      client.GET("/v1/apps/{id}/bindings", {
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return {
    backingServices: (response.backingServices ?? []).map(buildBackingServiceView),
    bindings: (response.bindings ?? []).map(buildServiceBindingView),
  };
}

export async function importFugueDockerImageApp(
  accessToken: string,
  payload: {
    imageRef: string;
    name?: string;
    project?: {
      description?: string;
      name: string;
    };
    projectId?: string;
    runtimeId?: string;
    servicePort?: number;
    tenantId?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      "/v1/apps/import-image",
      client.POST("/v1/apps/import-image", {
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
          ...(payload.name ? { name: payload.name } : {}),
          ...(payload.runtimeId ? { runtime_id: payload.runtimeId } : {}),
          ...(typeof payload.servicePort === "number"
            ? { service_port: payload.servicePort }
            : {}),
          image_ref: payload.imageRef,
        },
      }),
    ),
  );

  return {
    app: response.app ? buildAppView(response.app) : null,
    idempotencyKey: null,
    operation: response.operation ? buildOperationView(response.operation) : null,
    replayed: false,
    requestInProgress: false,
  };
}

export async function getFugueAppRouteAvailability(
  accessToken: string,
  appId: string,
  hostname: string,
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/route/availability`,
      client.GET("/v1/apps/{id}/route/availability", {
        params: {
          path: { id: appId },
          query: {
            hostname,
          },
        },
      }),
    ),
  );

  return buildAppRouteAvailabilityResultView(response);
}

export async function patchFugueAppRoute(
  accessToken: string,
  appId: string,
  payload: {
    hostname: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/route`,
      client.PATCH("/v1/apps/{id}/route", {
        body: {
          hostname: payload.hostname,
        },
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildAppRouteResultView(response);
}

export async function getFugueAppDomains(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/domains`,
      client.GET("/v1/apps/{id}/domains", {
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildAppDomainListResultView(response);
}

export async function getFugueAppDomainAvailability(
  accessToken: string,
  appId: string,
  hostname: string,
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/domains/availability`,
      client.GET("/v1/apps/{id}/domains/availability", {
        params: {
          path: { id: appId },
          query: {
            hostname,
          },
        },
      }),
    ),
  );

  return buildAppDomainAvailabilityResultView(response);
}

export async function createFugueAppDomain(
  accessToken: string,
  appId: string,
  payload: {
    hostname: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/domains`,
      client.POST("/v1/apps/{id}/domains", {
        body: {
          hostname: payload.hostname,
        },
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildAppDomainResultView(response);
}

export async function verifyFugueAppDomain(
  accessToken: string,
  appId: string,
  payload: {
    hostname: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/domains/verify`,
      client.POST("/v1/apps/{id}/domains/verify", {
        body: {
          hostname: payload.hostname,
        },
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildAppDomainVerifyResultView(response);
}

export async function deleteFugueAppDomain(
  accessToken: string,
  appId: string,
  hostname: string,
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/domains`,
      client.DELETE("/v1/apps/{id}/domains", {
        params: {
          path: { id: appId },
          query: {
            hostname,
          },
        },
      }),
    ),
  );

  return buildAppDomainDeleteResultView(response);
}

export async function getFugueAppEnv(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/env`,
      client.GET("/v1/apps/{id}/env", {
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildAppEnvResultView(response);
}

export async function patchFugueAppEnv(
  accessToken: string,
  appId: string,
  payload: {
    delete?: string[];
    set?: Record<string, string>;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/env`,
      client.PATCH("/v1/apps/{id}/env", {
        body: {
          ...(payload.set ? { set: payload.set } : {}),
          ...(payload.delete ? { delete: payload.delete } : {}),
        },
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildAppEnvResultView(response);
}

export async function getFugueAppFiles(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/files`,
      client.GET("/v1/apps/{id}/files", {
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildAppFilesResultView(response);
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
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/files`,
      client.PUT("/v1/apps/{id}/files", {
        body: {
          files,
        },
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildAppFilesResultView(response);
}

export async function deleteFugueAppFiles(
  accessToken: string,
  appId: string,
  pathsToDelete: string[],
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/files`,
      client.DELETE("/v1/apps/{id}/files", {
        params: {
          path: { id: appId },
          query: {
            path: pathsToDelete,
          },
        },
      }),
    ),
  );

  return buildAppFilesResultView(response);
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
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/filesystem/tree`,
      client.GET("/v1/apps/{id}/filesystem/tree", {
        params: {
          path: { id: appId },
          query: {
            ...(options?.depth !== undefined ? { depth: options.depth } : {}),
            ...(options?.path ? { path: options.path } : {}),
            ...(options?.pod ? { pod: options.pod } : {}),
          },
        },
      }),
    ),
  );

  return buildAppFilesystemTreeResultView(response);
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
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/filesystem/file`,
      client.GET("/v1/apps/{id}/filesystem/file", {
        params: {
          path: { id: appId },
          query: {
            ...(options.maxBytes !== undefined ? { max_bytes: options.maxBytes } : {}),
            path: options.path,
            ...(options.pod ? { pod: options.pod } : {}),
          },
        },
      }),
    ),
  );

  return buildAppFilesystemFileResultView(response);
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
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/filesystem/file`,
      client.PUT("/v1/apps/{id}/filesystem/file", {
        body: {
          content: payload.content,
          ...(payload.encoding ? { encoding: payload.encoding } : {}),
          ...(payload.mkdirParents !== undefined ? { mkdir_parents: payload.mkdirParents } : {}),
          ...(payload.mode !== undefined ? { mode: payload.mode } : {}),
          path: payload.path,
        },
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  const result = buildAppFilesystemMutationResultView(response);

  return {
    ...result,
    deleted: false,
    kind: "file",
  };
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
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/filesystem/directory`,
      client.POST("/v1/apps/{id}/filesystem/directory", {
        body: {
          ...(payload.mode !== undefined ? { mode: payload.mode } : {}),
          ...(payload.parents !== undefined ? { parents: payload.parents } : {}),
          path: payload.path,
        },
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  const result = buildAppFilesystemMutationResultView(response);

  return {
    ...result,
    deleted: false,
  };
}

export async function deleteFugueAppFilesystemPath(
  accessToken: string,
  appId: string,
  options: {
    path: string;
    recursive?: boolean;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/filesystem`,
      client.DELETE("/v1/apps/{id}/filesystem", {
        params: {
          path: { id: appId },
          query: {
            path: options.path,
            ...(options.recursive !== undefined ? { recursive: options.recursive } : {}),
          },
        },
      }),
    ),
  );

  return buildAppFilesystemMutationResultView(response);
}

export async function getFugueAppBuildLogs(
  accessToken: string,
  appId: string,
  options?: {
    operationId?: string;
    tailLines?: number;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/build-logs`,
      client.GET("/v1/apps/{id}/build-logs", {
        params: {
          path: { id: appId },
          query: {
            ...(options?.operationId ? { operation_id: options.operationId } : {}),
            ...(typeof options?.tailLines === "number" && Number.isFinite(options.tailLines)
              ? { tail_lines: options.tailLines }
              : {}),
          },
        },
      }),
    ),
  );

  return buildBuildLogsResultView(response);
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
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/runtime-logs`,
      client.GET("/v1/apps/{id}/runtime-logs", {
        params: {
          path: { id: appId },
          query: {
            ...(options?.component ? { component: options.component } : {}),
            ...(options?.pod ? { pod: options.pod } : {}),
            ...(typeof options?.previous === "boolean" ? { previous: options.previous } : {}),
            ...(typeof options?.tailLines === "number" && Number.isFinite(options.tailLines)
              ? { tail_lines: options.tailLines }
              : {}),
          },
        },
      }),
    ),
  );

  return buildRuntimeLogsResultView(response);
}

export async function restartFugueApp(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/restart`,
      client.POST("/v1/apps/{id}/restart", {
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildRestartResultView(response);
}

export async function rebuildFugueApp(
  accessToken: string,
  appId: string,
  options?: {
    branch?: string;
    buildContextDir?: string;
    dockerfilePath?: string;
    imageRef?: string;
    repoAuthToken?: string;
    sourceDir?: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/rebuild`,
      client.POST("/v1/apps/{id}/rebuild", {
        body:
          options && Object.keys(options).length > 0
            ? {
                ...(options.branch !== undefined ? { branch: options.branch } : {}),
                ...(options.sourceDir !== undefined ? { source_dir: options.sourceDir } : {}),
                ...(options.dockerfilePath !== undefined
                  ? { dockerfile_path: options.dockerfilePath }
                  : {}),
                ...(options.buildContextDir !== undefined
                  ? { build_context_dir: options.buildContextDir }
                  : {}),
                ...(options.imageRef !== undefined ? { image_ref: options.imageRef } : {}),
                ...(options.repoAuthToken !== undefined
                  ? { repo_auth_token: options.repoAuthToken }
                  : {}),
              }
            : undefined,
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildRebuildResultView(response);
}

export async function startFugueApp(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/scale`,
      client.POST("/v1/apps/{id}/scale", {
        body: {
          replicas: 1,
        },
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildOperationResultView(response);
}

export async function disableFugueApp(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}/disable`,
      client.POST("/v1/apps/{id}/disable", {
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildDisableResultView(response);
}

export async function deleteFugueApp(accessToken: string, appId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/apps/${encodeURIComponent(appId)}`,
      client.DELETE("/v1/apps/{id}", {
        params: {
          path: { id: appId },
        },
      }),
    ),
  );

  return buildDeleteAppResultView(response);
}

export async function getFugueRuntimes(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/runtimes", client.GET("/v1/runtimes")),
  );

  return (response.runtimes ?? []).map(buildRuntimeView);
}

export async function getFugueRuntimeSharing(accessToken: string, runtimeId: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/runtimes/${encodeURIComponent(runtimeId)}/sharing`,
      client.GET("/v1/runtimes/{id}/sharing", {
        params: {
          path: { id: runtimeId },
        },
      }),
    ),
  );

  return buildRuntimeSharingResultView(response);
}

export async function grantFugueRuntimeAccess(
  accessToken: string,
  runtimeId: string,
  payload: {
    tenantId: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/runtimes/${encodeURIComponent(runtimeId)}/sharing/grants`,
      client.POST("/v1/runtimes/{id}/sharing/grants", {
        body: {
          tenant_id: payload.tenantId,
        },
        params: {
          path: { id: runtimeId },
        },
      }),
    ),
  );

  return buildRuntimeAccessGrantResultView(response);
}

export async function revokeFugueRuntimeAccess(
  accessToken: string,
  runtimeId: string,
  tenantId: string,
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/runtimes/${encodeURIComponent(runtimeId)}/sharing/grants/${encodeURIComponent(tenantId)}`,
      client.DELETE("/v1/runtimes/{id}/sharing/grants/{tenant_id}", {
        params: {
          path: {
            id: runtimeId,
            tenant_id: tenantId,
          },
        },
      }),
    ),
  );

  return buildRuntimeAccessRevokeResultView(response);
}

export async function setFugueRuntimePoolMode(
  accessToken: string,
  runtimeId: string,
  payload: {
    poolMode: string;
  },
) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData(
      `/v1/runtimes/${encodeURIComponent(runtimeId)}/pool-mode`,
      client.POST("/v1/runtimes/{id}/pool-mode", {
        body: {
          pool_mode: payload.poolMode,
        },
        params: {
          path: { id: runtimeId },
        },
      }),
    ),
  );

  return buildRuntimePoolModeResultView(response);
}

export async function getFugueClusterNodes(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/cluster/nodes", client.GET("/v1/cluster/nodes")),
  );

  return (response.clusterNodes ?? []).map(buildClusterNodeView);
}

export async function getFugueOperations(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/operations", client.GET("/v1/operations")),
  );

  return (response.operations ?? []).map(buildOperationView);
}

export async function getFugueAuditEvents(accessToken: string) {
  const client = getClient(accessToken);
  const response = camelizeData(
    await expectData("/v1/audit-events", client.GET("/v1/audit-events")),
  );

  return (response.auditEvents ?? []).map(buildAuditEventView);
}
