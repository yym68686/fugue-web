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

export type ConsoleGalleryAppView = {
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
  redeployActionDescription: string;
  redeployActionLabel: string;
  redeployActionLoadingLabel: string;
  redeployQueuedMessage: string;
  redeployDisabledReason: string | null;
  routeHref: string | null;
  routeLabel: string;
  serviceBadges: ConsoleGalleryBadgeView[];
  sourceBranchHref: string | null;
  sourceBranchLabel: string | null;
  sourceHref: string | null;
  sourceLabel: string;
  sourceMeta: string;
  sourceType: string | null;
  syncStatusLabel: string;
  syncStatusTone: ConsoleTone;
  syncSummary: string;
  updatedExact: string;
  updatedLabel: string;
  workspaceMountPath: string | null;
};

export type ConsoleGalleryBackingServiceView = {
  description: string;
  id: string;
  name: string;
  ownerAppLabel: string;
  status: string;
  statusTone: ConsoleTone;
  type: string;
  updatedExact: string;
  updatedLabel: string;
};

export type ConsoleGalleryProjectView = {
  appCount: number;
  id: string;
  latestActivityExact: string;
  latestActivityLabel: string;
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
