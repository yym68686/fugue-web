type Translate = (key: string) => string;

export type CommonStateMessages = {
  retry: string;
};

export type ServersStateMessages = CommonStateMessages & {
  inventoryPartiallyLoaded: string;
  noOfflineServers: string;
  noOfflineServersDescription: string;
  noServersFound: string;
  noServersFoundDescription: string;
  serversUnavailable: string;
  workspaceNotReady: string;
  workspaceNotReadyDescription: string;
};

export type BillingStateMessages = CommonStateMessages & {
  actionFailed: string;
  billingUnavailable: string;
  noEvents: string;
  noEventsDescription: string;
  partialSnapshot: string;
  savedCap: string;
  snapshotFallback: string;
  snapshotUnavailable: string;
  syncing: string;
  unavailable: string;
  unknown: string;
  workspaceNotReady: string;
  workspaceNotReadyDescription: string;
};

export type AccessKeysStateMessages = CommonStateMessages & {
  apiKeySyncWarning: string;
  noApiKeys: string;
  noApiKeysDescription: string;
  noNodeKeys: string;
  noNodeKeysDescription: string;
  noScopes: string;
  nodeKeySyncWarning: string;
  operationFailed: string;
  syncing: string;
  unavailable: string;
  keysUnavailable: string;
  never: string;
  workspaceNotReady: string;
  workspaceNotReadyDescription: string;
};

export type DnsStateMessages = {
  apexCnameDescription: string;
  apexCnameTitle: string;
  dnsLoadFailed: string;
  dnsOperationFailed: string;
  dnsWarning: string;
  noRecords: string;
  noRecordsDescription: string;
  noZones: string;
  noZonesDescription: string;
  notYet: string;
  overwriteDescription: string;
  overwriteTitle: string;
  parentDelegationDescription: string;
  parentDelegationTitle: string;
  workspaceNotReady: string;
  workspaceNotReadyDescription: string;
};

export type ProjectGalleryStateMessages = {
  clearFilterDescription: string;
  createProjectDescription: string;
  creationFlowDescription: string;
  creationFlowTitle: string;
  inventoryPartiallyLoaded: string;
  noProjects: string;
  noProjectsMatch: string;
  noRuntime: string;
  noUsageStats: string;
  projectsUnavailable: string;
};

export type ProjectWorkbenchStateMessages = {
  continuityActiveDescription: string;
  continuityIdleDescription: string;
  copyFailed: string;
  copySucceeded: string;
  currentImage: string;
  customDomainsUnavailable: string;
  environmentUnavailable: string;
  filesystemUnavailable: string;
  imagesUnavailable: string;
  internalServiceUnavailable: string;
  logsUnavailable: string;
  metricsUnavailable: string;
  noCustomDomains: string;
  noCustomDomainsDescription: string;
  noEnvironment: string;
  noEnvironmentDescription: string;
  noFiles: string;
  noFilesDescription: string;
  noImages: string;
  noImagesDescription: string;
  noLogs: string;
  noLogsDescription: string;
  noMetrics: string;
  noMetricsDescription: string;
  noPod: string;
  noProject: string;
  noProjectDescription: string;
  noPublicRoute: string;
  noPublicRouteDescription: string;
  noRequests: string;
  noRequestsDescription: string;
  noRuntime: string;
  noServices: string;
  noServicesDescription: string;
  noTrace: string;
  notConfigured: string;
  projectUnavailable: string;
  requestsUnavailable: string;
  restart: string;
  restartApp: string;
  restartConfirmation: string;
  restartFailed: string;
  restarting: string;
  restartRequested: string;
  restartRequestedDescription: string;
  retry: string;
  unknown: string;
};

export type AdminAppsStateMessages = {
  adminOperationFailed: string;
  applicationsUnavailable: string;
  clearFilterDescription: string;
  emptyInventoryDescription: string;
  listChanged: string;
  loading: string;
  none: string;
  noApplications: string;
  noApplicationsMatch: string;
  noUsageStats: string;
  snapshotPartiallyLoaded: string;
};

export type AdminUsersStateMessages = {
  adminOperationFailed: string;
  billingSyncError: string;
  clearFilterDescription: string;
  emptyDirectoryDescription: string;
  listChanged: string;
  noBalanceData: string;
  noUsers: string;
  noUsersMatch: string;
  snapshotPartiallyLoaded: string;
  unavailable: string;
  usersUnavailable: string;
};

export type AdminClusterStateMessages = {
  clearSearchDescription: string;
  clusterOperationFailed: string;
  clusterUnavailable: string;
  controlPlaneUnavailable: string;
  controlPlaneUnavailableDescription: string;
  effectivePolicy: string;
  emptyInventoryDescription: string;
  noRoleLabels: string;
  noTelemetry: string;
  noNodes: string;
  noNodesMatch: string;
  policyUnavailable: string;
  policyUnavailableDescription: string;
  snapshotPartiallyLoaded: string;
  unavailable: string;
};

function createCommonStateMessages(t: Translate): CommonStateMessages {
  return {
    retry: t("Retry"),
  };
}

