import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { requireAdminRoute } from "@/lib/admin/route";
import { withDbClient } from "@/lib/db/pool";
import { listClusterNodes, type ClusterNode } from "@/lib/fugue/console";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
} from "@/lib/fugue/product-route";
import { writeSecurityAuditEvent } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

function readBearerToken(request: Request): string {
  const value = request.headers.get("authorization")?.trim() ?? "";
  if (!value || value.length > 4_096) return "";

  const [scheme, token] = value.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" ? token?.trim() ?? "" : "";
}

function isBootstrapToken(candidate: string): boolean {
  const expected = process.env.FUGUE_BOOTSTRAP_KEY?.trim() ?? "";
  if (!candidate || !expected) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

async function requireSnapshotAccess(
  request: Request,
): Promise<NextResponse | null> {
  const sessionAccess = await requireAdminRoute();
  if (!sessionAccess.response) return null;

  if (!isBootstrapToken(readBearerToken(request))) {
    return sessionAccess.response;
  }

  try {
    await withDbClient((client) =>
      writeSecurityAuditEvent(client, {
        action: "admin.control-plane-key.used",
        metadata: {
          credentialKind: "bootstrap",
          scope: "admin.snapshot.cluster.read",
        },
      }),
    );
  } catch {
    return jsonError(503, "Admin access audit is unavailable.");
  }

  return null;
}

function isReady(node: ClusterNode): boolean {
  const status = node.status.trim().toLowerCase();
  return status === "ready" || status === "active";
}

function buildSnapshot(nodes: ClusterNode[]) {
  return {
    errors: [] as string[],
    generatedAt: new Date().toISOString(),
    nodes,
    summary: {
      nodeCount: nodes.length,
      readyCount: nodes.filter(isReady).length,
      regionCount: new Set(nodes.map((node) => node.region).filter(Boolean))
        .size,
      workloadCount: nodes.reduce(
        (total, node) => total + (node.workloads?.length ?? 0),
        0,
      ),
    },
  };
}

export async function GET(request: Request) {
  const accessError = await requireSnapshotAccess(request);
  if (accessError) return accessError;

  try {
    const nodes = await listClusterNodes();
    return NextResponse.json(buildSnapshot(nodes), {
      headers: {
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
