import { addAppDomain, deleteAppDomain, getAppDomains } from "@/lib/fugue/console";
import {
  jsonError,
  readJsonBody,
  readOptionalString,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";

export async function GET(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  return withWorkspaceKey((key) => getAppDomains(key, id));
}

export async function POST(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const body = (await readJsonBody(request)) as Record<string, unknown> | null;
  const hostname = body ? readOptionalString(body, "hostname") : "";
  if (!hostname) return jsonError(400, "hostname is required.");
  const dnsMode = body ? readOptionalString(body, "dns_mode") : "";
  return withWorkspaceKey((key) =>
    addAppDomain(key, id, {
      hostname,
      dns_mode: dnsMode || undefined,
    }),
  );
}

export async function DELETE(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const hostname = new URL(request.url).searchParams.get("hostname") ?? "";
  if (!hostname) return jsonError(400, "hostname is required.");
  return withWorkspaceKey((key) => deleteAppDomain(key, id, hostname));
}
