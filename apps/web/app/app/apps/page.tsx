import { AdminAppsConsole } from "@/components/console/islands/admin-apps-console";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { createAdminAppsStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function AdminAppsPage() {
  await requireAdminPageAccess();
  const { t } = await getRequestI18n();

  return (
    <>
      <PageHeader
        title={t("Admin apps")}
        description={t(
          "Cluster-wide applications, owners, resource usage, routes, phase, runtime, source, tech stack, rebuild, and delete.",
        )}
      />
      <AdminAppsConsole messages={createAdminAppsStateMessages(t)} />
    </>
  );
}
