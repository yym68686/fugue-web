import { NextResponse } from "next/server";

import { disableApiKeyForEmail } from "@/lib/api-keys/service";
import { getCurrentSession } from "@/lib/auth/session";
import { ensureAppUser } from "@/lib/workspace/store";

type RouteContext = {
  params:
    | Promise<{
        id: string;
      }>
    | {
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

  if (
    error.message.includes("cannot be disabled") ||
    error.message.includes("cannot be deleted")
  ) {
    return 400;
  }

  if (error.message.includes("not found")) {
    return 404;
  }

  if (error.message.includes("workspace") || error.message.includes("Create a workspace")) {
    return 409;
  }

  const match = error.message.match(/\b(400|401|403|404|409|422|500|502|503)\b/);
  return match ? Number(match[1]) : 500;
}

async function readKeyId(context: RouteContext) {
  const params = await Promise.resolve(context.params);
  return params.id;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    await ensureAppUser(session);

    const disabled = await disableApiKeyForEmail(
      session.email,
      await readKeyId(context),
    );

    return NextResponse.json(disabled);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
