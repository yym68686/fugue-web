import { redirect } from "next/navigation";

import { DeployPage } from "@/components/deploy/deploy-page";
import { getDeployPageData } from "@/lib/deploy/page-data";
import { buildDeployHref, readDeploySearchState } from "@/lib/deploy/query";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

export default async function NewTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams: SearchParams;
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const search = readDeploySearchState(resolvedSearchParams);
  const currentPath = buildDeployHref(`/new/template/${resolvedParams.slug}`, search);
  const data = await getDeployPageData(search);
  const canonicalSlug = data.inspection?.template?.slug ?? null;

  if (canonicalSlug && canonicalSlug !== resolvedParams.slug) {
    redirect(buildDeployHref(`/new/template/${canonicalSlug}`, search));
  }

  return (
    <DeployPage
      currentPath={currentPath}
      requestedTemplateSlug={resolvedParams.slug}
      routeMode="template"
      search={search}
      {...data}
    />
  );
}
