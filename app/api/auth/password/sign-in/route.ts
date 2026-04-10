import { NextResponse } from "next/server";

import { ensureAppUserRecord, getAppUserByEmail } from "@/lib/app-users/store";
import { touchAuthMethod, getPasswordHashByEmail } from "@/lib/auth/methods";
import { isSecureRequest } from "@/lib/auth/origin";
import { verifyPassword } from "@/lib/auth/password";
import { buildSessionCookie } from "@/lib/auth/session";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeReturnTo,
} from "@/lib/auth/validation";
import { ensureWorkspaceAccessForSignIn } from "@/lib/workspace/bootstrap";

type RequestPayload = {
  email?: string;
  password?: string;
  returnTo?: string;
};

const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect.";

export async function POST(request: Request) {
  const secure = isSecureRequest(request);
  let payload: RequestPayload;

  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const email = normalizeEmail(payload.email ?? "");
  const password = typeof payload.password === "string" ? payload.password : "";
  const returnTo = sanitizeReturnTo(payload.returnTo);

  if (!isValidEmail(email) || !password) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 400 });
  }

  const passwordHash = await getPasswordHashByEmail(email);

  if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  const user = await getAppUserByEmail(email);

  if (!user) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  const sessionUser = {
    email,
    name: user.name ?? undefined,
    picture: user.pictureUrl ?? undefined,
    provider: "email" as const,
    verified: true,
    authMethod: "password" as const,
  };

  try {
    await ensureAppUserRecord(sessionUser, {
      markSignedIn: true,
    });
    await touchAuthMethod(email, "password");
    await ensureWorkspaceAccessForSignIn(sessionUser);
  } catch (error) {
    if (error instanceof Error && error.message.includes("blocked")) {
      return NextResponse.json({ error: "This account is blocked." }, { status: 403 });
    }

    if (error instanceof Error && error.message.includes("deleted")) {
      return NextResponse.json(
        { error: "This account has been deleted." },
        { status: 403 },
      );
    }

    console.error("Password sign-in provisioning failed.", error);
    return NextResponse.json(
      { error: "Fugue could not open the workspace session. Try again." },
      { status: 500 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: returnTo,
  });

  response.cookies.set({
    ...buildSessionCookie(sessionUser),
    secure,
  });

  return response;
}
