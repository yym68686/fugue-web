import { NextResponse } from "next/server";

import { createGoogleAuthorizationUrl } from "@/lib/auth/google";
import { signToken } from "@/lib/auth/token";
import { parseAuthMode, sanitizeReturnTo } from "@/lib/auth/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = parseAuthMode(url.searchParams.get("mode"));
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));

  const state = signToken(
    {
      type: "oauth-state",
      mode,
      returnTo,
    },
    60 * 10,
  );

  return NextResponse.redirect(createGoogleAuthorizationUrl(state), { status: 303 });
}
