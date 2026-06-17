import { ButtonLink, PageHeader } from "@/components/coss/ui";
import { ProjectWorkbench } from "@/components/fugue-coss/interactive";
import { ConsoleShell } from "@/components/fugue-coss/shells";

type ProjectPageProps = {
  params: Promise<{ projectId: string }> | { projectId: string };
};

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { projectId } = await Promise.resolve(params);

  return (
    <ConsoleShell>
      <PageHeader
        eyebrow="Projects"
        title={projectId}
        description="Routes, environment, logs, files, images, observability, settings, backing services, failover, and migration in one COSS workbench."
        action={<ButtonLink href="/app" variant="outline">Back to projects</ButtonLink>}
      />
      <ProjectWorkbench projectId={projectId} />
    </ConsoleShell>
  );
}
