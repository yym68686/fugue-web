import {
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import {
  changeProjectRuntime,
  projectRuntimeSettings,
} from "@/lib/servers/deployment";
import { readActionBody, withServerActor } from "@/lib/servers/route";

export async function GET(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  return withServerActor(async (actor) =>
    projectRuntimeSettings(actor, await readRouteParam(context, "id")),
  );
}
export async function POST(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  return withServerActor(async (actor) =>
    changeProjectRuntime(
      actor,
      await readRouteParam(context, "id"),
      await readActionBody(request),
    ),
  );
}
