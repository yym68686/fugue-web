import { AdminUsersPageShell } from "@/components/admin/admin-users-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminUsersPageData } from "@/lib/admin/service";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function UsersPage() {
  await requireAdminPageAccess();
  const initialSnapshot = await getAdminUsersPageData(await getRequestLocale());

  return <AdminUsersPageShell initialSnapshot={initialSnapshot} />;
}
