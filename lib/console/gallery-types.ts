import type { ConsoleTone } from "@/lib/console/types";

export type ConsoleGalleryBadgeKind =
  | "buildpacks"
  | "docker"
  | "github"
  | "nixpacks"
  | "postgres"
  | "runtime"
  | "static";

export type ConsoleGalleryBadgeView = {
  id: string;
  kind: ConsoleGalleryBadgeKind;
  label: string;
  meta: string;
};

export type ConsoleGalleryAppView = {
  hasPostgresService: boolean;
  id: string;
  lastMessage: string;
  name: string;
  phase: string;
  phaseTone: ConsoleTone;
  routeHref: string | null;
  routeLabel: string;
  serviceBadges: ConsoleGalleryBadgeView[];
  sourceLabel: string;
  sourceMeta: string;
  updatedExact: string;
  updatedLabel: string;
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
  apiHost: string;
  connectionLabel: string;
  connectionTone: ConsoleTone;
  exists: boolean;
  stage: "empty" | "needs-workspace" | "ready";
  tenantName: string | null;
};

export type ConsoleProjectGalleryData = {
  errors: string[];
  projects: ConsoleGalleryProjectView[];
  workspace: ConsoleGalleryWorkspaceView;
};
