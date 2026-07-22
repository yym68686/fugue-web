import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ensureAppUserRecord } from "@/lib/app-users/store";
import { sendVerificationEmail } from "@/lib/auth/email";
import { getAuthEnv } from "@/lib/auth/env";
import { syncAuthMethodOnSignIn } from "@/lib/auth/methods";
import { buildOriginUrl, isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import { AuthRequestTooLargeError, readLimitedJson } from "@/lib/auth/request";
import { buildSessionCookie } from "@/lib/auth/session";
import {
  logAuthEmailDeliveryFailure,
  logAuthEmailDeliverySuccess,
} from "@/lib/auth/telemetry";
import { signToken } from "@/lib/auth/token";
import {
  AUTH_DISPLAY_NAME_MAX_LENGTH,
  AUTH_EMAIL_MAX_LENGTH,
  isValidEmail,
  normalizeEmail,
  parseAuthMode,
  sanitizeDisplayName,
  sanitizeReturnTo,
} from "@/lib/auth/validation";
// [STEP2] provisioning disabled for step 1 (auth-only): restore with lib/workspace/bootstrap
// import { ensureWorkspaceAccessForSignIn } from "@/lib/workspace/bootstrap";

type RequestPayload = {
  email?: string;
  mode?: string;
  name?: string;
  returnTo?: string;
};

export async function POST(request: Request) {
  const requestOrigin = readRequestOrigin(request);
  const secure = isSecureRequest(request);
  let payload: RequestPayload;

  try {
    payload = await readLimitedJson<RequestPayload>(request, 8 * 1_024);
  } catch (error) {
    if (error instanceof AuthRequestTooLargeError) {
      return NextResponse.json(
        { error: "Authentication request payload is too large." },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const rawEmail = typeof payload.email === "string" ? payload.email : "";
  const rawName = typeof payload.name === "string" ? payload.name : "";
  const rawReturnTo =
    typeof payload.returnTo === "string" ? payload.returnTo : undefined;
  const email = normalizeEmail(rawEmail);
  const mode = parseAuthMode(
    typeof payload.mode === "string" ? payload.mode : undefined,
  );
  const name = sanitizeDisplayName(rawName);
  const returnTo = sanitizeReturnTo(rawReturnTo, requestOrigin);
  const limited = await enforceAuthRateLimit(request, "email-start", email);

  if (limited) {
    return limited;
  }

  if (rawEmail.length > AUTH_EMAIL_MAX_LENGTH || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (Array.from(rawName).length > AUTH_DISPLAY_NAME_MAX_LENGTH) {
    return NextResponse.json({ error: "Display name is too long." }, { status: 400 });
  }

  const authEnv = getAuthEnv();

  if (!authEnv.emailVerificationRequired) {
    const sessionUser = {
      email,
      name: name || undefined,
      provider: "email" as const,
      verified: true,
      authMethod: "email_link" as const,
    };

    let appUser: Awaited<ReturnType<typeof ensureAppUserRecord>>;

    try {
      appUser = await ensureAppUserRecord(sessionUser, {
        markSignedIn: true,
      });
      await syncAuthMethodOnSignIn({
        email,
        method: "email_link",
      });
      // [STEP2] await ensureWorkspaceAccessForSignIn(sessionUser);
    } catch (error) {
      if (error instanceof Error && error.message.includes("blocked")) {
        return NextResponse.json(
          { error: "This account is blocked." },
          { status: 403 },
        );
      }

      if (error instanceof Error && error.message.includes("deleted")) {
        return NextResponse.json(
          { error: "This account has been deleted." },
          { status: 403 },
        );
      }

      console.error("Email sign-in provisioning failed.", {
        category: error instanceof Error ? error.name : "unknown",
      });
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

    response.cookies.set({
      ...buildSessionCookie({
        ...sessionUser,
        sessionVersion: appUser.sessionVersion,
      }),
      secure,
    });

    return response;
  }

  const token = signToken(
    {
      type: "email-verify",
      jti: randomUUID(),
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
    logAuthEmailDeliverySuccess({ flow: "email-link" });

    return NextResponse.json({
      ok: true,
      message: `Verification link sent to ${email}.`,
    });
  } catch (error) {
    logAuthEmailDeliveryFailure({
      category: error instanceof Error ? error.name : "unknown",
      flow: "email-link",
    });
    return NextResponse.json(
      { error: "Verification email could not be sent. Try again." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }
}
