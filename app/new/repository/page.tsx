import { DeployPage } from "@/components/deploy/deploy-page";
import {
  getCurrentDeployWorkspaceInventory,
  getDeployPageShellData,
} from "@/lib/deploy/page-data";
import { buildDeployHref, readDeploySearchState } from "@/lib/deploy/query";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

export default async function NewRepositoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await Promise.resolve(searchParams);
  const search = readDeploySearchState(resolved);
  const currentPath = buildDeployHref("/new/repository", search);
  const data = await getDeployPageShellData(search);

  return (
    <DeployPage
      currentPath={currentPath}
      routeMode="repository"
      search={search}
      workspaceInventoryPromise={
        data.sessionPresent ? getCurrentDeployWorkspaceInventory() : null
      }
      {...data}
    />
  );
}
