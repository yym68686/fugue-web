import { createHmac, timingSafeEqual } from "node:crypto";

import { getAuthSessionSecret } from "@/lib/auth/env";

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
  return createHmac("sha256", getAuthSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function signToken<T extends Record<string, unknown>>(
  payload: T,
  maxAgeSeconds: number,
) {
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
  if (token.length > 8_192) {
    return null;
  }

  const segments = token.split(".");

  if (segments.length !== 3) {
    return null;
  }

  const [header, body, signature] = segments;

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
    const protectedHeader = JSON.parse(decodeSegment(header)) as {
      alg?: unknown;
      typ?: unknown;
    };

    if (protectedHeader.alg !== "HS256" || protectedHeader.typ !== "FUGUE") {
      return null;
    }

    const payload = JSON.parse(decodeSegment(body)) as T;
    const now = Math.floor(Date.now() / 1000);

    if (
      !payload ||
      typeof payload.exp !== "number" ||
      !Number.isSafeInteger(payload.exp) ||
      typeof payload.iat !== "number" ||
      !Number.isSafeInteger(payload.iat) ||
      typeof payload.type !== "string" ||
      !payload.type ||
      payload.exp <= now ||
      payload.iat > now + 60 ||
      payload.exp <= payload.iat
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
