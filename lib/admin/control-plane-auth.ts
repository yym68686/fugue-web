import "server-only";

import { timingSafeEqual } from "node:crypto";

const MAX_BEARER_TOKEN_LENGTH = 4_096;

export function readBearerToken(value: string | null) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  const match = /^Bearer\s+(\S+)$/i.exec(trimmed);
  const token = match?.[1] ?? "";

  return token.length > 0 && token.length <= MAX_BEARER_TOKEN_LENGTH
    ? token
    : "";
}

export function secretsMatch(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}
