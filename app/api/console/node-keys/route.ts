import { NextResponse } from "next/server";

import { buildNodeJoinCommand, createNodeKey } from "@/lib/fugue/console";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireActiveSessionUser,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";
import { persistManagedNodeKey } from "@/lib/workspace/store";
import { sealText } from "@/lib/security/seal";

/**
 * Mint a node-enrollment key in the caller's workspace, mirror its metadata
 * locally, and return the join command the user runs on their VPS. The guard
 * chain is inline (not withWorkspaceKey) because persistence also needs the
 * session email and the tenant id. The backend returns the secret once;
 * the web mirror encrypts it for owner-only copying.
 */
export async function POST(request: Request) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;

  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return ws.response;

  let body: { label?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body))
    return jsonError(400, "Invalid request body.");

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) {
    return jsonError(400, "Enter a name for the node.");
  }
  if (label.length > 120) {
    return jsonError(400, "Node name is too long.");
  }

  try {
    // Validate both prerequisites before minting a credential.
    buildNodeJoinCommand("");
    sealText("node-key-storage-preflight");
    const created = await createNodeKey(ws.workspace.adminKeySecret, {
      label,
      tenantId: ws.workspace.tenantId,
    });

    const nodeKey = created.node_key;
    const secret = created.secret;
    if (!nodeKey?.id || !secret) {
      return jsonError(502, "Node key creation returned no secret.");
    }

    await persistManagedNodeKey({
      email: auth.session.email,
      secret,
      key: {
        id: nodeKey.id,
        tenantId: nodeKey.tenant_id || ws.workspace.tenantId,
        label: nodeKey.label || label,
        prefix: nodeKey.prefix ?? null,
        createdAt: nodeKey.created_at ?? null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        result: {
          secret,
          joinCommand: buildNodeJoinCommand(secret),
          key: {
            id: nodeKey.id,
            label: nodeKey.label || label,
            prefix: nodeKey.prefix ?? null,
          },
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