export function createServersStateMessages(t: Translate): ServersStateMessages {
  return {
    ...createCommonStateMessages(t),
    inventoryPartiallyLoaded: t("Server inventory partially loaded"),
    noOfflineServers: t("No offline servers"),
    noOfflineServersDescription: t(
      "Fugue is not reporting stale runtime server records for this workspace.",
    ),
    noServersFound: t("No servers found"),
    noServersFoundDescription: t(
      "Clear the search query or attach a new runtime node.",
    ),
    serversUnavailable: t("Servers unavailable"),
    workspaceNotReady: t("Workspace is not ready"),
    workspaceNotReadyDescription: t(
      "Create or open a Fugue workspace before viewing runtime servers.",
    ),
  };
}

export function createBillingStateMessages(t: Translate): BillingStateMessages {
  return {
    ...createCommonStateMessages(t),
    actionFailed: t("Billing action failed"),
    billingUnavailable: t("Billing unavailable"),
    noEvents: t("No billing events yet"),
    noEventsDescription: t(
      "Fugue returned no tenant billing events for this workspace.",
    ),
    partialSnapshot: t("Billing snapshot refreshed with partial live data"),
    savedCap: t("Current saved cap"),
    snapshotFallback: t("Fugue could not load the billing snapshot right now."),
    snapshotUnavailable: t("Billing snapshot unavailable"),
    syncing: t("Syncing"),
    unavailable: t("Unavailable"),
    unknown: t("Unknown"),
    workspaceNotReady: t("Billing needs a workspace"),
    workspaceNotReadyDescription: t(
      "Create or open a Fugue workspace before changing tenant billing.",
    ),
  };
}

export function createAccessKeysStateMessages(t: Translate): AccessKeysStateMessages {
  return {
    ...createCommonStateMessages(t),
    apiKeySyncWarning: t(
      "Showing stored API key metadata while live sync is unavailable.",
    ),
    keysUnavailable: t("Access keys unavailable"),
    never: t("Never"),
    noApiKeys: t("No API keys"),
    noApiKeysDescription: t(
      "Provision the workspace admin key before using the Fugue CLI or API from this account.",
    ),
    noNodeKeys: t("No node keys"),
    noNodeKeysDescription: t(
      "Create a node key, copy the join command, and run it on a VPS.",
    ),
    noScopes: t("No scopes"),
    nodeKeySyncWarning: t(
      "Showing stored node key metadata while live sync is unavailable.",
    ),
    operationFailed: t("The access key operation failed."),
    syncing: t("Syncing"),
    unavailable: t("Unavailable"),
    workspaceNotReady: t("Workspace is not ready"),
    workspaceNotReadyDescription: t(
      "Create or open a Fugue workspace before managing API keys and node enrollment keys.",
    ),
  };
}

export function createDnsStateMessages(t: Translate): DnsStateMessages {
  return {
    apexCnameDescription: t(
      "Fugue will publish A/AAAA answers at the apex instead of an invalid apex CNAME RR.",
    ),
    apexCnameTitle: t("Apex CNAME uses flattening."),
    dnsLoadFailed: t("Fugue could not load hosted DNS right now."),
    dnsOperationFailed: t("The DNS operation failed."),
    dnsWarning: t("Hosted DNS loaded with a warning."),
    noRecords: t("No DNS records"),
    noRecordsDescription: t(
      "Add a record after the zone is delegated to Fugue nameservers.",
    ),
    noZones: t("No hosted zones"),
    noZonesDescription: t("Add a zone to start serving DNS from Fugue nameservers."),
    notYet: t("Not yet"),
    overwriteDescription: t(
      "Fugue will still preserve system protected records and backend ownership checks.",
    ),
    overwriteTitle: t("Overwrite is explicit for this save."),
    parentDelegationDescription: t(
      "If the registrar has DNSSEC DS records enabled, remove them until Fugue DNSSEC is configured.",
    ),
    parentDelegationTitle: t("Parent delegation is not fully active."),
    workspaceNotReady: t("Workspace is not ready"),
    workspaceNotReadyDescription: t(
      "Create or open a Fugue workspace before managing hosted DNS.",
    ),
  };
}

export function createProjectGalleryStateMessages(
  t: Translate,
): ProjectGalleryStateMessages {
  return {
    clearFilterDescription: t("Clear search or adjust the lifecycle filter."),
    createProjectDescription: t(
      "Create a project from a repository, image, or upload.",
    ),
    creationFlowDescription: t(
      "The complete import wizard is available from the dedicated new project route.",
    ),
    creationFlowTitle: t("Full creation flow"),
    inventoryPartiallyLoaded: t("Inventory partially loaded"),
    noProjects: t("No projects yet"),
    noProjectsMatch: t("No projects match this filter"),
    noRuntime: t("No runtime"),
    noUsageStats: t("No usage stats"),
    projectsUnavailable: t("Projects unavailable"),
  };
}

