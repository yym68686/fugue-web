import "server-only";
import { sanitizePublicErrorMessage } from "@/lib/security/public-error.mjs";
import { fugueGet, getConsoleApp } from "@/lib/fugue/console";
import type { components } from "@/lib/fugue/openapi.generated";
import * as api from "@/lib/fugue/runtime-management";
import { fail, requireScope, type ServerActor } from "@/lib/servers/access";

function operationView(op: components["schemas"]["Operation"]) {
  // Desired specs may contain app secrets: only project status fields.
  return {
    id: op.id,
    status: op.status,
    type: op.type,
    created_at: op.created_at,
    updated_at: op.updated_at,
    error: op.error_message
      ? sanitizePublicErrorMessage(op.error_message, 400)
      : null,
  };
}

export async function migrationSettings(
  actor: ServerActor,
  id: string,
  operationId?: string,
) {
  await getConsoleApp(actor.key, id);
  if (operationId) {
    const result = await fugueGet<{
      operation: components["schemas"]["Operation"];
    }>(actor.key, `/v1/operations/${encodeURIComponent(operationId)}`);
    if (result.operation?.app_id !== id) fail(404, "Operation not found.");
    return { operation: operationView(result.operation) };
  }
  return {
    targets: await api.deploymentTargets(actor.key, actor.tenantId),
    canMigrate: actor.scopes.includes("app.migrate"),
  };
}

export async function requestMigration(
  actor: ServerActor,
  id: string,
  body: Record<string, unknown>,
) {
  requireScope(actor, "app.migrate");
  if (
    typeof body.targetRuntimeId !== "string" ||
    !body.targetRuntimeId.trim() ||
    typeof body.dryRun !== "boolean"
  )
    fail(400, "Choose a destination and preview the migration first.");
  const target = body.targetRuntimeId.trim();
  // The backend performs current ownership, placement, volume, database and image checks.
  const preview = await api.migrateApp(actor.key, id, target, true);
  if (
    !preview.impact ||
    preview.impact.app_id !== id ||
    preview.impact.target_runtime_id !== target
  )
    fail(502, "Migration preview could not be verified.");
  if (body.dryRun) return { impact: preview.impact };
  if (!preview.impact.pass)
    fail(409, "Migration is blocked. Refresh the preview for details.");
  const result = await api.migrateApp(actor.key, id, target, false);
  if (!result.operation?.id)
    fail(502, "Migration operation could not be verified.");
  return { operation: operationView(result.operation) };
}

export async function projectRuntimeSettings(actor: ServerActor, id: string) {
  const project = await api.readProject(actor.key, id);
  const [targets, reservations] = await Promise.all([
    api.deploymentTargets(actor.key, actor.tenantId),
    api.readReservations(actor.key, id),
  ]);
  if (!Array.isArray(reservations.runtime_reservations))
    fail(502, "Reservation inventory could not be verified.");
  return {
    defaultRuntimeId: project.default_runtime_id ?? "",
    targets,
    reservations: reservations.runtime_reservations,
    canChangeDefault: actor.scopes.includes("project.write"),
    canReserve: actor.scopes.includes("runtime.reserve"),
  };
}

export async function changeProjectRuntime(
  actor: ServerActor,
  id: string,
  body: Record<string, unknown>,
) {
  await api.readProject(actor.key, id);
  if (typeof body.runtimeId !== "string") fail(400, "Choose a server.");
  const runtimeId = body.runtimeId.trim();
  switch (body.action) {
    case "default":
      requireScope(actor, "project.write");
      await api.setDefaultRuntime(actor.key, id, runtimeId);
      break;
    case "reserve":
      requireScope(actor, "runtime.reserve");
      if (!runtimeId) fail(400, "Choose a server.");
      await api.reserveRuntime(actor.key, id, runtimeId);
      break;
    case "release":
      requireScope(actor, "runtime.reserve");
      if (!runtimeId) fail(400, "Choose a server.");
      await api.releaseRuntime(actor.key, id, runtimeId);
      break;
    default:
      return fail(400, "Unknown server action.");
  }
  return { saved: true };
}
