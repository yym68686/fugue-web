import { Alert, Badge, Button, ButtonLink, Empty, PageHeader } from "@/components/coss/ui";
import { ProjectWorkbench } from "@/components/fugue-coss/interactive";
import { ConsoleShell } from "@/components/fugue-coss/shells";

type ProjectPageProps = {
  params: Promise<{ projectId: string }> | { projectId: string };
};

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { projectId } = await Promise.resolve(params);
  if (projectId === "missing") {
    return (
      <ConsoleShell>
        <Empty title="Project not found" description="The requested project does not exist in this workspace." action={<ButtonLink href="/app">Back to projects</ButtonLink>} />
      </ConsoleShell>
    );
  }

  if (projectId === "forbidden") {
    return (
      <ConsoleShell>
        <Alert tone="destructive" title="Permission denied">
          You do not have access to this workspace project.
        </Alert>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Projects"
        title={projectId}
        description="Routes, environment, logs, files, images, observability, settings, backing services, failover, and migration in one COSS workbench."
        action={
          <div className="coss-actions">
            <Badge tone="success">Running</Badge>
            <Button>Add service</Button>
          </div>
        }
      />
      {projectId === "empty" ? (
        <Empty title="No services yet" description="Keep the project empty, or add the first app/backing service." action={<Button>Add service</Button>} />
      ) : (
        <ProjectWorkbench />
      )}
    </ConsoleShell>
  );
}
