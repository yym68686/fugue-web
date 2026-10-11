import { NextResponse } from "next/server";

import { revokeOwnedNodeKey } from "@/lib/console/delete-node-key";
import { resolveOwnedNodeKey } from "@/lib/console/key-guard";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";

/**
 * Revoke (disable) a node-enrollment key, then mirror status='revoked' locally.
 * Any VPS already enrolled with it is cleaned up by the backend.
 */
export async function POST(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const owned = await resolveOwnedNodeKey(id);
  if (owned.response) return owned.response;

  try {
    await revokeOwnedNodeKey({
      email: owned.email,
      nodeKeyId: id,
      adminKeySecret: owned.adminKeySecret,
    });
    return NextResponse.json({ ok: true, result: { status: "revoked" } });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
