import { deleteProject, patchProject } from "@/lib/fugue/console";
import {
  jsonError,
  readJsonBody,
  readOptionalString,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function PATCH(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const patch: { name?: string; description?: string } = {};
  if (body && typeof body.name === "string") {
    const name = readOptionalString(body, "name");
    if (!name) return jsonError(400, "name cannot be empty.");
    patch.name = name;
  }
  if (body && typeof body.description === "string") {
    patch.description = body.description;
  }
  return withWorkspaceKey((key) => patchProject(key, id, patch));
}

export async function DELETE(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  // Console delete is a cascade delete: it removes the project along with all
  // of its apps and backing services. Without cascade the backend returns 409
  // whenever any live app/service remains.
  return withWorkspaceKey((key) => deleteProject(key, id, { cascade: true }));
}
