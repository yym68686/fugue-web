import { AdminAppsPageShell } from "@/components/admin/admin-apps-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";

export default async function AppsPage() {
  await requireAdminPageAccess();

  return <AdminAppsPageShell />;
}