export function createProjectWorkbenchStateMessages(
  t: Translate,
): ProjectWorkbenchStateMessages {
  return {
    continuityActiveDescription: t(
      "A database continuity operation is currently in progress.",
    ),
    continuityIdleDescription: t(
      "No live database continuity operation is reported for this backing service.",
    ),
    copyFailed: t("Could not copy to clipboard."),
    copySucceeded: t("Copied to clipboard."),
    currentImage: t("Current image"),
    customDomainsUnavailable: t("Custom domains are unavailable."),
    environmentUnavailable: t("Environment unavailable"),
    filesystemUnavailable: t("Filesystem unavailable"),
    imagesUnavailable: t("Images unavailable"),
    internalServiceUnavailable: t("Internal service URL is not reported for this app."),
    logsUnavailable: t("Logs unavailable"),
    metricsUnavailable: t("Metrics unavailable"),
    noCustomDomains: t("No custom domains"),
    noCustomDomainsDescription: t("This app has no AppDomain bindings yet."),
    noEnvironment: t("No environment variables"),
    noEnvironmentDescription: t("Fugue returned an empty environment for this app."),
    noFiles: t("No files returned"),
    noFilesDescription: t("Fugue did not return filesystem entries for this app."),
    noImages: t("No image versions"),
    noImagesDescription: t(
      "Fugue did not return retained image versions for this app.",
    ),
    noLogs: t("No logs returned"),
    noLogsDescription: t("Fugue did not return log lines for this app and mode."),
    noMetrics: t("No metrics returned"),
    noMetricsDescription: t(
      "Fugue observability returned no metric samples for this window.",
    ),
    noPod: t("No pod selected"),
    noProject: t("Project not found"),
    noProjectDescription: t(
      "The requested project does not exist in this workspace, or the current account cannot view it.",
    ),
    noPublicRoute: t("No public route"),
    noPublicRouteDescription: t("This app does not currently expose a public route."),
    noRequests: t("No requests returned"),
    noRequestsDescription: t(
      "Fugue observability returned no request summaries for this window.",
    ),
    noRuntime: t("No runtime"),
    noServices: t("No services yet"),
    noServicesDescription: t(
      "This project exists, but Fugue is not reporting any app or backing service for it yet.",
    ),
    noTrace: t("No trace"),
    notConfigured: t("Not configured"),
    projectUnavailable: t("Project details unavailable"),
    requestsUnavailable: t("Requests unavailable"),
    restart: t("Restart"),
    restartApp: t("Restart app"),
    restartConfirmation: t("Fugue will restart this app without rebuilding its image."),
    restartFailed: t("Restart failed"),
    restarting: t("Restarting…"),
    restartRequested: t("Restart requested"),
    restartRequestedDescription: t(
      "Fugue accepted the restart and refreshed the project status.",
    ),
    retry: t("Retry"),
    unknown: t("Unknown"),
  };
}

export function createAdminAppsStateMessages(t: Translate): AdminAppsStateMessages {
  return {
    adminOperationFailed: t("Admin operation failed"),
    applicationsUnavailable: t("Applications unavailable"),
    clearFilterDescription: t("Clear search or change the phase filter."),
    emptyInventoryDescription: t(
      "Fugue returned an empty cluster application inventory.",
    ),
    listChanged: t("The application list changed. Returned to the first page."),
    loading: t("Loading"),
    none: t("None"),
    noApplications: t("No applications found"),
    noApplicationsMatch: t("No applications match this filter"),
    noUsageStats: t("No usage stats"),
    snapshotPartiallyLoaded: t("Snapshot partially loaded"),
  };
}

export function createAdminUsersStateMessages(t: Translate): AdminUsersStateMessages {
  return {
    adminOperationFailed: t("Admin operation failed"),
    billingSyncError: t("Billing sync error"),
    clearFilterDescription: t("Clear search or change the user filter."),
    emptyDirectoryDescription: t("Fugue returned an empty user directory."),
    listChanged: t("The user list changed. Returned to the first page."),
    noBalanceData: t("No balance data"),
    noUsers: t("No users found"),
    noUsersMatch: t("No users match this filter"),
    snapshotPartiallyLoaded: t("Snapshot partially loaded"),
    unavailable: t("Unavailable"),
    usersUnavailable: t("Users unavailable"),
  };
}

export function createAdminClusterStateMessages(
  t: Translate,
): AdminClusterStateMessages {
  return {
    clearSearchDescription: t("Clear the node search."),
    clusterOperationFailed: t("Cluster operation failed"),
    clusterUnavailable: t("Cluster unavailable"),
    controlPlaneUnavailable: t("Control plane status unavailable"),
    controlPlaneUnavailableDescription: t(
      "The admin snapshot did not include control plane telemetry.",
    ),
    effectivePolicy: t("Effective policy"),
    emptyInventoryDescription: t("Fugue returned an empty cluster node inventory."),
    noRoleLabels: t("No role labels"),
    noTelemetry: t("No telemetry"),
    noNodes: t("No cluster nodes found"),
    noNodesMatch: t("No cluster nodes match this filter"),
    policyUnavailable: t("Policy unavailable"),
    policyUnavailableDescription: t(
      "This node cannot be managed through the admin policy endpoint.",
    ),
    snapshotPartiallyLoaded: t("Snapshot partially loaded"),
    unavailable: t("Unavailable"),
  };
}
