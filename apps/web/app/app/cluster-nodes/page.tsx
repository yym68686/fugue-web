import { ServersConsole } from "@/components/console/islands/servers-console";
import { PageHeader } from "@/components/shared/page-header";
import { requireActivePageSession } from "@/lib/auth/page-access";
import { createServersStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function ClusterNodesPage() {
  await requireActivePageSession();
  const { t } = await getRequestI18n();

  return (
    <>
      <PageHeader
        title={t("Servers")}
        description={t(
          "Runtime servers, heartbeat, roles, pressure signals, capacity, workloads, runtime access, sharing, pool state, and offline cleanup.",
        )}
      />
      <ServersConsole messages={createServersStateMessages(t)} />
    </>
  );
}
