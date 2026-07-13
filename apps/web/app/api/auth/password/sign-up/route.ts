import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { sendVerificationEmail } from "@/lib/auth/email";
import { registerPasswordAuthMethod } from "@/lib/auth/methods";
import { buildOriginUrl, readRequestOrigin } from "@/lib/auth/origin";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import {
  AuthRequestTooLargeError,
  readLimitedJson,
  readLimitedUrlEncodedForm,
} from "@/lib/auth/request";
import { signToken } from "@/lib/auth/token";
import { logAuthEmailDeliveryFailure } from "@/lib/auth/telemetry";
import {
  AUTH_DISPLAY_NAME_MAX_LENGTH,
  AUTH_EMAIL_MAX_LENGTH,
  isValidEmail,
  normalizeEmail,
  sanitizeDisplayName,
  sanitizeReturnTo,
} from "@/lib/auth/validation";

type RequestPayload = {
  confirmPassword?: string;
  email?: string;
  name?: string;
  password?: string;
  returnTo?: string;
};

const PASSWORD_SIGN_UP_REQUEST_MAX_BYTES = 16 * 1_024;
const GENERIC_SIGN_UP_MESSAGE =
  "If this address can be registered, check your email for a verification link.";

function requestExpectsJson(request: Request) {
  return (request.headers.get("content-type") ?? "").includes("application/json");
}

async function readPayload(request: Request): Promise<RequestPayload> {
  if (requestExpectsJson(request)) {
    return readLimitedJson<RequestPayload>(request, PASSWORD_SIGN_UP_REQUEST_MAX_BYTES);
  }

  const formData = await readLimitedUrlEncodedForm(
    request,
    PASSWORD_SIGN_UP_REQUEST_MAX_BYTES,
  );
  return {
    confirmPassword: formData.get("confirmPassword") ?? undefined,
    email: formData.get("email") ?? undefined,
    name: formData.get("name") ?? undefined,
    password: formData.get("password") ?? undefined,
    returnTo: formData.get("returnTo") ?? undefined,
  };
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const requestOrigin = readRequestOrigin(request);
  let payload: RequestPayload;

  try {
    payload = await readPayload(request);
  } catch (error) {
    return jsonError(
      error instanceof AuthRequestTooLargeError
        ? "Authentication request payload is too large."
        : "Invalid request payload.",
      error instanceof AuthRequestTooLargeError ? 413 : 400,
    );
  }

  const rawEmail = typeof payload.email === "string" ? payload.email : "";
  const rawName = typeof payload.name === "string" ? payload.name : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const confirmPassword =
    typeof payload.confirmPassword === "string" ? payload.confirmPassword : "";
  const email = normalizeEmail(rawEmail);
  const name = sanitizeDisplayName(rawName);
  const returnTo = sanitizeReturnTo(payload.returnTo, requestOrigin);
  const limited = await enforceAuthRateLimit(request, "password-sign-up", email);

  if (limited) {
    return limited;
  }

  if (rawEmail.length > AUTH_EMAIL_MAX_LENGTH || !isValidEmail(email)) {
    return jsonError("Enter a valid email address.", 400);
  }

  if (Array.from(rawName).length > AUTH_DISPLAY_NAME_MAX_LENGTH) {
    return jsonError("Display name is too long.", 400);
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    return jsonError(passwordError, 400);
  }

  if (!confirmPassword || password !== confirmPassword) {
    return jsonError("Passwords do not match.", 400);
  }

  let registration: Awaited<ReturnType<typeof registerPasswordAuthMethod>>;

  try {
    const passwordHash = await hashPassword(password);
    registration = await registerPasswordAuthMethod({
      email,
      name,
      passwordHash,
    });
  } catch (error) {
    console.error("Password registration failed.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return jsonError("Account registration is temporarily unavailable.", 503);
  }

  const token = signToken(
    {
      type: "email-verify",
      jti: randomUUID(),
      email,
      mode: "signup",
      ...(registration.created && name ? { name } : {}),
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
      mode: "signup",
      name: registration.created ? name || undefined : undefined,
      verifyUrl: verifyUrl.toString(),
    });
  } catch (error) {
    logAuthEmailDeliveryFailure({
      category: error instanceof Error ? error.name : "unknown",
      flow: "password-signup",
    });
    return NextResponse.json(
      { error: "Verification email could not be sent. Try again." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      },
    );
  }

  return NextResponse.json(
    { ok: true, message: GENERIC_SIGN_UP_MESSAGE },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
