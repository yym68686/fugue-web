import "server-only";

import type { PoolClient } from "pg";

import { normalizeEmail } from "@/lib/auth/validation";
import { withDbClient } from "@/lib/db/pool";

export type SecurityAuditAction =
  | "admin.app.delete.completed"
  | "admin.app.delete.requested"
  | "admin.app.rebuild.completed"
  | "admin.app.rebuild.requested"
  | "admin.bootstrap.completed"
  | "admin.bootstrap.existing-state-migrated"
  | "admin.cluster.node-enrollment.completed"
  | "admin.cluster.node-enrollment.requested"
  | "admin.cluster.node-policy.completed"
  | "admin.cluster.node-policy.requested"
  | "admin.control-plane-key.used"
  | "admin.recovered"
  | "admin.user.billing.completed"
  | "admin.user.billing.requested"
  | "user.admin-role.changed"
  | "user.password.registered"
  | "user.session.revoked"
  | "user.status.changed";

export type OutboundAdminMutationRequest =
  | {
      actorEmail: string;
      appId: string;
      kind: "app.delete" | "app.rebuild";
    }
  | {
      actorEmail: string;
      billingChange: "balance" | "managed-cap";
      hasNote: boolean;
      kind: "user.billing";
      targetEmail: string;
    }
  | {
      actorEmail: string;
      changesAllowBuilds: boolean;
      changesAllowDns: boolean;
      changesAllowEdge: boolean;
      changesAllowSharedPool: boolean;
      changesControlPlaneRole: boolean;
      kind: "cluster.node-policy";
      nodeName: string;
    }
  | {
      actorEmail: string;
      hasCustomLabel: boolean;
      kind: "cluster.node-enrollment";
    };

type OutboundAdminMutationStage = "completed" | "requested";

class AdminMutationAuditUnavailableError extends Error {
  readonly status = 503;

  constructor(cause: unknown) {
    super("Admin mutation audit is unavailable.", { cause });
    this.name = "AdminMutationAuditUnavailableError";
  }
}

export const OUTBOUND_ADMIN_MUTATION_ACTIONS = {
  "app.delete": {
    completed: "admin.app.delete.completed",
    requested: "admin.app.delete.requested",
  },
  "app.rebuild": {
    completed: "admin.app.rebuild.completed",
    requested: "admin.app.rebuild.requested",
  },
  "cluster.node-enrollment": {
    completed: "admin.cluster.node-enrollment.completed",
    requested: "admin.cluster.node-enrollment.requested",
  },
  "cluster.node-policy": {
    completed: "admin.cluster.node-policy.completed",
    requested: "admin.cluster.node-policy.requested",
  },
  "user.billing": {
    completed: "admin.user.billing.completed",
    requested: "admin.user.billing.requested",
  },
} as const satisfies Record<
  OutboundAdminMutationRequest["kind"],
  Record<OutboundAdminMutationStage, SecurityAuditAction>
>;

function normalizeOptionalEmail(value?: string | null) {
  const normalized = value ? normalizeEmail(value) : "";
  return normalized || null;
}

export async function writeSecurityAuditEvent(
  client: PoolClient,
  input: {
    action: SecurityAuditAction;
    actorEmail?: string | null;
    metadata?: Record<string, boolean | number | string | null>;
    targetEmail?: string | null;
  },
) {
  await client.query(
    `
      INSERT INTO app_security_audit_events (
        action,
        actor_email,
        target_email,
        metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4::jsonb, NOW())
    `,
    [
      input.action,
      normalizeOptionalEmail(input.actorEmail),
      normalizeOptionalEmail(input.targetEmail),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

function buildOutboundAdminMutationAuditEvent(
  input: OutboundAdminMutationRequest,
  stage: OutboundAdminMutationStage,
): Parameters<typeof writeSecurityAuditEvent>[1] {
  const action = OUTBOUND_ADMIN_MUTATION_ACTIONS[input.kind][stage];

  switch (input.kind) {
    case "app.delete":
    case "app.rebuild":
      return {
        action,
        actorEmail: input.actorEmail,
        metadata: {
          appId: input.appId,
          stage,
        },
      };
    case "user.billing":
      return {
        action,
        actorEmail: input.actorEmail,
        metadata: {
          billingChange: input.billingChange,
          hasNote: input.hasNote,
          stage,
        },
        targetEmail: input.targetEmail,
      };
    case "cluster.node-policy":
      return {
        action,
        actorEmail: input.actorEmail,
        metadata: {
          changesAllowBuilds: input.changesAllowBuilds,
          changesAllowDns: input.changesAllowDns,
          changesAllowEdge: input.changesAllowEdge,
          changesAllowSharedPool: input.changesAllowSharedPool,
          changesControlPlaneRole: input.changesControlPlaneRole,
          nodeName: input.nodeName,
          stage,
        },
      };
    case "cluster.node-enrollment":
      return {
        action,
        actorEmail: input.actorEmail,
        metadata: {
          hasCustomLabel: input.hasCustomLabel,
          stage,
        },
      };
  }
}

async function writeOutboundAdminMutationAuditEvent(
  input: OutboundAdminMutationRequest,
  stage: OutboundAdminMutationStage,
) {
  const event = buildOutboundAdminMutationAuditEvent(input, stage);
  await withDbClient((client) => writeSecurityAuditEvent(client, event));
}

/**
 * Persists the local intent before invoking a bootstrap-authorized control-plane
 * mutation. The completed record is deliberately best-effort: once the remote
 * side effect succeeds, a local database failure cannot make that effect atomic
 * or safe to retry.
 */
export async function runAuditedOutboundAdminMutation<Result>(
  input: OutboundAdminMutationRequest,
  mutate: () => Promise<Result>,
) {
  try {
    await writeOutboundAdminMutationAuditEvent(input, "requested");
  } catch (cause) {
    throw new AdminMutationAuditUnavailableError(cause);
  }

  const result = await mutate();

  try {
    await writeOutboundAdminMutationAuditEvent(input, "completed");
  } catch {
    console.error("Completed admin mutation audit is unavailable.", {
      action: OUTBOUND_ADMIN_MUTATION_ACTIONS[input.kind].completed,
    });
  }

  return result;
}
