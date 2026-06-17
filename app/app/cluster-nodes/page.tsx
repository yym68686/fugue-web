import { PageHeader } from "@/components/coss/ui";
import { ServersConsole } from "@/components/fugue-coss/interactive";
import { ConsoleShell } from "@/components/fugue-coss/shells";

export default function ClusterNodesPage() {
  return (
    <ConsoleShell>
      <PageHeader
        title="Servers"
        description="Runtime servers, heartbeat, roles, pressure signals, capacity, workloads, runtime access, sharing, pool state, and offline cleanup."
      />
      <ServersConsole />
    </ConsoleShell>
  );
}
