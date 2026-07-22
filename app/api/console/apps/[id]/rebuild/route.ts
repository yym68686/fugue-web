import { rebuildApp } from "@/lib/fugue/console";
import {
  readJsonBody,
  readOptionalString,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function POST(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const branch = body ? readOptionalString(body, "branch") : "";
  return withWorkspaceKey((key) =>
    rebuildApp(key, id, branch ? { branch } : {}),
  );
}
