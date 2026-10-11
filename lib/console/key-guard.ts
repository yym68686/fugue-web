import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireActiveSessionUser,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";
import {
  getManagedApiKeyForUser,
  getManagedNodeKeyForUser,
} from "@/lib/workspace/store";
import { listNodeKeys } from "@/lib/fugue/console";

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
      response: jsonError(
        403,
        "The workspace admin key cannot be modified here.",
      ),
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
 * Resolve an owner-scoped mirror or an active backend-owned key created via CLI.
 * A visible shared runtime never grants authority over its enrollment key.
 */
export async function resolveOwnedNodeKey(id: string) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return { response: auth.response } as const;

  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return { response: ws.response } as const;

  let key = await getManagedNodeKeyForUser(auth.session.email, id);
  if (!key) {
    // CLI-created keys can lack a local mirror. Require exact backend ownership.
    let live;
    try {
      live = (await listNodeKeys(ws.workspace.adminKeySecret)).node_keys?.find(
        (k) => k.id === id && k.tenant_id === ws.workspace.tenantId && k.status === "active",
      );
    } catch (error) {
      return { response: jsonError(readErrorStatus(error), readErrorMessage(error)) } as const;
    }
    if (live)
      key = {
        fugue_node_key_id: live.id,
        tenant_id: ws.workspace.tenantId,
        label: live.label,
        status: "active",
      };
  }
  if (!key || key.tenant_id !== ws.workspace.tenantId) {
    return { response: jsonError(404, "Node key not found.") } as const;
  }

  return {
    response: null,
    email: auth.session.email,
    adminKeySecret: ws.workspace.adminKeySecret,
    key,
  } as const;
}
