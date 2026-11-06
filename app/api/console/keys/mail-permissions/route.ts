import { NextResponse } from "next/server";
import { readMailMutation } from "@/lib/fugue/mail-route";
import { jsonError, readErrorMessage, readErrorStatus, requireActiveSessionUser } from "@/lib/fugue/product-route";
import { enableWorkspaceMailRead } from "@/lib/workspace/mail-permissions";

export async function POST(request: Request) {
  const auth = await requireActiveSessionUser();
  if (auth.response) return auth.response;
  try {
    const body = await readMailMutation(request);
    if (Object.keys(body).length) return jsonError(400, "This action does not accept key IDs or scopes.");
    const result = await enableWorkspaceMailRead(auth.session.email);
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(readErrorStatus(error), readErrorMessage(error));
  }
}
