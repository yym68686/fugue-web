import { NextResponse } from "next/server";

import { resolveOwnedNodeKey } from "@/lib/console/key-guard";
import {
  jsonError,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { renameManagedNodeKey } from "@/lib/workspace/store";

/**
 * Rename a node key. This is LOCAL-only — the control plane exposes no node-key
 * label update, so the display name is stored as label_override in the mirror
 * (which the /servers page prefers over the synced label). No control-plane call
 * is made.
 */
export async function PATCH(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const owned = await resolveOwnedNodeKey(id);
  if (owned.response) return owned.response;

  let body: { label?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return jsonError(400, "Enter a name for the node.");
  if (label.length > 120) return jsonError(400, "Node name is too long.");

  await renameManagedNodeKey({ email: owned.email, nodeKeyId: id, label });
  return NextResponse.json({ ok: true, result: { label } });
}
