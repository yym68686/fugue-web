import { ProjectGallery } from "@/components/console/islands/project-gallery";
import { PageHeader } from "@/components/shared/page-header";
import { getConsoleProjectGalleryData } from "@/lib/console/gallery-data";
import { createProjectGalleryStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function ConsoleProjectsPage() {
  const { locale, t } = await getRequestI18n();
  const initialData = await getConsoleProjectGalleryData({
    includeProjectImageUsage: false,
    includeRuntimeTargets: false,
    locale,
  }).catch(() => null);

  return (
    <>
      <PageHeader
        title={t("Projects")}
        description={t(
          "Track project lifecycle, workload placement, and resource usage from the live Fugue workspace.",
        )}
      />
      <ProjectGallery
        initialData={
          initialData
            ? { errors: initialData.errors, projects: initialData.projects }
            : undefined
        }
        messages={createProjectGalleryStateMessages(t)}
      />
    </>
  );
}
