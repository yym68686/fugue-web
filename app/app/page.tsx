import { PageHeader } from "@/components/coss/ui";
import { ProjectGallery } from "@/components/fugue-coss/interactive";
import { ConsoleShell } from "@/components/fugue-coss/shells";

export default function ConsoleProjectsPage() {
  return (
    <ConsoleShell>
      <PageHeader
        title="Projects"
        description="Workspace projects, lifecycle state, service count, resource usage, and creation progress."
      />
      <ProjectGallery />
    </ConsoleShell>
  );
}
