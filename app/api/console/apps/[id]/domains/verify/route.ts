import { verifyAppDomain } from "@/lib/fugue/console";
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
  const hostname = body ? readOptionalString(body, "hostname") : "";
  if (!hostname) return jsonError(400, "hostname is required.");
  return withWorkspaceKey((key) => verifyAppDomain(key, id, hostname));
}
