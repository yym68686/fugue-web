import "server-only";

import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";
import {
  getCachedActiveAppUserByEmail,
  getCachedWorkspaceAccessByEmail,
} from "@/lib/server/session-state-cache";
import type { WorkspaceAccess } from "@/lib/workspace/store";

export type RouteContextWithParams<T extends string> = {
  params:
    | Promise<Record<string, string>>
    | Record<string, string>;
};

export function jsonError(status: number, message: string) {
  return NextResponse.json(
    {
      error: message,
    },
    { status },
  );
}

export function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error.";
}

export function readErrorStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  const match = error.message.match(/\b(400|401|402|403|404|409|422|500|502|503)\b/);
  return match ? Number(match[1]) : 500;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readOptionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function readStringMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === "string" ? [[key, entry]] : [],
    ),
  );
}

export async function readRouteParam<T extends string>(
  context: RouteContextWithParams<T>,
  key: T,
) {
  const params = (await Promise.resolve(context.params)) as Record<string, string>;
  return params[key];
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    return {
      response: jsonError(401, "Sign in first."),
      session: null,
      user: null,
    } as const;
  }

  return {
    response: null,
    session,
    user: null,
  } as const;
}

export async function requireSessionUser() {
  const { response, session } = await requireSession();

  if (response || !session) {
    return {
      response,
      session: null,
      user: null,
    } as const;
  }

  const user = await getCachedActiveAppUserByEmail(session.email);

  return {
    response: null,
    session,
    user,
  } as const;
}

export async function requireWorkspaceForSession(session: SessionUser) {
  const workspace = await getCachedWorkspaceAccessByEmail(session.email);

  if (!workspace) {
    return {
      response: jsonError(409, "Create a workspace first."),
      workspace: null,
    } as const;
  }

  return {
    response: null,
    workspace,
  } as const;
}

export async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
