"use client";

import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
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
  const { t } = useI18n();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleAdminUsersPageSnapshot>(
      CONSOLE_ADMIN_USERS_PAGE_SNAPSHOT_URL,
    );

  if (loading && !data) {
    return (
      <ConsoleLoadingState label={t("Loading users")}>
        <ConsoleAdminUsersPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={t(error ?? "Fugue could not load the admin users snapshot right now.")}
              title={t("Users unavailable")}
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  const errorMessage = data.errors.length
    ? t("Partial admin data: {details}.", { details: data.errors.join(" | ") })
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <AdminSummaryGrid
        items={[
          { label: t("Users"), value: data.summary.userCount },
          { label: t("Admins"), value: data.summary.adminCount },
          { label: t("Blocked"), value: data.summary.blockedCount },
          { label: t("Deleted"), value: data.summary.deletedCount },
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
