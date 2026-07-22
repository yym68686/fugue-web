import "server-only";

import { randomUUID } from "node:crypto";

import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import {
  createOAuthNonce,
  createPkcePair,
  hashOAuthNonce,
  safelyMatchesOAuthNonce,
} from "@/lib/auth/oauth-crypto";
import { sealText, unsealText } from "@/lib/security/seal";
import { signToken, verifyToken } from "@/lib/auth/token";
import { normalizeAuthOrigin } from "@/lib/auth/origin";
import { normalizeEmail, sanitizeReturnTo } from "@/lib/auth/validation";

const OAUTH_TRANSACTION_MAX_AGE_SECONDS = 60 * 10;
const OAUTH_COOKIE_PREFIX = "fugue_oauth_";

export type OAuthFlow =
  | "github-connect"
  | "github-link"
  | "github-signin"
  | "google-link"
  | "google-signin";

type OAuthTransactionRow = {
  consumed_at: Date | string | null;
  created_at: Date | string;
  expires_at: Date | string;
  failed_at: Date | string | null;
  finalized_at: Date | string | null;
  flow: OAuthFlow;
  id: string;
  mode: "signin" | "signup" | null;
  nonce_hash: string;
  origin: string;
  pkce_verifier_sealed: string;
  return_to: string;
  subject_email: string | null;
};

type OAuthStatePayload = {
  exp: number;
  flow: OAuthFlow;
  iat: number;
  transactionId: string;
  type: "oauth-transaction";
};

export type ConsumedOAuthTransaction = {
  flow: OAuthFlow;
  id: string;
  mode: "signin" | "signup" | null;
  origin: string;
  pkceVerifier: string;
  returnTo: string;
  subjectEmail: string | null;
};

function isOAuthFlow(value: unknown): value is OAuthFlow {
  return (
    value === "github-connect" ||
    value === "github-link" ||
    value === "github-signin" ||
    value === "google-link" ||
    value === "google-signin"
  );
}

function isTransactionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function readDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function buildOAuthTransactionCookieName(transactionId: string) {
  if (!isTransactionId(transactionId)) {
    throw new Error("Invalid OAuth transaction id.");
  }

  return `${OAUTH_COOKIE_PREFIX}${transactionId}`;
}

