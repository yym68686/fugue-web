import { NextResponse } from "next/server";

import {
  getApiKeyPageData,
} from "@/lib/api-keys/service";
import { getCurrentSession } from "@/lib/auth/session";
import { ensureAppUser } from "@/lib/workspace/store";

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
    error.message.includes("workspace") ||
    error.message.includes("Create a workspace")
  ) {
    return 409;
  }

  if (
    error.message.includes("required") ||
    error.message.includes("Choose at least one scope") ||
    error.message.includes("Nothing to update") ||
    error.message.includes("Unsupported scopes") ||
    error.message.includes("reserved") ||
    error.message.includes("name is fixed")
  ) {
    return 400;
  }

  const match = error.message.match(/\b(400|401|403|404|409|422|500|502|503)\b/);
  return match ? Number(match[1]) : 500;
}

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    await ensureAppUser(session);
    const data = await getApiKeyPageData(session.email);

    if (!data) {
      return jsonError(409, "Create a workspace first.");
    }

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}

export async function POST() {
  const session = await getCurrentSession();

  if (!session) {
    return jsonError(401, "Sign in first.");
  }

  try {
    await ensureAppUser(session);
    return jsonError(
      403,
      "Admin access key is provisioned automatically. Create node keys instead.",
    );
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
