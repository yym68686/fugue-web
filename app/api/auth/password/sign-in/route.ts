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
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import {
  AuthRequestTooLargeError,
  readLimitedJson,
  readLimitedUrlEncodedForm,
} from "@/lib/auth/request";
import { buildSessionCookie } from "@/lib/auth/session";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeReturnTo,
  AUTH_EMAIL_MAX_LENGTH,
} from "@/lib/auth/validation";
// [STEP2] provisioning disabled for step 1 (auth-only): restore with lib/workspace/bootstrap
// import { ensureWorkspaceAccessForSignIn } from "@/lib/workspace/bootstrap";

type RequestPayload = {
  email?: string;
  password?: string;
  returnTo?: string;
};

const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect.";
const PASSWORD_MAX_LENGTH = 256;
const PASSWORD_REQUEST_MAX_BYTES = 16 * 1_024;
const DUMMY_PASSWORD_HASH =
  "scrypt_v1$ZnVndWUtYXV0aC1kdW1teS12MQ$7AW7qEy5WdgZNAZVgtPLwkWm8GYf0rvGsEARmh7H8P7h1T7W8ssFRE5_hFJC48zvmWQZHP1qicSC7il72IE5fA";

function requestExpectsJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

async function readPayload(
  request: Request,
  expectsJson: boolean,
): Promise<RequestPayload> {
  if (expectsJson) {
    return readLimitedJson<RequestPayload>(request, PASSWORD_REQUEST_MAX_BYTES);
  }

  const formData = await readLimitedUrlEncodedForm(request, PASSWORD_REQUEST_MAX_BYTES);
  return {
    email: formData.get("email") ?? undefined,
    password: formData.get("password") ?? undefined,
    returnTo: formData.get("returnTo") ?? undefined,
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
  } catch (error) {
    return respondAuthError({
      code: AUTH_ERROR_INVALID_CREDENTIALS,
      expectsJson,
      message: INVALID_CREDENTIALS_MESSAGE,
      request,
      returnTo: "/app",
      status: error instanceof AuthRequestTooLargeError ? 413 : 400,
    });
  }

  const rawEmail = typeof payload.email === "string" ? payload.email : "";
  const email = normalizeEmail(rawEmail);
  const password = typeof payload.password === "string" ? payload.password : "";
  const returnTo = sanitizeReturnTo(
    typeof payload.returnTo === "string" ? payload.returnTo : undefined,
    readRequestOrigin(request),
  );
  const limited = await enforceAuthRateLimit(request, "password-sign-in", email);

  if (limited) {
    return limited;
  }

  if (
    rawEmail.length > AUTH_EMAIL_MAX_LENGTH ||
    !isValidEmail(email) ||
    !password ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return respondAuthError({
      code: AUTH_ERROR_INVALID_CREDENTIALS,
      expectsJson,
      message: INVALID_CREDENTIALS_MESSAGE,
      request,
      returnTo,
      status: 400,
    });
  }

  let passwordHash: string | null;

  try {
    passwordHash = await getPasswordHashByEmail(email);
  } catch (error) {
    console.error("Password sign-in credential lookup failed.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return respondAuthError({
      code: AUTH_ERROR_SESSION_OPEN_FAILED,
      expectsJson,
      message: "Fugue could not open the workspace session. Try again.",
      request,
      returnTo,
      status: 500,
    });
  }

  const passwordMatches = await verifyPassword(
    password,
    passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!passwordHash || !passwordMatches) {
    return respondAuthError({
      code: AUTH_ERROR_INVALID_CREDENTIALS,
      expectsJson,
      message: INVALID_CREDENTIALS_MESSAGE,
      request,
      returnTo,
      status: 401,
    });
  }

  let user: Awaited<ReturnType<typeof getAppUserByEmail>>;

  try {
    user = await getAppUserByEmail(email);
  } catch (error) {
    console.error("Password sign-in user lookup failed.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return respondAuthError({
      code: AUTH_ERROR_SESSION_OPEN_FAILED,
      expectsJson,
      message: "Fugue could not open the workspace session. Try again.",
      request,
      returnTo,
      status: 500,
    });
  }

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

  // Password credentials may be persisted before the verification email is
  // consumed so retries remain idempotent. They must never become a session
  // until the owning address has completed that verification step.
  if (!user.verified) {
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
  let signedInUser = user;

  try {
    signedInUser = await ensureAppUserRecord(sessionUser, {
      markSignedIn: true,
    });
    // [STEP2] await ensureWorkspaceAccessForSignIn(sessionUser);
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

    console.error("Password sign-in provisioning failed.", {
      category: error instanceof Error ? error.name : "unknown",
    });
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
    ...buildSessionCookie({
      ...sessionUser,
      sessionVersion: signedInUser.sessionVersion,
    }),
    secure,
  });

  after(async () => {
    try {
      await touchAuthMethod(email, "password");
    } catch (error) {
      console.error("Password sign-in bookkeeping failed.", {
        category: error instanceof Error ? error.name : "unknown",
      });
    }
  });

  return response;
}
