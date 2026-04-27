import { AdminAppsPageShell } from "@/components/admin/admin-apps-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminAppsPageData } from "@/lib/admin/service";

export default async function AppsPage() {
  await requireAdminPageAccess();
  const initialSnapshot = await getAdminAppsPageData();

  return <AdminAppsPageShell initialSnapshot={initialSnapshot} />;
}
