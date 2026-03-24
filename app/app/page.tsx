import { ConsoleProjectGallery } from "@/components/console/console-project-gallery";
import { getConsoleProjectGalleryData } from "@/lib/console/gallery-data";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AppConsolePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const data = await getConsoleProjectGalleryData();
  const resolved = await Promise.resolve(searchParams);
  const dialog = readValue(resolved.dialog);

  return (
    <ConsoleProjectGallery
      data={data}
      defaultCreateOpen={dialog === "create"}
    />
  );
}
