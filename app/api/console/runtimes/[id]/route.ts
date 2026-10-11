import {
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { changeRuntime, runtimeAccess } from "@/lib/servers/access";
import { readActionBody, withServerActor } from "@/lib/servers/route";

export async function GET(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  return withServerActor(async (actor) =>
    runtimeAccess(actor, await readRouteParam(context, "id")),
  );
}

export async function POST(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  return withServerActor(async (actor) =>
    changeRuntime(
      actor,
      await readRouteParam(context, "id"),
      await readActionBody(request),
    ),
  );
}
