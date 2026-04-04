import { Suspense } from "react";

import { ConsoleProjectGallery } from "@/components/console/console-project-gallery-shell";
import {
  ConsoleLoadingState,
  ConsoleProjectGalleryTransitionSkeleton,
} from "@/components/console/console-page-skeleton";
import { getConsoleProjectGallerySummaryData } from "@/lib/console/gallery-data";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function AppConsolePageContent({
  defaultCreateOpen,
}: {
  defaultCreateOpen: boolean;
}) {
  const data = await getConsoleProjectGallerySummaryData();

  return (
    <ConsoleProjectGallery
      initialData={data}
      defaultCreateOpen={defaultCreateOpen}
    />
  );
}

export default async function AppConsolePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await Promise.resolve(searchParams);
  const dialog = readValue(resolved.dialog);

  return (
    <Suspense
      fallback={
        <ConsoleLoadingState label="Loading projects">
          <ConsoleProjectGalleryTransitionSkeleton />
        </ConsoleLoadingState>
      }
    >
      <AppConsolePageContent defaultCreateOpen={dialog === "create"} />
    </Suspense>
  );
}
