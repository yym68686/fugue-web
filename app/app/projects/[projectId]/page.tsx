import { ConsoleProjectGallery } from "@/components/console/console-project-gallery-shell";
import { getConsoleProjectGallerySummaryData } from "@/lib/console/gallery-data";

type Params = Promise<{ projectId: string }> | { projectId: string };

export default async function ProjectDetailPage({
  params,
}: {
  params: Params;
}) {
  const { projectId } = await Promise.resolve(params);
  const data = await getConsoleProjectGallerySummaryData();

  return (
    <ConsoleProjectGallery
      initialData={data}
      routeProjectId={projectId}
    />
  );
}
