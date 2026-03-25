import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelSection } from "@/components/ui/panel";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminUsersPageData } from "@/lib/admin/service";

export default async function UsersPage() {
  await requireAdminPageAccess();
  const data = await getAdminUsersPageData();

  return (
    <div className="fg-console-page">
      {data.errors.length ? (
        <InlineAlert variant="error">
          Partial admin data: {data.errors.join(" | ")}.
        </InlineAlert>
      ) : null}

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
