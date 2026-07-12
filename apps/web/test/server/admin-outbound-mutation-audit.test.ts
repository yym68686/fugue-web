import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { PoolClient } from "pg";

const ACTOR_EMAIL = " Active.Admin@Example.TEST ";
const BILLING_NOTE = "raw billing note must never enter audit metadata";
const BOOTSTRAP_KEY = "fugue_bootstrap_audit_test_secret";
const JOIN_COMMAND = "curl https://example.test/join | sh -s -- node-secret-value";
const NODE_LABEL = "private enrollment label";

type AuditRow = {
  action: string;
  actorEmail: string | null;
  metadata: Record<string, unknown>;
  targetEmail: string | null;
};

const auditRows: AuditRow[] = [];
const sideEffects = new Map<string, number>();
let failAudit: "all" | "completed" | null = null;

function countSideEffect(name: string) {
  sideEffects.set(name, (sideEffects.get(name) ?? 0) + 1);
}

const auditClient = {
  async query(_text: string, values?: unknown[]) {
    const action = String(values?.[0] ?? "");

    if (
      failAudit === "all" ||
      (failAudit === "completed" && action.endsWith(".completed"))
    ) {
      throw new Error("simulated audit database outage");
    }

    auditRows.push({
      action,
      actorEmail: (values?.[1] as string | null | undefined) ?? null,
      metadata: JSON.parse(String(values?.[3] ?? "{}")) as Record<string, unknown>,
      targetEmail: (values?.[2] as string | null | undefined) ?? null,
    });

    return { rows: [] };
  },
} as unknown as PoolClient;

mock.module("@/lib/db/pool", () => ({
  getDbPool: () => ({
    connect: async () => auditClient,
    query: async () => ({ rows: [] }),
  }),
  queryDb: async () => ({ rows: [] }),
  requireQueryRow: <Row>(row: Row | undefined) => {
    if (row === undefined) throw new Error("Missing test row.");
    return row;
  },
  withDbClient: async <Result>(run: (client: PoolClient) => Promise<Result>) =>
    run(auditClient),
  withDbTransaction: async <Result>(run: (client: PoolClient) => Promise<Result>) =>
    run(auditClient),
}));

mock.module("@/lib/admin/auth", () => ({
  requireAdminApiSession: async () => ({
    response: null,
    session: {
      authMethod: "password",
      email: ACTOR_EMAIL,
      provider: "email",
      verified: true,
    },
    user: { isAdmin: true },
  }),
}));

mock.module("@/lib/fugue/env", () => ({
  getFugueEnv: () => ({
    apiUrl: "https://control-plane.example.test",
    bootstrapKey: BOOTSTRAP_KEY,
  }),
}));

mock.module("@/lib/fugue/api", () => ({
  deleteFugueApp: async () => {
    countSideEffect("app.delete");
    return { deleted: true };
  },
  rebuildFugueApp: async () => {
    countSideEffect("app.rebuild");
    return { operation: { id: "operation-rebuild" } };
  },
}));

mock.module("@/lib/admin/service", () => ({
  createAdminPlatformNodeEnrollment: async () => {
    countSideEffect("cluster.node-enrollment");
    return {
      joinCommand: JOIN_COMMAND,
      nodeKey: {
        createdAt: "2026-07-12T00:00:00.000Z",
        id: "node-key-audit-test",
        label: NODE_LABEL,
        scope: "platform-node",
        status: "active",
      },
    };
  },
  invalidateAdminAppsPageData: () => undefined,
  invalidateAdminUsersPageEnrichmentData: () => undefined,
  setAdminClusterNodePolicy: async () => {
    countSideEffect("cluster.node-policy");
    return { node: null, nodeReconciled: true, reconcileError: null };
  },
  setAdminUserBillingBalanceForEmail: async () => {
    countSideEffect("user.billing");
    return { tenantId: "tenant-audit-test" };
  },
  updateAdminUserBillingForEmail: async () => {
    countSideEffect("user.billing");
    return { tenantId: "tenant-audit-test" };
  },
}));

type RouteCase = {
  completedAction: string;
  invoke: () => Promise<Response>;
  kind: string;
  requestedAction: string;
};

