import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CURRENT_SEAL_VERSION = "v2";
const LEGACY_SEAL_VERSION = "v1";
const SEAL_ALGORITHM = "aes-256-gcm";
const DEFAULT_KEY_ID = "primary";
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

type SealKey = {
  id: string;
  key: Buffer;
};

export type UnsealedText = {
  keyId: string;
  needsReseal: boolean;
  value: string;
};

function readRequiredSealSecret(): string {
  const secret = process.env.WORKSPACE_STORE_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Missing WORKSPACE_STORE_SECRET. Configure an independent workspace seal key.",
    );
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error(
      "WORKSPACE_STORE_SECRET must contain at least 32 characters in production.",
    );
  }
  return secret;
}

function readActiveKeyId(): string {
  const keyId = process.env.WORKSPACE_STORE_KEY_ID?.trim() || DEFAULT_KEY_ID;
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new Error(
      "WORKSPACE_STORE_KEY_ID must use 1-32 letters, digits, underscores, or hyphens.",
    );
  }
  return keyId;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function readPreviousKeys(): Map<string, SealKey> {
  const raw = process.env.WORKSPACE_STORE_PREVIOUS_KEYS?.trim();
  if (!raw) return new Map();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "WORKSPACE_STORE_PREVIOUS_KEYS must be a JSON object of key id to secret.",
    );
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(
      "WORKSPACE_STORE_PREVIOUS_KEYS must be a JSON object of key id to secret.",
    );
  }

  const keys = new Map<string, SealKey>();
  for (const [id, value] of Object.entries(parsed)) {
    if (!KEY_ID_PATTERN.test(id) || typeof value !== "string" || value.length < 32) {
      throw new Error(
        "Each WORKSPACE_STORE_PREVIOUS_KEYS entry requires a valid id and a 32+ character secret.",
      );
    }
    keys.set(id, { id, key: deriveKey(value) });
  }
  return keys;
}

function readKeyring(): { active: SealKey; all: Map<string, SealKey> } {
  const active = {
    id: readActiveKeyId(),
    key: deriveKey(readRequiredSealSecret()),
  };
  const all = readPreviousKeys();
  all.set(active.id, active);
  return { active, all };
}

function decrypt(
  key: Buffer,
  ivValue: string,
  tagValue: string,
  encryptedValue: string,
): string {
  const decipher = createDecipheriv(
    SEAL_ALGORITHM,
    key,
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function sealText(value: string): string {
  const { active } = readKeyring();
  const iv = randomBytes(12);
  const cipher = createCipheriv(SEAL_ALGORITHM, active.key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    CURRENT_SEAL_VERSION,
    active.id,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function unsealTextWithMetadata(payload: string): UnsealedText {
  const segments = payload.split(".");
  const { active, all } = readKeyring();

  if (segments[0] === CURRENT_SEAL_VERSION) {
    const [, keyId, ivValue, tagValue, encryptedValue] = segments;
    if (!keyId || !ivValue || !tagValue || !encryptedValue || segments.length !== 5) {
      throw new Error("Invalid sealed payload.");
    }
    const key = all.get(keyId);
    if (!key) throw new Error("Sealed payload references an unavailable key id.");
    return {
      keyId,
      needsReseal: keyId !== active.id,
      value: decrypt(key.key, ivValue, tagValue, encryptedValue),
    };
  }

  if (segments[0] === LEGACY_SEAL_VERSION) {
    const [, ivValue, tagValue, encryptedValue] = segments;
    if (!ivValue || !tagValue || !encryptedValue || segments.length !== 4) {
      throw new Error("Invalid sealed payload.");
    }
    for (const key of all.values()) {
      try {
        return {
          keyId: key.id,
          needsReseal: true,
          value: decrypt(key.key, ivValue, tagValue, encryptedValue),
        };
      } catch {
        // Legacy v1 had no key id, so each explicitly configured key must be tried.
      }
    }
  }

  throw new Error("Invalid sealed payload.");
}

export function unsealText(payload: string): string {
  return unsealTextWithMetadata(payload).value;
}

export function resealTextIfNeeded(payload: string): {
  resealed: string | null;
  value: string;
} {
  const result = unsealTextWithMetadata(payload);
  return {
    resealed: result.needsReseal ? sealText(result.value) : null,
    value: result.value,
  };
}

export function validateSealConfiguration(): void {
  readKeyring();
}
