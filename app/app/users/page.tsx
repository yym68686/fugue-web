import { AdminUsersPageShell } from "@/components/admin/admin-users-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminUsersPageData } from "@/lib/admin/service";

export default async function UsersPage() {
  await requireAdminPageAccess();
  const initialSnapshot = await getAdminUsersPageData();

  return <AdminUsersPageShell initialSnapshot={initialSnapshot} />;
}
