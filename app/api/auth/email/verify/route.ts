import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { buildSessionCookie } from "@/lib/auth/session";
import { verifyToken } from "@/lib/auth/token";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

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

  const sessionUser = {
    email: payload.email,
    name: payload.name,
    provider: "email" as const,
    verified: true,
  };

  try {
    await ensureAppUserRecord(sessionUser, {
      markSignedIn: true,
    });
    await ensureWorkspaceAccess(sessionUser);
  } catch (error) {
    if (error instanceof Error && error.message.includes("blocked")) {
      return NextResponse.redirect(new URL("/auth/sign-in?error=account-blocked", request.url), {
        status: 303,
      });
    }

    if (error instanceof Error && error.message.includes("deleted")) {
      return NextResponse.redirect(new URL("/auth/sign-in?error=account-deleted", request.url), {
        status: 303,
      });
    }

    return NextResponse.redirect(new URL("/auth/sign-in?error=invalid-token", request.url), {
      status: 303,
    });
  }

  const destination = new URL("/app", request.url);
  const response = NextResponse.redirect(destination, { status: 303 });
  response.cookies.set(buildSessionCookie(sessionUser));

  return response;
}
