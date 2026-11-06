import "server-only";

import { FugueApiError, getAuthContext, type AuthContext } from "@/lib/fugue/console";
import { updateFugueApiKeyScopes } from "@/lib/fugue/platform-admin";
import { sortFugueScopes, WORKSPACE_ADMIN_SCOPES } from "@/lib/fugue/scopes";
import { invalidateCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";
import { repairWorkspaceAdminScopes, type WorkspaceAccess } from "@/lib/workspace/store";

function verifyIdentity(context: AuthContext, workspace: WorkspaceAccess) {
  if (context.platformAdmin || context.actorType !== "api-key" ||
      context.actorId !== workspace.adminKeyId || context.tenantId !== workspace.tenantId ||
      context.scopes.includes("*") || context.scopes.includes("platform.admin")) {
    throw new FugueApiError(403, "Workspace key identity could not be verified.");
  }
  if (!context.scopes.includes("app.write") || !context.scopes.includes("apikey.write")) {
    throw new FugueApiError(403, "The workspace key needs app.write and apikey.write before granting app.read.");
  }
}

export function grantableWorkspaceScopes(context: AuthContext, workspace: WorkspaceAccess) {
  const supported = sortFugueScopes(WORKSPACE_ADMIN_SCOPES);
  if (context.platformAdmin) return supported;
  const held = new Set(context.scopes);
  try {
    verifyIdentity(context, workspace);
    held.add("app.read");
  } catch {
    // An unverified or restricted primary key cannot acquire additional scopes.
  }
  return supported.filter((scope) => held.has(scope));
}

/** Prepare the current primary key only when an owner requests app.read on a child key. */
export async function prepareWorkspaceForKeyScopes(target: WorkspaceAccess, requested: readonly string[]) {
  if (!requested.includes("app.read")) return target;
  const updated = await repairWorkspaceAdminScopes(target.email, async (workspace) => {
    if (workspace.tenantId !== target.tenantId) {
      throw new FugueApiError(409, "Workspace key ownership changed. Refresh and try again.");
    }
    const before = await getAuthContext(workspace.adminKeySecret);
    verifyIdentity(before, workspace); // Also rejects disabled/revoked credentials.
    const expected = sortFugueScopes([...before.scopes, "app.read"]);
    if (!before.scopes.includes("app.read")) {
      const updated = await updateFugueApiKeyScopes(workspace.adminKeyId, expected);
      if (updated.id !== workspace.adminKeyId || updated.tenantId !== workspace.tenantId ||
          updated.status !== "active" || JSON.stringify(sortFugueScopes(updated.scopes)) !== JSON.stringify(expected)) {
        throw new FugueApiError(409, "Workspace permissions could not be confirmed. Refresh before retrying.");
      }
    }
    const after = await getAuthContext(workspace.adminKeySecret);
    verifyIdentity(after, workspace);
    if (JSON.stringify(sortFugueScopes(after.scopes)) !== JSON.stringify(expected)) {
      throw new FugueApiError(409, "Workspace permissions changed. Refresh before retrying.");
    }
    return expected;
  });
  invalidateCachedWorkspaceAccessByEmail(target.email);
  return updated;
}
