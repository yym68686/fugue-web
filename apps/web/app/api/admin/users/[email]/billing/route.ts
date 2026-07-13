import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin/auth";
import {
  invalidateAdminUsersPageEnrichmentData,
  setAdminUserBillingBalanceForEmail,
  updateAdminUserBillingForEmail,
} from "@/lib/admin/service";
import {
  isObject,
  jsonError,
  type RouteContextWithParams,
  readErrorMessage,
  readErrorStatus,
  readOptionalString,
  readRouteParam,
} from "@/lib/fugue/product-route";
import { runAuditedOutboundAdminMutation } from "@/lib/security/audit";

type RouteContext = RouteContextWithParams<"email">;

function readWholeNumber(value: unknown, fieldLabel: string) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isInteger(value)
  ) {
    throw new Error(`${fieldLabel} must be a non-negative whole number.`);
  }

  return value;
}

async function readJsonObject(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return {} as Record<string, unknown>;
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON body.");
  }

  if (!isObject(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  return body;
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAdminApiSession();

  if (access.response) {
    return access.response;
  }

  let body: Record<string, unknown>;

  try {
    body = await readJsonObject(request);
  } catch (error) {
    return jsonError(400, readErrorMessage(error));
  }

  try {
    const email = await readRouteParam(context, "email");
    const managedCap = isObject(body.managedCap) ? body.managedCap : null;
    const hasBalanceCents = Object.hasOwn(body, "balanceCents");

    if (managedCap && hasBalanceCents) {
      return jsonError(400, "Provide either managedCap or balanceCents, not both.");
    }

    if (!managedCap && !hasBalanceCents) {
      return jsonError(400, "managedCap or balanceCents is required.");
    }

    let billing:
      | Awaited<ReturnType<typeof setAdminUserBillingBalanceForEmail>>
      | Awaited<ReturnType<typeof updateAdminUserBillingForEmail>>;

    if (managedCap) {
      const payload = {
        managedCap: {
          cpuMillicores: readWholeNumber(managedCap.cpuMillicores, "CPU"),
          memoryMebibytes: readWholeNumber(managedCap.memoryMebibytes, "Memory"),
          ...(managedCap.storageGibibytes !== undefined
            ? {
                storageGibibytes: readWholeNumber(
                  managedCap.storageGibibytes,
                  "Storage",
                ),
              }
            : {}),
        },
      };
      billing = await runAuditedOutboundAdminMutation(
        {
          actorEmail: access.session.email,
          billingChange: "managed-cap",
          hasNote: false,
          kind: "user.billing",
          targetEmail: email,
        },
        () => updateAdminUserBillingForEmail(email, payload),
      );
    } else {
      const payload = {
        balanceCents: readWholeNumber(body.balanceCents, "Balance"),
        note: readOptionalString(body, "note") || undefined,
      };
      billing = await runAuditedOutboundAdminMutation(
        {
          actorEmail: access.session.email,
          billingChange: "balance",
          hasNote: Boolean(payload.note),
          kind: "user.billing",
          targetEmail: email,
        },
        () => setAdminUserBillingBalanceForEmail(email, payload),
      );
    }

    invalidateAdminUsersPageEnrichmentData();
    return NextResponse.json({ billing });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
