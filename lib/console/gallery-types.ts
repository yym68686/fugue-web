import type { TechStackBadgeKind } from "@/lib/tech-stack";
import type { ConsoleTone } from "@/lib/console/types";

export type ConsoleGalleryBadgeKind = TechStackBadgeKind;

export type ConsoleGalleryBadgeView = {
  id: string;
  kind: ConsoleGalleryBadgeKind;
  label: string;
  meta: string;
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
  deployBehavior: string;
  hasPostgresService: boolean;
  id: string;
  lastMessage: string | null;
  locationCountryCode: string | null;
  locationLabel: string | null;
  name: string;
  phase: string;
  phaseTone: ConsoleTone;
  primaryBadge: ConsoleGalleryBadgeView;
  redeployActionDescription: string;
  redeployActionLabel: string;
  redeployActionLoadingLabel: string;
  redeployQueuedMessage: string;
  redeployDisabledReason: string | null;
  routeHref: string | null;
  routeLabel: string;
  serviceBadges: ConsoleGalleryBadgeView[];
  serviceDurationLabel: string | null;
  serviceRole: ConsoleGalleryAppServiceRole;
  sourceBranchHref: string | null;
  sourceBranchLabel: string | null;
  sourceHref: string | null;
  sourceLabel: string;
  sourceMeta: string;
  sourceType: string | null;
  workspaceMountPath: string | null;
};

export type ConsoleGalleryBackingServiceView = {
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

export type ConsoleGalleryWorkspaceView = {
  exists: boolean;
  stage: "empty" | "needs-workspace" | "ready";
};

export type ConsoleProjectGalleryData = {
  errors: string[];
  projects: ConsoleGalleryProjectView[];
  workspace: ConsoleGalleryWorkspaceView;
};
