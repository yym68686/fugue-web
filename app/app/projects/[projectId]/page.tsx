import { ConsoleProjectGallery } from "@/components/console/console-project-gallery-shell";
import { getConsoleProjectDetailData } from "@/lib/console/gallery-data";
import type { ConsoleProjectGallerySummaryData } from "@/lib/console/gallery-types";
import { readConsoleProjectLifecycle } from "@/lib/console/project-lifecycle";

type Params = Promise<{ projectId: string }> | { projectId: string };

export default async function ProjectDetailPage({
  params,
}: {
  params: Params;
}) {
  const { projectId } = await Promise.resolve(params);
  const initialProjectDetail = await getConsoleProjectDetailData(projectId);
  const project = initialProjectDetail.project;
  const data = {
    errors: [],
    projects: project
      ? [
          {
            appCount: project.appCount,
            id: project.id,
            lifecycle: readConsoleProjectLifecycle(project),
            name: project.name,
            resourceUsage: project.resourceUsage,
            resourceUsageSnapshot: project.resourceUsageSnapshot,
            serviceBadges: project.serviceBadges,
            serviceCount: project.serviceCount,
          },
        ]
      : [],
    workspace: {
      exists: true,
      stage: project ? "ready" : "empty",
    },
  } satisfies ConsoleProjectGallerySummaryData;

  return (
    <ConsoleProjectGallery
      initialData={data}
      initialProjectDetail={initialProjectDetail}
      routeProjectId={projectId}
    />
  );
}
