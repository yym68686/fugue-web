import { getAppImages } from "@/lib/fugue/console";
import { readRouteParam, type RouteContextWithParams } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function GET(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  return withWorkspaceKey((key) => getAppImages(key, id));
}
