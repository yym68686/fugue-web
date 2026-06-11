import { AdminClusterPageShell } from "@/components/admin/admin-cluster-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminClusterPageData } from "@/lib/admin/service";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function ClusterPage() {
  await requireAdminPageAccess();
  const locale = await getRequestLocale();
  const initialSnapshot = await getAdminClusterPageData(locale);

  return <AdminClusterPageShell initialSnapshot={initialSnapshot} />;
}
