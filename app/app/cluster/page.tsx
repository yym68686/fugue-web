import { PageHeader } from "@/components/coss/ui";
import { AdminClusterConsole } from "@/components/fugue-coss/interactive";
import { AdminShell } from "@/components/fugue-coss/shells";

export default function AdminClusterPage() {
  return (
    <AdminShell breadcrumbs={[{ href: "/app/apps", label: "Admin" }, { label: "Cluster" }]}>
      <PageHeader
        title="Admin cluster"
        description="Control plane status, runtime nodes, platform join keys, runtime node policy, build allowance, workload placement, and reconcile state."
      />
      <AdminClusterConsole />
    </AdminShell>
  );
}