async function loadRouteCases(): Promise<RouteCase[]> {
  const [rebuildRoute, deleteRoute, billingRoute, policyRoute, enrollmentRoute] =
    await Promise.all([
      import("../../app/api/admin/apps/[id]/rebuild/route"),
      import("../../app/api/admin/apps/[id]/route"),
      import("../../app/api/admin/users/[email]/billing/route"),
      import("../../app/api/admin/cluster/nodes/[name]/policy/route"),
      import("../../app/api/admin/cluster/node-keys/route"),
    ]);

  return [
    {
      completedAction: "admin.app.rebuild.completed",
      invoke: () =>
        rebuildRoute.POST(
          new Request("http://localhost/api/admin/apps/app-audit/rebuild", {
            method: "POST",
          }),
          { params: Promise.resolve({ id: "app-audit" }) },
        ),
      kind: "app.rebuild",
      requestedAction: "admin.app.rebuild.requested",
    },
    {
      completedAction: "admin.app.delete.completed",
      invoke: () =>
        deleteRoute.DELETE(
          new Request("http://localhost/api/admin/apps/app-audit", {
            method: "DELETE",
          }),
          { params: Promise.resolve({ id: "app-audit" }) },
        ),
      kind: "app.delete",
      requestedAction: "admin.app.delete.requested",
    },
    {
      completedAction: "admin.user.billing.completed",
      invoke: () =>
        billingRoute.PATCH(
          new Request("http://localhost/api/admin/users/target@example.test/billing", {
            body: JSON.stringify({
              balanceCents: 12_345,
              note: BILLING_NOTE,
            }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          }),
          { params: Promise.resolve({ email: "Target@Example.TEST" }) },
        ),
      kind: "user.billing",
      requestedAction: "admin.user.billing.requested",
    },
    {
      completedAction: "admin.cluster.node-policy.completed",
      invoke: () =>
        policyRoute.PATCH(
          new Request("http://localhost/api/admin/cluster/nodes/node-audit/policy", {
            body: JSON.stringify({
              allowBuilds: true,
              allowDns: false,
              desiredControlPlaneRole: "worker",
            }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          }),
          { params: Promise.resolve({ name: "node-audit" }) },
        ),
      kind: "cluster.node-policy",
      requestedAction: "admin.cluster.node-policy.requested",
    },
    {
      completedAction: "admin.cluster.node-enrollment.completed",
      invoke: () =>
        enrollmentRoute.POST(
          new Request("http://localhost/api/admin/cluster/node-keys", {
            body: JSON.stringify({ label: NODE_LABEL }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }),
        ),
      kind: "cluster.node-enrollment",
      requestedAction: "admin.cluster.node-enrollment.requested",
    },
  ];
}

beforeEach(() => {
  auditRows.length = 0;
  sideEffects.clear();
  failAudit = null;
});

describe("outbound bootstrap admin mutation audit", () => {
  test("dynamic route inventory records requested and completed actions with redacted metadata", async () => {
    const { OUTBOUND_ADMIN_MUTATION_ACTIONS } = await import(
      "../../lib/security/audit"
    );
    const cases = await loadRouteCases();

    for (const routeCase of cases) {
      const response = await routeCase.invoke();
      expect(response.status, routeCase.kind).toBe(200);
      expect(sideEffects.get(routeCase.kind), routeCase.kind).toBe(1);
    }

    const expectedActions = cases.flatMap(({ completedAction, requestedAction }) => [
      requestedAction,
      completedAction,
    ]);
    expect(auditRows.map((row) => row.action)).toEqual(expectedActions);
    expect(new Set(expectedActions)).toEqual(
      new Set(
        Object.values(OUTBOUND_ADMIN_MUTATION_ACTIONS).flatMap(
          ({ completed, requested }) => [requested, completed],
        ),
      ),
    );
    expect(
      auditRows.every((row) => row.actorEmail === "active.admin@example.test"),
    ).toBe(true);
    expect(
      auditRows
        .filter((row) => row.action.startsWith("admin.user.billing."))
        .every((row) => row.targetEmail === "target@example.test"),
    ).toBe(true);

    const serializedAudit = JSON.stringify(auditRows);
    for (const sensitiveValue of [
      BILLING_NOTE,
      BOOTSTRAP_KEY,
      JOIN_COMMAND,
      NODE_LABEL,
      "node-secret-value",
    ]) {
      expect(serializedAudit).not.toContain(sensitiveValue);
    }
    expect(serializedAudit).toContain('"hasNote":true');
    expect(serializedAudit).toContain('"hasCustomLabel":true');
  });

  test("requested audit database failure prevents every control-plane side effect", async () => {
    const cases = await loadRouteCases();
    failAudit = "all";

    for (const routeCase of cases) {
      const response = await routeCase.invoke();
      expect(response.status, routeCase.kind).toBe(503);
      expect(await response.json()).toEqual({
        error: "The service is temporarily unavailable. Try again.",
      });
      expect(sideEffects.get(routeCase.kind) ?? 0, routeCase.kind).toBe(0);
    }

    expect(auditRows).toHaveLength(0);
  });

  test("completed audit failure does not pretend the external side effect rolled back", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    const cases = await loadRouteCases();
    failAudit = "completed";

    try {
      for (const routeCase of cases) {
        const response = await routeCase.invoke();
        expect(response.status, routeCase.kind).toBe(200);
        expect(sideEffects.get(routeCase.kind), routeCase.kind).toBe(1);
      }
    } finally {
      consoleError.mockRestore();
    }

    expect(auditRows.map((row) => row.action)).toEqual(
      cases.map((routeCase) => routeCase.requestedAction),
    );
  });
});