export function readOAuthTransactionCookie(request: Request, transactionId: string) {
  const cookieName = buildOAuthTransactionCookieName(transactionId);
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");

    if (separator < 0 || part.slice(0, separator).trim() !== cookieName) {
      continue;
    }

    const rawValue = part.slice(separator + 1).trim();

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

export function buildOAuthTransactionCookie(
  transactionId: string,
  nonce: string,
  secure: boolean,
) {
  return {
    name: buildOAuthTransactionCookieName(transactionId),
    value: nonce,
    httpOnly: true,
    maxAge: OAUTH_TRANSACTION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}

export function buildExpiredOAuthTransactionCookie(
  transactionId: string,
  secure: boolean,
) {
  return {
    name: buildOAuthTransactionCookieName(transactionId),
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}

export function readOAuthStateTransactionId(
  stateToken: string | null | undefined,
  expectedFlow: OAuthFlow,
) {
  const state = readSignedOAuthState(stateToken);

  if (!state || state.flow !== expectedFlow) {
    return null;
  }

  return state.transactionId;
}

function readSignedOAuthState(stateToken: string | null | undefined) {
  if (!stateToken || stateToken.length > 4_096) {
    return null;
  }

  const state = verifyToken<OAuthStatePayload>(stateToken);

  if (
    !state ||
    state.type !== "oauth-transaction" ||
    !isOAuthFlow(state.flow) ||
    !isTransactionId(state.transactionId)
  ) {
    return null;
  }

  return state;
}

/**
 * Returns an id only from a valid signed OAuth state. Callback routes use this
 * solely to expire the matching browser cookie when a state reaches the wrong
 * provider/flow endpoint; authorization still requires the expected flow.
 */
export function readOAuthStateTransactionIdForCleanup(
  stateToken: string | null | undefined,
) {
  return readSignedOAuthState(stateToken)?.transactionId ?? null;
}

export async function beginOAuthTransaction(input: {
  flow: OAuthFlow;
  mode?: "signin" | "signup" | null;
  origin: string;
  returnTo: string;
  subjectEmail?: string | null;
}) {
  await ensureDbSchema();

  const id = randomUUID();
  const nonce = createOAuthNonce();
  const pkce = createPkcePair();
  const createdAt = new Date();
  const normalizedOrigin = normalizeAuthOrigin(input.origin);

  if (!normalizedOrigin || normalizedOrigin !== input.origin) {
    throw new Error("OAuth transaction origin must be canonical.");
  }

  const expiresAt = new Date(
    createdAt.getTime() + OAUTH_TRANSACTION_MAX_AGE_SECONDS * 1_000,
  );
  const state = signToken(
    {
      type: "oauth-transaction",
      flow: input.flow,
      transactionId: id,
    },
    OAUTH_TRANSACTION_MAX_AGE_SECONDS,
  );

  await queryDb(
    `
      INSERT INTO app_auth_oauth_transactions (
        id,
        flow,
        nonce_hash,
        pkce_verifier_sealed,
        origin,
        return_to,
        subject_email,
        mode,
        created_at,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      id,
      input.flow,
      hashOAuthNonce(nonce),
      sealText(pkce.verifier),
      normalizedOrigin,
      sanitizeReturnTo(input.returnTo),
      input.subjectEmail ? normalizeEmail(input.subjectEmail) : null,
      input.mode ?? null,
      createdAt.toISOString(),
      expiresAt.toISOString(),
    ],
  );

  try {
    // Keep forensic metadata briefly while removing expired verifier material.
    await queryDb(
      `
        UPDATE app_auth_oauth_transactions
        SET pkce_verifier_sealed = ''
        WHERE expires_at < NOW()
          AND pkce_verifier_sealed <> ''
      `,
    );
    await queryDb(
      `
        DELETE FROM app_auth_oauth_transactions
        WHERE expires_at < NOW() - INTERVAL '30 days'
      `,
    );
  } catch (error) {
    console.error("Could not clean expired OAuth transaction metadata.", {
      category: error instanceof Error ? error.name : "unknown",
    });
  }

  return {
    codeChallenge: pkce.challenge,
    id,
    nonce,
    state,
  };
}

export async function consumeOAuthTransaction(input: {
  expectedFlow: OAuthFlow;
  nonce: string;
  stateToken: string;
}): Promise<ConsumedOAuthTransaction | null> {
  const transactionId = readOAuthStateTransactionId(
    input.stateToken,
    input.expectedFlow,
  );

  if (!transactionId || !input.nonce || input.nonce.length > 256) {
    return null;
  }

  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    const result = await client.query<OAuthTransactionRow>(
      `
        SELECT
          id,
          flow,
          nonce_hash,
          pkce_verifier_sealed,
          origin,
          return_to,
          subject_email,
          mode,
          created_at,
          expires_at,
          consumed_at,
          finalized_at,
          failed_at
        FROM app_auth_oauth_transactions
        WHERE id = $1
        FOR UPDATE
      `,
      [transactionId],
    );
    const row = result.rows[0];

    if (
      !row ||
      row.flow !== input.expectedFlow ||
      row.consumed_at ||
      row.finalized_at ||
      row.failed_at ||
      !safelyMatchesOAuthNonce(input.nonce, row.nonce_hash)
    ) {
      return null;
    }

    if (readDate(row.expires_at).getTime() <= Date.now() || !row.pkce_verifier_sealed) {
      await client.query(
        `
          UPDATE app_auth_oauth_transactions
          SET
            failed_at = COALESCE(failed_at, NOW()),
            pkce_verifier_sealed = ''
          WHERE id = $1
        `,
        [transactionId],
      );
      return null;
    }

    const pkceVerifier = unsealText(row.pkce_verifier_sealed);

    await client.query(
      `
        UPDATE app_auth_oauth_transactions
        SET
          consumed_at = NOW(),
          expires_at = GREATEST(expires_at, NOW() + INTERVAL '5 minutes'),
          pkce_verifier_sealed = ''
        WHERE id = $1
      `,
      [transactionId],
    );

    return {
      flow: row.flow,
      id: row.id,
      mode: row.mode,
      origin: row.origin,
      pkceVerifier,
      returnTo: sanitizeReturnTo(row.return_to),
      subjectEmail: row.subject_email ? normalizeEmail(row.subject_email) : null,
    };
  });
}

export async function failOAuthTransaction(transactionId: string) {
  if (!isTransactionId(transactionId)) {
    return;
  }

  await ensureDbSchema();
  await queryDb(
    `
      UPDATE app_auth_oauth_transactions
      SET
        failed_at = COALESCE(failed_at, NOW()),
        pkce_verifier_sealed = ''
      WHERE id = $1
        AND finalized_at IS NULL
    `,
    [transactionId],
  );
}

export async function finalizeOAuthTransaction(transactionId: string, nonce: string) {
  if (!isTransactionId(transactionId) || !nonce || nonce.length > 256) {
    return false;
  }

  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    const result = await client.query<
      Pick<
        OAuthTransactionRow,
        "consumed_at" | "expires_at" | "failed_at" | "finalized_at" | "nonce_hash"
      >
    >(
      `
        SELECT
          nonce_hash,
          expires_at,
          consumed_at,
          finalized_at,
          failed_at
        FROM app_auth_oauth_transactions
        WHERE id = $1
        FOR UPDATE
      `,
      [transactionId],
    );
    const row = result.rows[0];

    if (
      !row ||
      !row.consumed_at ||
      row.failed_at ||
      row.finalized_at ||
      readDate(row.expires_at).getTime() <= Date.now() ||
      !safelyMatchesOAuthNonce(nonce, row.nonce_hash)
    ) {
      return false;
    }

    await client.query(
      `
        UPDATE app_auth_oauth_transactions
        SET finalized_at = NOW()
        WHERE id = $1
      `,
      [transactionId],
    );

    return true;
  });
}

export async function consumeOAuthSessionHandoff(input: {
  expiresAt: number;
  handoffId: string;
  nonce: string;
  transactionId: string;
}) {
  if (
    !isTransactionId(input.transactionId) ||
    !isTransactionId(input.handoffId) ||
    !input.nonce ||
    input.nonce.length > 256 ||
    !Number.isSafeInteger(input.expiresAt) ||
    input.expiresAt <= Math.floor(Date.now() / 1_000)
  ) {
    return false;
  }

  await ensureDbSchema();

  return withDbTransaction(async (client) => {
    const result = await client.query<
      Pick<
        OAuthTransactionRow,
        "consumed_at" | "expires_at" | "failed_at" | "finalized_at" | "nonce_hash"
      >
    >(
      `
        SELECT
          nonce_hash,
          expires_at,
          consumed_at,
          finalized_at,
          failed_at
        FROM app_auth_oauth_transactions
        WHERE id = $1
        FOR UPDATE
      `,
      [input.transactionId],
    );
    const row = result.rows[0];

    if (
      !row ||
      !row.consumed_at ||
      row.failed_at ||
      row.finalized_at ||
      readDate(row.expires_at).getTime() <= Date.now() ||
      !safelyMatchesOAuthNonce(input.nonce, row.nonce_hash)
    ) {
      return false;
    }

    const handoffResult = await client.query<{ id: string }>(
      `
        INSERT INTO app_auth_consumed_handoffs (id, expires_at)
        VALUES ($1, to_timestamp($2))
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `,
      [input.handoffId, input.expiresAt],
    );

    if (handoffResult.rowCount !== 1) {
      return false;
    }

    await client.query(
      `
        UPDATE app_auth_oauth_transactions
        SET finalized_at = NOW()
        WHERE id = $1
      `,
      [input.transactionId],
    );

    return true;
  });
}
