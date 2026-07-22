import { deleteApp, patchApp } from "@/lib/fugue/console";
import {
  readJsonBody,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function DELETE(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const force = new URL(request.url).searchParams.get("force") === "true";
  return withWorkspaceKey((key) => deleteApp(key, id, force));
}

export async function PATCH(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const patch: {
    image_mirror_limit?: number;
    startup_command?: string;
  } = {};
  if (body && typeof body.image_mirror_limit === "number") {
    patch.image_mirror_limit = Math.floor(body.image_mirror_limit);
  }
  if (body && typeof body.startup_command === "string") {
    patch.startup_command = body.startup_command;
  }
  return withWorkspaceKey((key) => patchApp(key, id, patch));
}
