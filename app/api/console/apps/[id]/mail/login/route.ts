import { setAppMailboxLogin, FugueApiError } from "@/lib/fugue/console";
import { readRouteParam, type RouteContextWithParams } from "@/lib/fugue/product-route";
import { withWorkspaceKey } from "@/lib/console/route-helpers";
import { mailNoStore, readMailMutation } from "@/lib/fugue/mail-route";

export async function POST(request: Request, context: RouteContextWithParams<"id">) {
  const id = await readRouteParam(context, "id");
  return mailNoStore(await withWorkspaceKey(async key => {
    const body = await readMailMutation(request);
    if (typeof body.generation !== "number" || !Number.isSafeInteger(body.generation) || body.generation < 1 || typeof body.mailbox_id !== "string" || !body.mailbox_id || body.mailbox_id.length > 160 || typeof body.enabled !== "boolean") throw new FugueApiError(400, "Invalid mailbox login request.");
    return setAppMailboxLogin(key, id, { generation: body.generation, mailbox_id: body.mailbox_id, enabled: body.enabled });
  }));
}
