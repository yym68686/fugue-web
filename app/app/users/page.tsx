import { AdminUserManager } from "@/components/admin/admin-user-manager";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
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
        description="Product users, access status, last login time, and workspace service counts."
        eyebrow="Admin / users"
        title="Users"
      />

      <section className="fg-console-two-up">
        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Product users</p>
            <PanelTitle>Current accounts</PanelTitle>
            <PanelCopy>Block, unblock, or delete product-layer access from one table.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <AdminUserManager users={data.users} />
          </PanelSection>
        </Panel>

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Readout</p>
            <PanelTitle>Access summary</PanelTitle>
            <PanelCopy>Admin count, blocked accounts, and deleted records.</PanelCopy>
          </PanelSection>

          <PanelSection>
            <ul className="fg-console-stat-list">
              <li>
                <strong>Total users</strong>
                <span>{data.summary.userCount}</span>
              </li>
              <li>
                <strong>Admins</strong>
                <span>{data.summary.adminCount}</span>
              </li>
              <li>
                <strong>Blocked</strong>
                <span>{data.summary.blockedCount}</span>
              </li>
              <li>
                <strong>Deleted</strong>
                <span>{data.summary.deletedCount}</span>
              </li>
            </ul>
          </PanelSection>
        </Panel>
      </section>
    </div>
  );
}
