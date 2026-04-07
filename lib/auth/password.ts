import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const PASSWORD_HASH_PREFIX = "scrypt_v1";
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 256;

const scrypt = promisify(scryptCallback);

function toBuffer(value: string) {
  return Buffer.from(value, "base64url");
}

export function validatePassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Passwords must stay under ${PASSWORD_MAX_LENGTH} characters.`;
  }

  if (!password.trim()) {
    return "Enter a password.";
  }

  return null;
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

  if (
    prefix !== PASSWORD_HASH_PREFIX ||
    !saltValue?.trim() ||
    !hashValue?.trim()
  ) {
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
