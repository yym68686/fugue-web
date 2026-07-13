import { AdminClusterConsole } from "@/components/console/islands/admin-cluster-console";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { createAdminClusterStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function AdminClusterPage() {
  await requireAdminPageAccess();
  const { t } = await getRequestI18n();

  return (
    <>
      <PageHeader
        title={t("Admin cluster")}
        description={t(
          "Control plane status, runtime nodes, platform join keys, runtime node policy, build allowance, workload placement, and reconcile state.",
        )}
      />
      <AdminClusterConsole stateMessages={createAdminClusterStateMessages(t)} />
    </>
  );
}
