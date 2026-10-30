import { getAppMail, putAppMail, FugueApiError } from "@/lib/fugue/console";
import { readRouteParam, type RouteContextWithParams } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";
import { mailNoStore, readMailMutation } from "@/lib/fugue/mail-route";

export async function GET(_request: Request, context: RouteContextWithParams<"id">) {
  const id = await readRouteParam(context, "id");
  return mailNoStore(await withWorkspaceKey(key => getAppMail(key, id)));
}
export async function PUT(request: Request, context: RouteContextWithParams<"id">) {
  const id = await readRouteParam(context, "id");
  return mailNoStore(await withWorkspaceKey(async key => {
    const body = await readMailMutation(request);
    if ((body.state !== "active" && body.state !== "suspended" && body.state !== "revoked") || typeof body.expected_generation !== "number" || !Number.isSafeInteger(body.expected_generation) || body.expected_generation < 0 || typeof body.local_part !== "string") throw new FugueApiError(400, "Invalid mail intent.");
    return putAppMail(key, id, { state: body.state, expected_generation: body.expected_generation, local_part: body.local_part });
  }));
}
