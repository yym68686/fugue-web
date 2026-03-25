import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { Panel, PanelSection } from "@/components/ui/panel";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminUsersPageData } from "@/lib/admin/service";

export default async function UsersPage() {
  await requireAdminPageAccess();
  const data = await getAdminUsersPageData();
  const errorMessage = data.errors.length
    ? `Partial admin data: ${data.errors.join(" | ")}.`
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <ConsolePageIntro
        description="Users, access state, and service footprint."
        eyebrow="Admin / users"
        title="Users"
      />

      <AdminSummaryGrid
        items={[
          { label: "users", value: data.summary.userCount },
          { label: "admins", value: data.summary.adminCount },
          { label: "blocked", value: data.summary.blockedCount },
          { label: "deleted", value: data.summary.deletedCount },
        ]}
      />

      <Panel>
        <PanelSection>
          <AdminUserManager users={data.users} />
        </PanelSection>
      </Panel>
    </div>
  );
}
