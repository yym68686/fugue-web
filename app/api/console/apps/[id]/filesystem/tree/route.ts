import { getAppFilesystemTree } from "@/lib/fugue/console";
import { readRouteParam, type RouteContextWithParams } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function GET(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const search = new URL(request.url).searchParams;
  const path = search.get("path") ?? undefined;
  const pod = search.get("pod") ?? undefined;
  // The backend supports only depth=1; the browser fetches each level on demand.
  return withWorkspaceKey((key) => getAppFilesystemTree(key, id, { depth: 1, path, pod }));
}
