import { createHmac, timingSafeEqual } from "node:crypto";

import { getAuthEnv } from "@/lib/auth/env";

type BaseTokenPayload = {
  exp: number;
  iat: number;
  type: string;
};

function encodeSegment(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decodeSegment(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createSignature(payload: string) {
  return createHmac("sha256", getAuthEnv().sessionSecret)
    .update(payload)
    .digest("base64url");
}

export function signToken<T extends Record<string, unknown>>(payload: T, maxAgeSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeSegment(JSON.stringify({ alg: "HS256", typ: "FUGUE" }));
  const body = encodeSegment(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + maxAgeSeconds,
    }),
  );
  const unsigned = `${header}.${body}`;
  const signature = createSignature(unsigned);
  return `${unsigned}.${signature}`;
}

export function verifyToken<T extends BaseTokenPayload>(token: string) {
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) {
    return null;
  }

  const expected = createSignature(`${header}.${body}`);
  const valid =
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!valid) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeSegment(body)) as T;

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
