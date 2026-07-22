import { deleteImage } from "@/lib/fugue/console";
import {
  jsonError,
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
  const imageRef = body ? readOptionalString(body, "image_ref") : "";
  if (!imageRef) return jsonError(400, "image_ref is required.");
  return withWorkspaceKey((key) => deleteImage(key, id, imageRef));
}
