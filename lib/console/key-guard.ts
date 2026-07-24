import {
  jsonError,
  requireActiveSessionUser,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";
import {
  getManagedApiKeyForUser,
  getManagedNodeKeyForUser,
} from "@/lib/workspace/store";

/**
 * Guard chain shared by the per-key mutation routes (PATCH/DELETE/disable/
 * enable). Resolves the session + workspace admin key, then loads the key from
 * the local mirror scoped to the caller. Returning the mirrored row here is what
 * enforces authorization: a key absent from the caller's mirror yields 404
 * (never touching the control plane), and the workspace admin key is refused
 * outright — the user-facing controls must never disable/delete/edit the key the
 * app itself acts with.
 */
export async function resolveOwnedKey(id: string) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return { response: auth.response } as const;

  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return { response: ws.response } as const;

  const key = await getManagedApiKeyForUser(auth.session.email, id);
  if (!key) {
    return { response: jsonError(404, "Key not found.") } as const;
  }
  if (key.is_workspace_admin) {
    return {
      response: jsonError(403, "The workspace admin key cannot be modified here."),
    } as const;
  }

  return {
    response: null,
    email: auth.session.email,
    adminKeySecret: ws.workspace.adminKeySecret,
    key,
  } as const;
}

/**
 * Guard chain for the per-node-key mutation routes (revoke/rename). Same shape
 * as resolveOwnedKey: resolves the session + workspace admin key, then loads the
 * node key from the local mirror scoped to the caller (a key absent from the
 * caller's mirror yields 404 without touching the control plane).
 */
export async function resolveOwnedNodeKey(id: string) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return { response: auth.response } as const;

  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return { response: ws.response } as const;

  const key = await getManagedNodeKeyForUser(auth.session.email, id);
  if (!key) {
    return { response: jsonError(404, "Node key not found.") } as const;
  }

  return {
    response: null,
    email: auth.session.email,
    adminKeySecret: ws.workspace.adminKeySecret,
    key,
  } as const;
}
