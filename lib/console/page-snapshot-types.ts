import type {
  AdminAppsPageData,
  AdminClusterPageData,
  AdminUsersPageData,
} from "@/lib/admin/service";
import type { AppUserRecord } from "@/lib/app-users/store";
import type { ApiKeyPageData } from "@/lib/api-keys/service";
import type { AuthMethodRecord } from "@/lib/auth/methods";
import type { SessionUser } from "@/lib/auth/session";
import type { BillingPageData } from "@/lib/billing/service";
import type { ClusterNodesPageData } from "@/lib/cluster-nodes/service";
import type { NodeKeyPageData } from "@/lib/node-keys/service";

export type ConsoleBillingPageSnapshot =
  | {
      data: BillingPageData;
      state: "ready";
    }
  | {
      state: "workspace-missing";
    };

export type ConsoleApiKeysPageSnapshot =
  | {
      apiBaseUrl: string;
      apiKeys: ApiKeyPageData;
      nodeKeys: NodeKeyPageData;
      state: "ready";
    }
  | {
      state: "workspace-missing";
    };

export type ConsoleClusterNodesPageSnapshot =
  | {
      data: ClusterNodesPageData;
      isAdmin: boolean;
      state: "ready";
    }
  | {
      state: "workspace-missing";
    };

export type ConsoleProfileSettingsPageSnapshot = {
  availableMethods: {
    github: boolean;
    google: boolean;
  };
  methods: AuthMethodRecord[];
  session: SessionUser;
  state: "ready";
  user: AppUserRecord;
};

export type ConsoleAdminAppsPageSnapshot = AdminAppsPageData;
export type ConsoleAdminUsersPageSnapshot = AdminUsersPageData;
export type ConsoleAdminUsersPageEnrichmentSnapshot = AdminUsersPageData;
export type ConsoleAdminClusterPageSnapshot = AdminClusterPageData;
