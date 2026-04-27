import { ConsoleProjectGallery } from "@/components/console/console-project-gallery-shell";
import {
  getConsoleProjectDetailData,
  getConsoleProjectGallerySummaryData,
} from "@/lib/console/gallery-data";

type Params = Promise<{ projectId: string }> | { projectId: string };

export default async function ProjectDetailPage({
  params,
}: {
  params: Params;
}) {
  const { projectId } = await Promise.resolve(params);
  const [data, initialProjectDetail] = await Promise.all([
    getConsoleProjectGallerySummaryData(),
    getConsoleProjectDetailData(projectId),
  ]);

  return (
    <ConsoleProjectGallery
      initialData={data}
      initialProjectDetail={initialProjectDetail}
      routeProjectId={projectId}
    />
  );
}
