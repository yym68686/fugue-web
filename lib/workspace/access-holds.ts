import "server-only";
import { withDbTransaction } from "@/lib/db/pool";
import { ensureDbSchema } from "@/lib/db/schema";
import { setWorkspaceControlPlaneHold } from "@/lib/fugue/console";

// Keep the desired state locked through delivery, including across Web replicas.
export async function deliverWorkspaceHold(email?: string) {
  await ensureDbSchema();
  return withDbTransaction(async (client) => {
    const normalizedEmail = email?.trim().toLowerCase() ?? null;
    const result = await client.query<{ tenant_id: string; held: boolean }>(
      `SELECT h.tenant_id, h.held FROM app_workspace_access_holds h
       JOIN app_workspaces w ON w.tenant_id = h.tenant_id
       WHERE NOT h.applied AND ($1::text IS NULL OR w.user_email = $1)
         AND ($1::text IS NOT NULL OR h.retry_at <= NOW())
       ORDER BY h.retry_at, h.tenant_id LIMIT 1 FOR UPDATE OF h ${email ? "" : "SKIP LOCKED"}`,
      [normalizedEmail],
    );
    const hold = result.rows[0];
    if (!hold) return true;
    try {
      await setWorkspaceControlPlaneHold(hold.tenant_id, hold.held);
    } catch {
      await client.query(
        "UPDATE app_workspace_access_holds SET retry_at = NOW() + INTERVAL '30 seconds' WHERE tenant_id = $1",
        [hold.tenant_id],
      );
      return false;
    }
    await client.query(
      "UPDATE app_workspace_access_holds SET applied = TRUE WHERE tenant_id = $1",
      [hold.tenant_id],
    );
    return true;
  });
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startWorkspaceHoldWorker() {
  if (timer) return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await deliverWorkspaceHold();
    } catch {
      console.error("Workspace access hold reconciliation unavailable");
    } finally {
      busy = false;
    }
  };
  timer = setInterval(tick, 5000);
  timer.unref();
  void tick();
}
