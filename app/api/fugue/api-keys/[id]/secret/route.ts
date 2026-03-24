import { NextResponse } from "next/server";

import {
  getApiKeyRecordById,
  getApiKeySecret,
} from "@/lib/api-keys/store";
import { getCurrentSession } from "@/lib/auth/session";
import { ensureAppUser } from "@/lib/workspace/store";

type RouteContext = {
  params: Promise<{
    id: string;
  }> | {
    id: string;
  };
};

function jsonError(status: number, message: string) {
  return NextResponse.json(
    {
      error: message,
    },
    { status },
  );
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error.";
}

function readErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  const match = error.message.match(/\b(400|401|403|404|409|422|500|502|503)\b/);
  return match ? Number(match[1]) : 500;
}

async function readKeyId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    await ensureAppUser(session);

    const keyId = await readKeyId(context);
    const record = await getApiKeyRecordById(session.email, keyId, {
      includeDeleted: true,
    });

    if (!record || record.status === "deleted") {
      return jsonError(404, "API key not found.");
    }

    const secret = await getApiKeySecret(session.email, keyId);

    if (!secret) {
      return jsonError(
        404,
        "Secret is unavailable. Only keys created or stored in fugue-web can be copied.",
      );
    }

    return NextResponse.json({
      secret,
    });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
