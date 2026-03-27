import { NextResponse } from "next/server";

import { buildOriginUrl, isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: Request) {
  const requestOrigin = readRequestOrigin(request);
  const secure = isSecureRequest(request);
  const response = NextResponse.redirect(buildOriginUrl(requestOrigin, "/auth/sign-in?state=signed-out"), {
    status: 303,
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 0,
  });

  return response;
}
