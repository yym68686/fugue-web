import { AdminClusterPageShell } from "@/components/admin/admin-cluster-page-shell";
import { requireAdminPageAccess } from "@/lib/admin/auth";

export default async function ClusterPage() {
  await requireAdminPageAccess();

  return <AdminClusterPageShell />;
}
