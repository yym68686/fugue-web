import { Button } from "@fugue/ui/components/button";
import Link from "next/link";

import { ProjectWorkbench } from "@/components/console/islands/project-workbench";
import { PageHeader } from "@/components/shared/page-header";
import { requireActivePageSession } from "@/lib/auth/page-access";
import { getConsoleProjectDetailData } from "@/lib/console/gallery-data";
import type { ConsoleProjectDetailData } from "@/lib/console/gallery-types";
import { createProjectWorkbenchStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

type ProjectPageProps = {
  params: Promise<{ projectId: string }> | { projectId: string };
};

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  await requireActivePageSession();
  const { projectId } = await Promise.resolve(params);
  const { locale, t } = await getRequestI18n();
  let initialDetail: ConsoleProjectDetailData | undefined;

  try {
    initialDetail = await getConsoleProjectDetailData(projectId, locale);
  } catch {
    initialDetail = undefined;
  }

  return (
    <>
      <PageHeader
        eyebrow={t("Projects")}
        title={projectId}
        description={t(
          "Routes, environment, logs, files, images, observability, settings, backing services, failover, and migration in one workspace.",
        )}
        action={
          <Button render={<Link href="/app" />} variant="outline">
            {t("Back to projects")}
          </Button>
        }
      />
      <ProjectWorkbench
        initialDetail={initialDetail}
        locale={locale}
        messages={createProjectWorkbenchStateMessages(t)}
        projectId={projectId}
      />
    </>
  );
}
