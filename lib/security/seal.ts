import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const SEAL_VERSION = "v1";
const SEAL_ALGORITHM = "aes-256-gcm";

function readWorkspaceSealSecret() {
  const explicit =
    process.env.WORKSPACE_STORE_SECRET?.trim() ||
    process.env.AUTH_SESSION_SECRET?.trim();

  if (explicit) {
    return explicit;
  }

  const seed = [
    process.env.GOOGLE_CLIENT_ID?.trim(),
    process.env.GOOGLE_CLIENT_SECRET?.trim(),
    process.env.RESEND_API_KEY?.trim(),
  ]
    .filter((value): value is string => Boolean(value))
    .join(":");

  if (!seed) {
    throw new Error(
      "Missing WORKSPACE_STORE_SECRET and AUTH_SESSION_SECRET. Configure one of them before storing workspace credentials.",
    );
  }

  return createHash("sha256").update(seed).digest("hex");
}

function getSealKey() {
  return createHash("sha256").update(readWorkspaceSealSecret()).digest();
}

export function sealText(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(SEAL_ALGORITHM, getSealKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    SEAL_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function unsealText(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");

  if (
    version !== SEAL_VERSION ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new Error("Invalid sealed payload.");
  }

  const decipher = createDecipheriv(
    SEAL_ALGORITHM,
    getSealKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
