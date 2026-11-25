import { NextResponse } from "next/server";

import { sendVerificationEmail } from "@/lib/auth/email";
import { discardPasswordRegistration, stagePasswordRegistration } from "@/lib/auth/methods";
import { buildOriginUrl, readRequestOrigin } from "@/lib/auth/origin";
import {
  hashRegistrationBrowserSecret,
  newPasswordRegistrationProof,
  passwordRegistrationCookie,
  PASSWORD_REGISTRATION_MAX_AGE,
  PASSWORD_VERIFICATION_PATH,
} from "@/lib/auth/password-registration-proof";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { enforceAuthRateLimit } from "@/lib/auth/rate-limit";
import {
  AuthRequestTooLargeError,
  readLimitedJson,
  readLimitedUrlEncodedForm,
} from "@/lib/auth/request";
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
  // A different site must not initiate a password registration and set its
  // browser proof in the mailbox owner's browser via a cross-origin form.
  const fetchSite = request.headers.get("sec-fetch-site");
  if (request.headers.get("origin") !== requestOrigin || (fetchSite && fetchSite !== "same-origin")) {
    return jsonError("Open the Fugue sign-up page to register.", 403);
  }
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

  const { id, browserSecret } = newPasswordRegistrationProof();
  const token = signToken(
    { type: "password-signup", jti: id, email, origin: requestOrigin, returnTo },
    PASSWORD_REGISTRATION_MAX_AGE,
  );

  try {
    const passwordHash = await hashPassword(password);
    await stagePasswordRegistration({
      id,
      email,
      name,
      passwordHash,
      browserHash: hashRegistrationBrowserSecret(browserSecret),
      maxAgeSeconds: PASSWORD_REGISTRATION_MAX_AGE,
    });
  } catch (error) {
    console.error("Password registration failed.", {
      category: error instanceof Error ? error.name : "unknown",
    });
    return jsonError("Account registration is temporarily unavailable.", 503);
  }

  const verifyUrl = buildOriginUrl(requestOrigin, PASSWORD_VERIFICATION_PATH);
  verifyUrl.searchParams.set("token", token);

  try {
    await sendVerificationEmail({
      email,
      mode: "signup",
      requiresSignupBrowser: true,
      verifyUrl: verifyUrl.toString(),
    });
    logAuthEmailDeliverySuccess({ flow: "password-signup" });
  } catch (error) {
    await discardPasswordRegistration(id).catch(() => {
      // Still expires even if the database is unavailable during cleanup.
      console.warn("Failed to discard a pending password registration.");
    });
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

  const response = NextResponse.json(
    { ok: true, message: GENERIC_SIGN_UP_MESSAGE },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set({
    ...passwordRegistrationCookie(id, requestOrigin.startsWith("https://")),
    value: browserSecret,
  });
  return response;
}
