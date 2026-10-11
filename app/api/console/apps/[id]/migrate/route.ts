import {
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { migrationSettings, requestMigration } from "@/lib/servers/deployment";
import { readActionBody, withServerActor } from "@/lib/servers/route";

export async function GET(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  return withServerActor(async (actor) =>
    migrationSettings(
      actor,
      await readRouteParam(context, "id"),
      new URL(request.url).searchParams.get("operation") ?? undefined,
    ),
  );
}
export async function POST(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  return withServerActor(async (actor) =>
    requestMigration(
      actor,
      await readRouteParam(context, "id"),
      await readActionBody(request),
    ),
  );
}
