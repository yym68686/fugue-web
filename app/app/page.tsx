import { Suspense } from "react";

import { ConsoleProjectGallery } from "@/components/console/console-project-gallery-shell";
import {
  ConsoleLoadingState,
  ConsoleProjectGalleryTransitionSkeleton,
} from "@/components/console/console-page-skeleton";
import { getConsoleProjectGallerySummaryData } from "@/lib/console/gallery-data";
import { getRequestI18n } from "@/lib/i18n/server";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function AppConsolePageContent({
  defaultCreateOpen,
  initialPendingIntentId,
  locale,
}: {
  defaultCreateOpen: boolean;
  initialPendingIntentId: string | null;
  locale: Awaited<ReturnType<typeof getRequestI18n>>["locale"];
}) {
  const data = await getConsoleProjectGallerySummaryData(locale);

  return (
    <ConsoleProjectGallery
      initialData={data}
      defaultCreateOpen={defaultCreateOpen}
      initialPendingIntentId={initialPendingIntentId}
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
  const initialPendingIntentId = readValue(resolved.intent) ?? null;
  const { locale, t } = await getRequestI18n();

  return (
    <Suspense
      fallback={
        <ConsoleLoadingState label={t("Loading projects")}>
          <ConsoleProjectGalleryTransitionSkeleton />
        </ConsoleLoadingState>
      }
    >
      <AppConsolePageContent
        defaultCreateOpen={dialog === "create"}
        initialPendingIntentId={initialPendingIntentId}
        locale={locale}
      />
    </Suspense>
  );
}
