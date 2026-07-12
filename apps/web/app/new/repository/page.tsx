import { PageHeader } from "@/components/shared/page-header";
import { NewProjectWizard } from "@/components/deploy/new-project-wizard";
import { NewProjectShell } from "@/components/fugue-coss/shells";
import { getRequestI18n } from "@/lib/i18n/server";
import {
  createNewProjectFormMessages,
  createShellMessages,
} from "@/lib/i18n/ui-messages";

export default async function NewRepositoryPage() {
  const { locale, t } = await getRequestI18n();

  return (
    <NewProjectShell activeStep="Configure" messages={createShellMessages(t)}>
      <PageHeader
        eyebrow={t("New project")}
        title={t("Import a repository, image, or local upload.")}
        description={t(
          "Configure project name, app name, branch, port, runtime target, environment variables, network mode, and persistent storage intent.",
        )}
      />
      <NewProjectWizard locale={locale} messages={createNewProjectFormMessages(t)} />
    </NewProjectShell>
  );
}
