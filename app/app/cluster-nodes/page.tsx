import { ConsoleClusterNodesPageShell } from "@/components/console/console-cluster-nodes-page-shell";
import { getClusterNodesPageData } from "@/lib/cluster-nodes/service";
import type { ConsoleClusterNodesPageSnapshot } from "@/lib/console/page-snapshot-types";
import { requireSessionUser } from "@/lib/fugue/product-route";
import { getRequestLocale } from "@/lib/i18n/server";

export default async function ClusterNodesPage() {
  let initialSnapshot: ConsoleClusterNodesPageSnapshot | null = null;
  const { session, user } = await requireSessionUser();

  if (session) {
    const data = await getClusterNodesPageData(
      session.email,
      await getRequestLocale(),
    );
    initialSnapshot = data
      ? {
          data,
          isAdmin: user?.isAdmin ?? false,
          state: "ready",
        }
      : {
          state: "workspace-missing",
        };
  }

  return <ConsoleClusterNodesPageShell initialSnapshot={initialSnapshot} />;
}
