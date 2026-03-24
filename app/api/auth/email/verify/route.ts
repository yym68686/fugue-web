import { NextResponse } from "next/server";

import { buildSessionCookie } from "@/lib/auth/session";
import { verifyToken } from "@/lib/auth/token";

type EmailVerifyPayload = {
  email: string;
  exp: number;
  iat: number;
  mode: "signin" | "signup";
  name?: string;
  type: "email-verify";
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=invalid-token", request.url), {
      status: 303,
    });
  }

  const payload = verifyToken<EmailVerifyPayload>(token);

  if (!payload || payload.type !== "email-verify") {
    return NextResponse.redirect(new URL("/auth/sign-in?error=invalid-token", request.url), {
      status: 303,
    });
  }

  const destination = new URL("/app", request.url);
  const response = NextResponse.redirect(destination, { status: 303 });
  response.cookies.set(
    buildSessionCookie({
      email: payload.email,
      name: payload.name,
      provider: "email",
      verified: true,
    }),
  );

  return response;
}
