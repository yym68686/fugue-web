import { NextResponse } from "next/server";

import { deleteApiKey, updateApiKey } from "@/lib/fugue/console";
import { resolveOwnedKey } from "@/lib/console/key-guard";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  readRouteParam,
  type RouteContextWithParams,
} from "@/lib/fugue/product-route";
import { WORKSPACE_ADMIN_SCOPES, sortFugueScopes } from "@/lib/fugue/scopes";
import {
  updateManagedApiKeyMeta,
  updateManagedApiKeyStatus,
} from "@/lib/workspace/store";

/**
 * Edit an API key's name and/or scopes (PATCH /v1/api-keys/{id}), then re-mirror
 * the change locally. Scopes are validated against WORKSPACE_ADMIN_SCOPES up
 * front; the backend independently enforces that a key cannot gain scopes the
 * admin key does not itself hold.
 */
export async function PATCH(
  request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const owned = await resolveOwnedKey(id);
  if (owned.response) return owned.response;

  let body: { label?: unknown; scopes?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const patch: { label?: string; scopes?: string[] } = {};

  if (body.label !== undefined) {
    if (typeof body.label !== "string") {
      return jsonError(400, "Enter a name for the key.");
    }
    const label = body.label.trim();
    if (!label) return jsonError(400, "Enter a name for the key.");
    if (label.length > 120) return jsonError(400, "Key name is too long.");
    patch.label = label;
  }

  if (body.scopes !== undefined) {
    if (!Array.isArray(body.scopes)) {
      return jsonError(400, "Choose at least one scope.");
    }
    const allowed = new Set<string>(WORKSPACE_ADMIN_SCOPES);
    const requested = sortFugueScopes(
      body.scopes.filter((scope): scope is string => typeof scope === "string"),
    );
    if (requested.length === 0) {
      return jsonError(400, "Choose at least one scope.");
    }
    const invalid = requested.filter((scope) => !allowed.has(scope));
    if (invalid.length > 0) {
      return jsonError(400, `Unsupported scopes: ${invalid.join(", ")}`);
    }
    patch.scopes = requested;
  }

  if (patch.label === undefined && patch.scopes === undefined) {
    return jsonError(400, "Nothing to update.");
  }

  try {
    const updated = await updateApiKey(owned.adminKeySecret, id, patch);
    const apiKey = updated.api_key;

    // Mirror what the backend actually stored where available, else the request.
    await updateManagedApiKeyMeta({
      email: owned.email,
      fugueKeyId: id,
      label: apiKey?.label ?? patch.label,
      scopes: apiKey?.scopes?.length ? apiKey.scopes : patch.scopes,
    });

    return NextResponse.json({
      ok: true,
      result: {
        key: {
          id,
          label: apiKey?.label ?? patch.label ?? owned.key.label,
          scopes: apiKey?.scopes?.length
            ? apiKey.scopes
            : patch.scopes ?? owned.key.scopes,
        },
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

/**
 * Permanently delete an API key (DELETE /v1/api-keys/{id}), then soft-delete the
 * local mirror row (status='deleted') so the /keys list — which filters those
 * out — stops showing it.
 */
export async function DELETE(
  _request: Request,
  context: RouteContextWithParams<"id">,
) {
  const id = await readRouteParam(context, "id");
  const owned = await resolveOwnedKey(id);
  if (owned.response) return owned.response;

  try {
    await deleteApiKey(owned.adminKeySecret, id);
    await updateManagedApiKeyStatus({
      email: owned.email,
      fugueKeyId: id,
      status: "deleted",
    });
    return NextResponse.json({ ok: true, result: { deleted: true } });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
