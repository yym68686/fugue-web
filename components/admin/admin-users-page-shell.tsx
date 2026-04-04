"use client";

import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import {
  ConsoleAdminUsersPageSkeleton,
  ConsoleLoadingState,
} from "@/components/console/console-page-skeleton";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import {
  CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
  type ConsoleAdminUsersPageSnapshot,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";

export function AdminUsersPageShell() {
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
      CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
    );

  if (loading && !data) {
    return (
      <ConsoleLoadingState>
        <ConsoleAdminUsersPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsolePageIntro
          description="Users, access state, prepaid balance, and managed capacity limits."
          eyebrow="Admin / Users"
          title="Users"
        />

        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={error ?? "Fugue could not load the admin users snapshot right now."}
              title="Users unavailable"
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorMessage = data.errors.length
    ? `Partial admin data: ${data.errors.join(" | ")}.`
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <ConsolePageIntro
        description="Users, access state, prepaid balance, and managed capacity limits."
        eyebrow="Admin / Users"
        title="Users"
      />

      <AdminSummaryGrid
        items={[
          { label: "Users", value: data.summary.userCount },
          { label: "Admins", value: data.summary.adminCount },
          { label: "Blocked", value: data.summary.blockedCount },
          { label: "Deleted", value: data.summary.deletedCount },
        ]}
      />

      <Panel>
        <PanelSection>
          <AdminUserManager
            onRefresh={() => {
              void refresh({ force: true });
            }}
            users={data.users}
          />
        </PanelSection>
      </Panel>
    </div>
  );
}
