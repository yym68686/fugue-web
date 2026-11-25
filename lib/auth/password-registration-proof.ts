import { createHash, randomBytes, randomUUID } from "node:crypto";

export const PASSWORD_REGISTRATION_MAX_AGE = 15 * 60;
export const PASSWORD_VERIFICATION_PATH = "/api/auth/email/verify";

export function isPasswordRegistrationId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(value);
}

export function newPasswordRegistrationProof() {
  return { id: randomUUID(), browserSecret: randomBytes(32).toString("base64url") };
}

export function hashRegistrationBrowserSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function passwordRegistrationCookie(id: string, secure: boolean) {
  return {
    name: `${secure ? "__Host-" : ""}fugue_signup_${id}`,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: PASSWORD_REGISTRATION_MAX_AGE,
  };
}
