import { getAppMailDNS } from "@/lib/fugue/console";
import { readRouteParam, type RouteContextWithParams } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";
import { mailNoStore } from "@/lib/fugue/mail-route";

export async function GET(_request: Request, context: RouteContextWithParams<"id">) {
  const id = await readRouteParam(context, "id");
  return mailNoStore(await withWorkspaceKey(key => getAppMailDNS(key, id)));
}
