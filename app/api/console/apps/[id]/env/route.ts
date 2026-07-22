import { getAppEnv, patchAppEnv } from "@/lib/fugue/console";
import {
  readJsonBody,
  readRouteParam,
  readStringMap,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function GET(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  return withWorkspaceKey((key) => getAppEnv(key, id));
}

export async function PATCH(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const body = (await readJsonBody(request)) as {
    set?: unknown;
    delete?: unknown;
  } | null;

  const set = readStringMap(body?.set);
  const del = Array.isArray(body?.delete)
    ? body!.delete.filter((k): k is string => typeof k === "string")
    : [];

  return withWorkspaceKey((key) => patchAppEnv(key, id, { set, delete: del }));
}
