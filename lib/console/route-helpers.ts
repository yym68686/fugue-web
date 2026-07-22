import "server-only";

import { NextResponse } from "next/server";
import {
  jsonError,
  readErrorMessage,
  readErrorStatus,
  requireActiveSessionUser,
  requireWorkspaceForSession,
} from "@/lib/fugue/product-route";

/**
 * Run a console mutation with the caller's tenant-scoped admin key.
 *
 * Handles the full guard chain used by every /api/console route:
 *  1. require an active session,
 *  2. require the session's workspace (→ the tenant admin key),
 *  3. invoke the action, translating thrown FugueApiErrors into sanitized
 *     JSON error responses with the upstream status.
 *
 * The workspace admin key never leaves the server: it is passed to `action`
 * here and used only to call the fugue backend.
 */
export async function withWorkspaceKey<T>(
  action: (adminKey: string) => Promise<T>,
): Promise<NextResponse> {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;

  const ws = await requireWorkspaceForSession(auth.session);
  if (ws.response) return ws.response;

  try {
    const result = await action(ws.workspace.adminKeySecret);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
