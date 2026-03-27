import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { buildSessionHandoffUrl } from "@/lib/auth/finalize";
import { buildOriginUrl, normalizeAuthOrigin, readRequestOrigin } from "@/lib/auth/origin";
import { verifyToken } from "@/lib/auth/token";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type EmailVerifyPayload = {
  email: string;
  exp: number;
  iat: number;
  mode: "signin" | "signup";
  name?: string;
  origin?: string;
  type: "email-verify";
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestOrigin = readRequestOrigin(request);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(buildOriginUrl(requestOrigin, "/auth/sign-in?error=invalid-token"), {
      status: 303,
    });
  }

  const payload = verifyToken<EmailVerifyPayload>(token);
  const payloadOrigin = normalizeAuthOrigin(payload?.origin) ?? requestOrigin;

  if (!payload || payload.type !== "email-verify") {
    return NextResponse.redirect(buildOriginUrl(requestOrigin, "/auth/sign-in?error=invalid-token"), {
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
      return NextResponse.redirect(buildOriginUrl(payloadOrigin, "/auth/sign-in?error=account-blocked"), {
        status: 303,
      });
    }

    if (error instanceof Error && error.message.includes("deleted")) {
      return NextResponse.redirect(buildOriginUrl(payloadOrigin, "/auth/sign-in?error=account-deleted"), {
        status: 303,
      });
    }

    return NextResponse.redirect(buildOriginUrl(payloadOrigin, "/auth/sign-in?error=invalid-token"), {
      status: 303,
    });
  }

  return NextResponse.redirect(buildSessionHandoffUrl(payloadOrigin, sessionUser, "/app"), {
    status: 303,
  });
}
