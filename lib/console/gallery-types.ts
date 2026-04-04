import type { TechStackBadgeKind } from "@/lib/tech-stack";
import type { ConsoleTone } from "@/lib/console/types";

export type ConsoleGalleryBadgeKind = TechStackBadgeKind;

export type ConsoleGalleryBadgeView = {
  id: string;
  kind: ConsoleGalleryBadgeKind;
  label: string;
  meta: string;
};

export type ConsoleCompactResourceItemView = {
  id: string;
  label: string;
  meterValue: number | null;
  primaryLabel: string;
  secondaryLabel: string | null;
  title: string;
  tone: ConsoleTone;
};

export type ConsoleProjectResourceUsageSnapshot = {
  cpuMillicores: number | null;
  ephemeralStorageBytes: number | null;
  memoryBytes: number | null;
};

export type ConsoleProjectLifecycleView = {
  label: string;
  live: boolean;
  syncMode: "active" | "idle" | "passive";
  tone: ConsoleTone;
};

export type ConsoleGalleryCommitView = {
  committedAt: string | null;
  exact: string | null;
  href: string | null;
  id: string;
  kind: "pending" | "running";
  label: string;
  stateLabel: string;
  tone: ConsoleTone;
};

export type ConsoleGalleryAppServiceRole = "pending" | "running";

export type ConsoleGalleryAppView = {
  buildLogsOperationId: string | null;
  commitViews: ConsoleGalleryCommitView[];
  currentCommitCommittedAt: string | null;
  canRedeploy: boolean;
  currentCommitExact: string | null;
  currentCommitHref: string | null;
  currentCommitLabel: string | null;
  currentRuntimeId: string | null;
  deployBehavior: string;
  failoverAuto: boolean;
  failoverConfigured: boolean;
  failoverTargetRuntimeId: string | null;
  hasPostgresService: boolean;
  id: string;
  lastMessage: string | null;
  locationCountryCode: string | null;
  locationLabel: string | null;
  name: string;
  phase: string;
  phaseTone: ConsoleTone;
  primaryBadge: ConsoleGalleryBadgeView;
  replicaCount: number | null;
  redeployActionDescription: string;
  redeployActionLabel: string;
  redeployActionLoadingLabel: string;
  redeployQueuedMessage: string;
  redeployDisabledReason: string | null;
  routeBaseDomain: string | null;
  routeHref: string | null;
  routeHostname: string | null;
  routeLabel: string;
  routePublicUrl: string | null;
  runtimeId: string | null;
  serviceBadges: ConsoleGalleryBadgeView[];
  serviceDurationLabel: string | null;
  serviceRole: ConsoleGalleryAppServiceRole;
  sourceBranchHref: string | null;
  sourceBranchLabel: string | null;
  sourceBranchName: string | null;
  sourceHref: string | null;
  sourceLabel: string;
  sourceMeta: string;
  sourceType: string | null;
  workspaceStorageClassName: string | null;
  workspaceStorageSize: string | null;
  workspaceMountPath: string | null;
};

export type ConsoleGalleryBackingServiceView = {
  databaseFailoverConfigured: boolean;
  databaseFailoverTargetRuntimeId: string | null;
  databaseInstances: number | null;
  databaseRuntimeId: string | null;
  databaseSynchronousReplicas: number | null;
  description: string;
  id: string;
  locationCountryCode: string | null;
  locationLabel: string | null;
  name: string;
  ownerAppId: string | null;
  ownerAppLabel: string;
  primaryBadge: ConsoleGalleryBadgeView;
  status: string;
  statusTone: ConsoleTone;
  type: string;
};

export type ConsoleGalleryProjectView = {
  appCount: number;
  id: string;
  name: string;
  resourceUsage: ConsoleCompactResourceItemView[];
  resourceUsageSnapshot: ConsoleProjectResourceUsageSnapshot;
  serviceBadges: ConsoleGalleryBadgeView[];
  serviceCount: number;
  services: Array<
    | ({
        kind: "app";
      } & ConsoleGalleryAppView)
    | ({
        kind: "backing-service";
      } & ConsoleGalleryBackingServiceView)
  >;
};

export type ConsoleProjectSummaryView = {
  appCount: number;
  id: string;
  lifecycle: ConsoleProjectLifecycleView;
  name: string;
  resourceUsage: ConsoleCompactResourceItemView[];
  resourceUsageSnapshot: ConsoleProjectResourceUsageSnapshot;
  serviceBadges: ConsoleGalleryBadgeView[];
  serviceCount: number;
};

export type ConsoleGalleryWorkspaceView = {
  exists: boolean;
  stage: "empty" | "needs-workspace" | "ready";
};

export type ConsoleImportRuntimeTargetView = {
  category: "internal-cluster" | "machine";
  description: string;
  id: string;
  kindLabel: string;
  locationCountryCode: string | null;
  locationCountryLabel: string | null;
  locationLabel: string | null;
  primaryLabel: string;
  runtimeType: string | null;
  statusLabel: string | null;
  statusTone: ConsoleTone | null;
  summaryLabel: string;
};

export type ConsoleProjectGalleryData = {
  errors: string[];
  projects: ConsoleGalleryProjectView[];
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
  workspace: ConsoleGalleryWorkspaceView;
};

export type ConsoleProjectGallerySummaryData = {
  errors: string[];
  projects: ConsoleProjectSummaryView[];
  workspace: ConsoleGalleryWorkspaceView;
};

export type ConsoleProjectDetailData = {
  project: ConsoleGalleryProjectView | null;
};

export type ConsoleRuntimeTargetInventoryData = {
  runtimeTargetInventoryError: string | null;
  runtimeTargets: ConsoleImportRuntimeTargetView[];
};
