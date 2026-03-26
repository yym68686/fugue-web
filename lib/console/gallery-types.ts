import type { ConsoleTone } from "@/lib/console/types";

export type ConsoleGalleryBadgeKind =
  | "buildpacks"
  | "dotnet"
  | "docker"
  | "go"
  | "github"
  | "java"
  | "nixpacks"
  | "node"
  | "postgres"
  | "php"
  | "python"
  | "runtime"
  | "ruby"
  | "rust"
  | "static";

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

export type ConsoleGalleryAppView = {
  commitViews: ConsoleGalleryCommitView[];
  currentCommitCommittedAt: string | null;
  canRedeploy: boolean;
  currentCommitExact: string | null;
  currentCommitHref: string | null;
  currentCommitLabel: string | null;
  deployBehavior: string;
  hasPostgresService: boolean;
  id: string;
  lastMessage: string;
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
