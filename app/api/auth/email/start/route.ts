import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { getAuthEnv } from "@/lib/auth/env";
import { sendVerificationEmail } from "@/lib/auth/email";
import { syncAuthMethodOnSignIn } from "@/lib/auth/methods";
import { buildOriginUrl, isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
import { buildSessionCookie } from "@/lib/auth/session";
import { signToken } from "@/lib/auth/token";
import {
  isValidEmail,
  normalizeEmail,
  parseAuthMode,
  sanitizeReturnTo,
  sanitizeDisplayName,
} from "@/lib/auth/validation";
import { ensureWorkspaceAccessForSignIn } from "@/lib/workspace/bootstrap";

type RequestPayload = {
  email?: string;
  mode?: string;
  name?: string;
  returnTo?: string;
};

export async function POST(request: Request) {
  const authEnv = getAuthEnv();
  const requestOrigin = readRequestOrigin(request);
  const secure = isSecureRequest(request);
  let payload: RequestPayload;

  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const email = normalizeEmail(payload.email ?? "");
  const mode = parseAuthMode(payload.mode);
  const name = sanitizeDisplayName(payload.name ?? "");
  const returnTo = sanitizeReturnTo(payload.returnTo);

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
      authMethod: "email_link" as const,
    };

    try {
      await ensureAppUserRecord(sessionUser, {
        markSignedIn: true,
      });
      await syncAuthMethodOnSignIn({
        email,
        method: "email_link",
      });
      await ensureWorkspaceAccessForSignIn(sessionUser);
    } catch (error) {
      if (error instanceof Error && error.message.includes("blocked")) {
        return NextResponse.json({ error: "This account is blocked." }, { status: 403 });
      }

      if (error instanceof Error && error.message.includes("deleted")) {
        return NextResponse.json({ error: "This account has been deleted." }, { status: 403 });
      }

      console.error("Email sign-in provisioning failed.", error);
      return NextResponse.json(
        { error: "Fugue could not open the workspace session. Try again." },
        { status: 500 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      message: "Email accepted. Opening the session now.",
      redirectTo: returnTo,
    });

    response.cookies.set(
      {
        ...buildSessionCookie(sessionUser),
        secure,
      },
    );

    return response;
  }

  const token = signToken(
    {
      type: "email-verify",
      email,
      mode,
      name: name || undefined,
      origin: requestOrigin,
      returnTo,
    },
    60 * 15,
  );

  const verifyUrl = buildOriginUrl(requestOrigin, "/api/auth/email/verify");
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
