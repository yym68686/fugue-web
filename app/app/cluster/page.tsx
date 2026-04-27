import { AdminClusterPageShell } from "@/components/admin/admin-cluster-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminClusterPageData } from "@/lib/admin/service";

export default async function ClusterPage() {
  await requireAdminPageAccess();
  const initialSnapshot = await getAdminClusterPageData();

  return <AdminClusterPageShell initialSnapshot={initialSnapshot} />;
}
