import { AdminClusterOverview } from "@/components/admin/admin-cluster-overview";
import { AdminSummaryGrid } from "@/components/admin/admin-summary-grid";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { ToastOnMount } from "@/components/ui/toast-on-mount";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminClusterPageData } from "@/lib/admin/service";

export default async function ClusterPage() {
  await requireAdminPageAccess();
  const data = await getAdminClusterPageData();
  const errorMessage = data.errors.length
    ? `Partial admin data: ${data.errors.join(" | ")}.`
    : null;

  return (
    <div className="fg-console-page">
      <ToastOnMount message={errorMessage} variant="error" />

      <ConsolePageIntro
        actions={[
          { href: "/app/apps", label: "Inspect apps" },
        ]}
        description="Node health, capacity, and workload placement across the cluster."
        eyebrow="Admin / Cluster"
        title="Cluster"
      />

      <AdminSummaryGrid
        items={[
          { label: "Nodes", value: data.summary.nodeCount },
          { label: "Clear", value: data.summary.readyCount },
          { label: "Attention", value: data.summary.pressuredCount },
          { label: "Workloads", value: data.summary.workloadCount },
        ]}
      />

      <AdminClusterOverview nodes={data.nodes} />
    </div>
  );
}
