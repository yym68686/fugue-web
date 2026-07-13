import { AdminUsersConsole } from "@/components/console/islands/admin-users-console";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { createAdminUsersStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function AdminUsersPage() {
  await requireAdminPageAccess();
  const { t } = await getRequestI18n();

  return (
    <>
      <PageHeader
        title={t("Admin users")}
        description={t(
          "User directory, account status, admin state, providers, verification, balance, billing limit, service usage, block, unblock, and delete.",
        )}
      />
      <AdminUsersConsole messages={createAdminUsersStateMessages(t)} />
    </>
  );
}
