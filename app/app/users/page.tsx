import { AdminUsersPageShell } from "@/components/admin/admin-users-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";

export default async function UsersPage() {
  await requireAdminPageAccess();

  return <AdminUsersPageShell />;
}
