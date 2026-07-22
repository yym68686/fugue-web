import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PKCE_VERIFIER_BYTES = 64;

export function createOAuthNonce() {
  return randomBytes(32).toString("base64url");
}

export function hashOAuthNonce(nonce: string) {
  return createHash("sha256").update(nonce, "utf8").digest("base64url");
}

export function safelyMatchesOAuthNonce(nonce: string, expectedHash: string) {
  const actual = Buffer.from(hashOAuthNonce(nonce), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createPkcePair() {
  const verifier = randomBytes(PKCE_VERIFIER_BYTES).toString("base64url");
  const challenge = createHash("sha256").update(verifier, "ascii").digest("base64url");

  return {
    challenge,
    verifier,
  };
}
