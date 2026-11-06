import "server-only";

import { FugueApiError, getAuthContext, type AuthContext } from "@/lib/fugue/console";
import { updateFugueApiKeyScopes } from "@/lib/fugue/platform-admin";
import { sortFugueScopes } from "@/lib/fugue/scopes";
import { invalidateCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";
import { repairWorkspaceAdminScopes, type WorkspaceAccess } from "@/lib/workspace/store";

function verifyIdentity(context: AuthContext, workspace: WorkspaceAccess) {
  if (context.platformAdmin || context.actorType !== "api-key" ||
      context.actorId !== workspace.adminKeyId || context.tenantId !== workspace.tenantId ||
      context.scopes.includes("*") || context.scopes.includes("platform.admin")) {
    throw new FugueApiError(403, "Workspace key identity could not be verified.");
  }
  if (!context.scopes.includes("app.write") || !context.scopes.includes("apikey.write")) {
    throw new FugueApiError(403, "The workspace key needs app.write and apikey.write before enabling mail access.");
  }
}

/** Only adds app.read after an explicit owner action; child keys remain unchanged. */
export async function enableWorkspaceMailRead(email: string) {
  const scopes = await repairWorkspaceAdminScopes(email, async (workspace) => {
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
  invalidateCachedWorkspaceAccessByEmail(email);
  return { scopes };
}
