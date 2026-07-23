import { NextResponse } from "next/server";

import { createApiKey } from "@/lib/fugue/console";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireActiveSessionUser,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";
import { WORKSPACE_ADMIN_SCOPES, sortFugueScopes } from "@/lib/fugue/scopes";
import { persistManagedApiKey } from "@/lib/workspace/store";

/**
 * Mint a new API key in the caller's workspace, then mirror its metadata into
 * the local app_api_keys table the /keys page reads from. The guard chain is
 * spelled out here (rather than via withWorkspaceKey) because persistence also
 * needs the session email, not just the admin key.
 *
 * The requested scopes are validated against WORKSPACE_ADMIN_SCOPES up front so
 * a bad selection fails fast with a clear message; the backend independently
 * enforces that a key can only mint scopes its own key holds.
 */
export async function POST(request: Request) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;

  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return ws.response;

  let body: { label?: unknown; scopes?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) {
    return jsonError(400, "Enter a name for the key.");
  }
  if (label.length > 120) {
    return jsonError(400, "Key name is too long.");
  }

  const allowed = new Set<string>(WORKSPACE_ADMIN_SCOPES);
  const requested = Array.isArray(body.scopes)
    ? sortFugueScopes(
        body.scopes.filter((scope): scope is string => typeof scope === "string"),
      )
    : [];
  if (requested.length === 0) {
    return jsonError(400, "Choose at least one scope.");
  }
  const invalid = requested.filter((scope) => !allowed.has(scope));
  if (invalid.length > 0) {
    return jsonError(400, `Unsupported scopes: ${invalid.join(", ")}`);
  }

  try {
    const created = await createApiKey(ws.workspace.adminKeySecret, {
      label,
      scopes: requested,
    });

    const apiKey = created.api_key;
    const secret = created.secret;
    if (!apiKey?.id || !secret) {
      return jsonError(502, "Key creation returned no secret.");
    }

    const scopes = apiKey.scopes?.length ? apiKey.scopes : requested;

    await persistManagedApiKey({
      email: auth.session.email,
      key: {
        id: apiKey.id,
        tenantId: apiKey.tenant_id || ws.workspace.tenantId,
        label: apiKey.label || label,
        prefix: apiKey.prefix ?? null,
        scopes,
        createdAt: apiKey.created_at ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      result: {
        secret,
        key: {
          id: apiKey.id,
          label: apiKey.label || label,
          prefix: apiKey.prefix ?? null,
          scopes,
        },
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
