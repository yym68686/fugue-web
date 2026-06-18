import { PageHeader } from "@/components/coss/ui";
import { AdminAppsConsole } from "@/components/fugue-coss/interactive";
import { AdminShell } from "@/components/fugue-coss/shells";

export default function AdminAppsPage() {
  return (
    <AdminShell breadcrumbs={[{ href: "/app/apps", label: "Admin" }, { label: "Apps" }]}>
      <PageHeader
        title="Admin apps"
        description="Cluster-wide applications, owners, resource usage, routes, phase, runtime, source, tech stack, rebuild, and delete."
      />
      <AdminAppsConsole />
    </AdminShell>
  );
}
