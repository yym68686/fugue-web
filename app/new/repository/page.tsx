import { PageHeader } from "@/components/coss/ui";
import { NewProjectWizard } from "@/components/fugue-coss/interactive";
import { NewProjectShell } from "@/components/fugue-coss/shells";

export default function NewRepositoryPage() {
  return (
    <NewProjectShell activeStep="Configure">
      <PageHeader
        eyebrow="New project"
        title="Import a repository, image, or local upload."
        description="Configure project name, app name, branch, port, runtime target, environment variables, network mode, and persistent storage intent."
      />
      <NewProjectWizard />
    </NewProjectShell>
  );
}
