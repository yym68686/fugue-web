import { PageHeader } from "@/components/coss/ui";
import { ProjectGallery } from "@/components/fugue-coss/interactive";
import { ConsoleShell } from "@/components/fugue-coss/shells";

export default function ConsoleProjectsPage() {
  return (
    <ConsoleShell breadcrumbs={[{ href: "/app", label: "Workspace" }, { label: "Projects" }]}>
      <PageHeader
        title="Projects"
        description="Track project lifecycle, workload placement, and resource usage from the live Fugue workspace."
      />
      <ProjectGallery />
    </ConsoleShell>
  );
}
