import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { sendVerificationEmail } from "@/lib/auth/email";
import { getAuthEnv } from "@/lib/auth/env";
import { buildSessionCookie } from "@/lib/auth/session";
import { signToken } from "@/lib/auth/token";
import {
  isValidEmail,
  normalizeEmail,
  parseAuthMode,
  sanitizeDisplayName,
} from "@/lib/auth/validation";
import { ensureWorkspaceAccess } from "@/lib/workspace/bootstrap";

type RequestPayload = {
  email?: string;
  mode?: string;
  name?: string;
};

export async function POST(request: Request) {
  const authEnv = getAuthEnv();
  let payload: RequestPayload;

  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const email = normalizeEmail(payload.email ?? "");
  const mode = parseAuthMode(payload.mode);
  const name = sanitizeDisplayName(payload.name ?? "");

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (name.length > 80) {
    return NextResponse.json({ error: "Display name is too long." }, { status: 400 });
  }

  if (!authEnv.emailVerificationRequired) {
    const sessionUser = {
      email,
      name: name || undefined,
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
        return NextResponse.json({ error: "This account is blocked." }, { status: 403 });
      }

      if (error instanceof Error && error.message.includes("deleted")) {
        return NextResponse.json({ error: "This account has been deleted." }, { status: 403 });
      }

      return NextResponse.json({ error: "Could not open the session." }, { status: 500 });
    }

    const response = NextResponse.json({
      ok: true,
      message: "Email accepted. Opening the session now.",
      redirectTo: "/app",
    });

    response.cookies.set(
      buildSessionCookie(sessionUser),
    );

    return response;
  }

  const token = signToken(
    {
      type: "email-verify",
      email,
      mode,
      name: name || undefined,
    },
    60 * 15,
  );

  const verifyUrl = new URL("/api/auth/email/verify", authEnv.appBaseUrl);
  verifyUrl.searchParams.set("token", token);

  try {
    await sendVerificationEmail({
      email,
      mode,
      name: name || undefined,
      verifyUrl: verifyUrl.toString(),
    });

    return NextResponse.json({
      ok: true,
      message: `Verification link sent to ${email}.`,
    });
  } catch {
    return NextResponse.json(
      { error: "Verification email could not be sent. Check the Resend configuration." },
      { status: 500 },
    );
  }
}
