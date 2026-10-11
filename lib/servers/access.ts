import "server-only";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";
import {
  getWorkspaceSnapshotByEmail,
  getWorkspaceSnapshotsByTenantIds,
} from "@/lib/workspace/store";
import {
  runtimeCapabilities,
  runtimeView,
  isInternalRuntime,
  validatePublicOffer,
} from "@/lib/servers/model";
import * as api from "@/lib/fugue/runtime-management";
import { runAuditedOutboundAdminMutation } from "@/lib/security/audit";

export type ServerActor = {
  email: string;
  tenantId: string;
  key: string;
  scopes: string[];
  isAdmin: boolean;
};
export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), { status });
}
export function requireScope(actor: ServerActor, scope: string) {
  if (!actor.scopes.includes(scope))
    fail(403, "Your access key does not allow this action.");
}
export async function ownedRuntime(actor: ServerActor, id: string) {
  const runtime = await api.readRuntime(actor.key, id);
  if (!actor.tenantId || runtime.tenant_id !== actor.tenantId)
    fail(403, "Only the server owner can perform this action.");
  return runtime;
}

export async function runtimeAccess(actor: ServerActor, id: string) {
  await ownedRuntime(actor, id);
  const sharing = await api.readSharing(actor.key, id);
  if (
    sharing.runtime?.id !== id ||
    sharing.runtime.tenant_id !== actor.tenantId ||
    !Array.isArray(sharing.grants)
  )
    fail(502, "Server access response could not be verified.");
  const owners = await getWorkspaceSnapshotsByTenantIds(
    sharing.grants.map((g) => g.tenant_id),
  );
  const labels = new Map(owners.map((w) => [w.tenantId, w.email]));
  return {
    runtime: runtimeView(sharing.runtime, actor.tenantId),
    grants: sharing.grants.map((g) => ({
      tenantId: g.tenant_id,
      label: labels.get(g.tenant_id) ?? g.tenant_id,
      createdAt: g.created_at,
    })),
  };
}

/** Every mutation rechecks server-side ownership; browser capabilities are only presentation. */
export async function changeRuntime(
  actor: ServerActor,
  id: string,
  body: Record<string, unknown>,
) {
  const runtime = await ownedRuntime(actor, id);
  const capabilities = runtimeCapabilities(runtime, actor);
  if (body.action === "scope") {
    if (!capabilities.scope)
      fail(
        403,
        "Only platform admins can change an owned server's cluster membership.",
      );
    if (body.scope !== "internal" && body.scope !== "byovps")
      fail(400, "Choose a valid server membership.");
    if (body.confirmName !== runtime.name)
      fail(400, "Type the server name to confirm.");
    const scope = body.scope;
    const key = process.env.FUGUE_BOOTSTRAP_KEY?.trim();
    if (!key) fail(503, "Platform administration is unavailable.");
    const result = await runAuditedOutboundAdminMutation(
      { actorEmail: actor.email, kind: "runtime.scope", runtimeId: id, scope },
      () => api.setRuntimeScope(key, id, scope),
    );
    return {
      runtime: runtimeView(result.runtime, actor.tenantId),
      nodeReconciled: result.node_reconciled,
    };
  }
  requireScope(actor, "runtime.write");
  if (body.action === "delete") {
    if (!capabilities.delete)
      fail(409, "Only an offline server can be deleted.");
    if (body.confirmName !== runtime.name)
      fail(400, "Type the server name to confirm.");
    const result = await api.removeRuntime(actor.key, id);
    if (result.deleted !== true)
      fail(502, "Server deletion could not be verified.");
    return { deleted: true };
  }
  if (isInternalRuntime(runtime))
    fail(409, "Sharing settings apply only to BYOVPS servers.");
  switch (body.action) {
    case "sharing": {
      if (body.sharing !== "private" && body.sharing !== "public")
        fail(400, "Choose private or public access.");
      const result = await api.setSharing(actor.key, id, body.sharing);
      return { runtime: runtimeView(result.runtime, actor.tenantId) };
    }
    case "grant": {
      if (typeof body.email !== "string" || !isValidEmail(body.email))
        fail(400, "Enter a valid email address.");
      const email = normalizeEmail(body.email);
      const workspace = await getWorkspaceSnapshotByEmail(email);
      if (!workspace)
        fail(404, "No completed workspace was found for this email.");
      if (workspace.tenantId === actor.tenantId)
        fail(400, "This server already belongs to your workspace.");
      await api.grantRuntime(actor.key, id, workspace.tenantId);
      return { granted: true };
    }
    case "revoke": {
      if (typeof body.tenantId !== "string" || !body.tenantId.trim())
        fail(400, "Choose a workspace.");
      await api.revokeRuntimeGrant(actor.key, id, body.tenantId.trim());
      return { revoked: true };
    }
    case "offer": {
      if (runtime.sharing !== "public" && runtime.access_mode !== "public")
        fail(409, "Make this server public before setting public pricing.");
      const result = await api.setPublicOffer(
        actor.key,
        id,
        validatePublicOffer(body.offer),
      );
      return { runtime: runtimeView(result.runtime, actor.tenantId) };
    }
    default:
      return fail(400, "Unknown server action.");
  }
}
