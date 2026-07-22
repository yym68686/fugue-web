import { getAppObservabilityMetrics } from "@/lib/fugue/console";
import { readRouteParam, type RouteContextWithParams } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function GET(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const since = new URL(request.url).searchParams.get("since") || "1h";
  return withWorkspaceKey((key) => getAppObservabilityMetrics(key, id, since));
}
