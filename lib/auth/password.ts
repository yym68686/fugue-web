import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { checkPasswordPolicy } from "@/lib/auth/password-policy";

const PASSWORD_HASH_PREFIX = "scrypt_v1";
const PASSWORD_HASH_KEY_LENGTH = 64;

const scrypt = promisify(scryptCallback);

function toBuffer(value: string) {
  return Buffer.from(value, "base64url");
}

/** Server-side gate. The rules live in lib/auth/password-policy.ts so the
 * sign-up form can show the same limits it will be judged against. */
export function validatePassword(password: string) {
  return checkPasswordPolicy(password);
}

export async function hashPassword(password: string) {
  const validationError = validatePassword(password);

  if (validationError) {
    throw new Error(validationError);
  }

  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, PASSWORD_HASH_KEY_LENGTH)) as Buffer;

  return [
    PASSWORD_HASH_PREFIX,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [prefix, saltValue, hashValue] = storedHash.split("$");

  if (prefix !== PASSWORD_HASH_PREFIX || !saltValue?.trim() || !hashValue?.trim()) {
    return false;
  }

  const salt = toBuffer(saltValue);
  const expectedHash = toBuffer(hashValue);
  const nextHash = (await scrypt(password, salt, expectedHash.length)) as Buffer;

  if (expectedHash.length !== nextHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, nextHash);
}
