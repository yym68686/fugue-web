import { NextResponse } from "next/server";
import { resolveOwnedNodeKey } from "@/lib/console/key-guard";
import { buildNodeJoinCommand, listNodeKeys } from "@/lib/fugue/console";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { readNodeKeySecret } from "@/lib/servers/node-keys";

// Explicit POST only: secrets never enter prefetched pages or RSC responses.
export async function POST(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  try {
    const id = await readRouteParam(context, "id");
    const actor = await resolveOwnedNodeKey(id);
    if (actor.response) return actor.response;
    const live = (await listNodeKeys(actor.adminKeySecret)).node_keys?.find(
      (k) => k.id === id,
    );
    if (
      actor.key.status !== "active" ||
      live?.status !== "active" ||
      live.tenant_id !== actor.key.tenant_id
    )
      return jsonError(409, "This node key is not active.");
    const stored = await readNodeKeySecret(
      actor.email,
      actor.key.tenant_id,
      id,
    );
    if (!stored.found) return jsonError(404, "Node key not found.");
    if (!stored.secret)
      return jsonError(
        409,
        "This key's secret was not saved. Create a new key to copy it.",
      );
    const body = JSON.stringify({
      ok: true,
      result: {
        secret: stored.secret,
        joinCommand: buildNodeJoinCommand(stored.secret),
      },
    });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "Content-Length": String(new TextEncoder().encode(body).byteLength),
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
