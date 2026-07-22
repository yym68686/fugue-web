import { scaleApp } from "@/lib/fugue/console";
import {
  readJsonBody,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function POST(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const body = (await readJsonBody(request)) as { replicas?: number } | null;
  const replicas =
    body && typeof body.replicas === "number" && body.replicas > 0
      ? Math.floor(body.replicas)
      : 1;
  return withWorkspaceKey((key) => scaleApp(key, id, replicas));
}
