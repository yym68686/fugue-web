import { AdminAppsPageShell } from "@/components/admin/admin-apps-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminAppsPageData } from "@/lib/admin/service";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function AppsPage() {
  await requireAdminPageAccess();
  const initialSnapshot = await getAdminAppsPageData(await getRequestLocale());

  return <AdminAppsPageShell initialSnapshot={initialSnapshot} />;
}
