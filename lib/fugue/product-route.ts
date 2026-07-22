import "server-only";

import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth/session";
import {
  getCurrentActiveSessionUser,
  SessionAuthorizationError,
} from "@/lib/auth/session";
import {
  readPublicErrorStatus,
  sanitizePublicErrorMessage,
} from "@/lib/security/public-error.mjs";
import { getCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";

export type RouteContextWithParams<T extends string> = {
  params: Promise<Record<T, string>> | Record<T, string>;
};

export function jsonError(status: number, message: string) {
  return NextResponse.json(
    {
      error: sanitizePublicErrorMessage(message, status),
    },
    { status },
  );
}

export function readErrorMessage(error: unknown) {
  return sanitizePublicErrorMessage(error, readErrorStatus(error));
}

export function readErrorStatus(error: unknown) {
  return readPublicErrorStatus(error);
}

export function readErrorRetryAfterSeconds(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const retryAfterSeconds = Reflect.get(error, "retryAfterSeconds");

  return typeof retryAfterSeconds === "number" &&
    Number.isSafeInteger(retryAfterSeconds) &&
    retryAfterSeconds > 0
    ? retryAfterSeconds
    : null;
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
): Promise<string> {
  const params = await Promise.resolve(context.params);
  const value = params[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`400 Missing route parameter: ${key}.`);
  }

  return value;
}

export async function requireSession() {
  return requireActiveSessionUser();
}

export async function requireActiveSessionUser() {
  let current: Awaited<ReturnType<typeof getCurrentActiveSessionUser>>;

  try {
    current = await getCurrentActiveSessionUser();
  } catch (error) {
    if (error instanceof SessionAuthorizationError) {
      return {
        response: jsonError(error.status, error.message.replace(/^\d{3}\s+/, "")),
        session: null,
        user: null,
      } as const;
    }

    throw error;
  }

  if (!current) {
    return {
      response: jsonError(401, "Sign in first."),
      session: null,
      user: null,
    } as const;
  }

  return {
    response: null,
    session: current.session,
    user: current.user,
  } as const;
}

export async function requireSessionUser() {
  return requireActiveSessionUser();
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
