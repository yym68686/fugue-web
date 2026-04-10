import { after, NextResponse } from "next/server";

import { ensureAppUserRecord, getAppUserByEmail } from "@/lib/app-users/store";
import {
  AUTH_ERROR_ACCOUNT_BLOCKED,
  AUTH_ERROR_ACCOUNT_DELETED,
  AUTH_ERROR_INVALID_CREDENTIALS,
  AUTH_ERROR_SESSION_OPEN_FAILED,
  buildSignInErrorUrl,
} from "@/lib/auth/errors";
import { touchAuthMethod, getPasswordHashByEmail } from "@/lib/auth/methods";
import { buildOriginUrl, isSecureRequest, readRequestOrigin } from "@/lib/auth/origin";
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

function requestExpectsJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

function readOptionalFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : undefined;
}

async function readPayload(
  request: Request,
  expectsJson: boolean,
): Promise<RequestPayload> {
  if (expectsJson) {
    return (await request.json()) as RequestPayload;
  }

  const formData = await request.formData();
  return {
    email: readOptionalFormValue(formData.get("email")),
    password: readOptionalFormValue(formData.get("password")),
    returnTo: readOptionalFormValue(formData.get("returnTo")),
  } satisfies RequestPayload;
}

function buildFailureRedirectUrl(
  request: Request,
  returnTo: string,
  error: Parameters<typeof buildSignInErrorUrl>[1],
) {
  const url = buildSignInErrorUrl(readRequestOrigin(request), error);
  url.searchParams.set("returnTo", returnTo);
  return url;
}

function respondAuthError(input: {
  code: Parameters<typeof buildSignInErrorUrl>[1];
  expectsJson: boolean;
  message: string;
  request: Request;
  returnTo: string;
  status: number;
}) {
  if (input.expectsJson) {
    return NextResponse.json({ error: input.message }, { status: input.status });
  }

  return NextResponse.redirect(
    buildFailureRedirectUrl(input.request, input.returnTo, input.code),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  const secure = isSecureRequest(request);
  const expectsJson = requestExpectsJson(request);
  let payload: RequestPayload;

  try {
    payload = await readPayload(request, expectsJson);
  } catch {
    return respondAuthError({
      code: AUTH_ERROR_INVALID_CREDENTIALS,
      expectsJson,
      message: INVALID_CREDENTIALS_MESSAGE,
      request,
      returnTo: "/app",
      status: 400,
    });
  }

  const email = normalizeEmail(payload.email ?? "");
  const password = typeof payload.password === "string" ? payload.password : "";
  const returnTo = sanitizeReturnTo(payload.returnTo);

  if (!isValidEmail(email) || !password) {
    return respondAuthError({
      code: AUTH_ERROR_INVALID_CREDENTIALS,
      expectsJson,
      message: INVALID_CREDENTIALS_MESSAGE,
      request,
      returnTo,
      status: 400,
    });
  }

  const passwordHash = await getPasswordHashByEmail(email);

  if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
    return respondAuthError({
      code: AUTH_ERROR_INVALID_CREDENTIALS,
      expectsJson,
      message: INVALID_CREDENTIALS_MESSAGE,
      request,
      returnTo,
      status: 401,
    });
  }

  const user = await getAppUserByEmail(email);

  if (!user) {
    return respondAuthError({
      code: AUTH_ERROR_INVALID_CREDENTIALS,
      expectsJson,
      message: INVALID_CREDENTIALS_MESSAGE,
      request,
      returnTo,
      status: 401,
    });
  }

  if (user.status === "blocked") {
    return respondAuthError({
      code: AUTH_ERROR_ACCOUNT_BLOCKED,
      expectsJson,
      message: "This account is blocked.",
      request,
      returnTo,
      status: 403,
    });
  }

  if (user.status === "deleted") {
    return respondAuthError({
      code: AUTH_ERROR_ACCOUNT_DELETED,
      expectsJson,
      message: "This account has been deleted.",
      request,
      returnTo,
      status: 403,
    });
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
    await ensureWorkspaceAccessForSignIn(sessionUser);
  } catch (error) {
    if (error instanceof Error && error.message.includes("blocked")) {
      return respondAuthError({
        code: AUTH_ERROR_ACCOUNT_BLOCKED,
        expectsJson,
        message: "This account is blocked.",
        request,
        returnTo,
        status: 403,
      });
    }

    if (error instanceof Error && error.message.includes("deleted")) {
      return respondAuthError({
        code: AUTH_ERROR_ACCOUNT_DELETED,
        expectsJson,
        message: "This account has been deleted.",
        request,
        returnTo,
        status: 403,
      });
    }

    console.error("Password sign-in provisioning failed.", error);
    return respondAuthError({
      code: AUTH_ERROR_SESSION_OPEN_FAILED,
      expectsJson,
      message: "Fugue could not open the workspace session. Try again.",
      request,
      returnTo,
      status: 500,
    });
  }

  const response = expectsJson
    ? NextResponse.json({
        ok: true,
        redirectTo: returnTo,
      })
    : NextResponse.redirect(buildOriginUrl(readRequestOrigin(request), returnTo), {
        status: 303,
      });

  response.cookies.set({
    ...buildSessionCookie(sessionUser),
    secure,
  });

  after(async () => {
    try {
      await ensureAppUserRecord(sessionUser, {
        markSignedIn: true,
      });
      await touchAuthMethod(email, "password");
    } catch (error) {
      console.error("Password sign-in bookkeeping failed.", error);
    }
  });

  return response;
}
