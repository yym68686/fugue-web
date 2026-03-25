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
          { href: "/app/runtimes", label: "Runtime placement", variant: "primary" },
        ]}
        description="Server-level memory, CPU, disk, IP, region, and Fugue workload placement across the live cluster."
        eyebrow="Admin / cluster"
        title="Cluster"
      />

      <AdminSummaryGrid
        items={[
          { label: "nodes", value: data.summary.nodeCount },
          { label: "clear", value: data.summary.readyCount },
          { label: "attention", value: data.summary.pressuredCount },
          { label: "workloads", value: data.summary.workloadCount },
        ]}
      />

      <AdminClusterOverview nodes={data.nodes} />
    </div>
  );
}
