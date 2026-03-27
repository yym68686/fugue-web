import { NextResponse } from "next/server";

import { buildSessionHandoffUrl, verifySessionHandoffToken } from "@/lib/auth/finalize";
import { buildOriginUrl, isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
import { buildSessionCookie } from "@/lib/auth/session";

function redirectWithError(origin: string) {
  return NextResponse.redirect(buildOriginUrl(origin, "/auth/sign-in?error=oauth_failed"), { status: 303 });
}

export async function POST(request: Request) {
  const requestOrigin = readRequestOrigin(request);
  const secure = isSecureRequest(request);
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return redirectWithError(requestOrigin);
  }

  const rawToken = formData.get("token");
  const token = typeof rawToken === "string" ? rawToken.trim() : "";

  if (!token) {
    return redirectWithError(requestOrigin);
  }

  const handoff = verifySessionHandoffToken(token);

  if (!handoff || !handoff.origin) {
    return redirectWithError(requestOrigin);
  }

  if (handoff.origin !== requestOrigin) {
    return NextResponse.redirect(
      buildSessionHandoffUrl(handoff.origin, handoff.user, handoff.returnTo),
      { status: 303 },
    );
  }

  const response = NextResponse.redirect(buildOriginUrl(requestOrigin, handoff.returnTo), { status: 303 });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({
    ...buildSessionCookie(handoff.user),
    secure,
  });

  return response;
}
