import { getAppFilesystemTree } from "@/lib/fugue/console";
import { readRouteParam, type RouteContextWithParams } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function GET(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const path = new URL(request.url).searchParams.get("path") ?? undefined;
  return withWorkspaceKey((key) => getAppFilesystemTree(key, id, { depth: 2, path }));
}
