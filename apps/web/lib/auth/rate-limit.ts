import "server-only";

import { createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import { readClientIp } from "@/lib/auth/origin";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import { ensureDbSchema } from "@/lib/db/schema";

type RateLimitRow = {
  attempt_count: number | string;
  blocked_until: Date | string | null;
  window_started_at: Date | string;
  window_seconds: number | string;
};

type RateLimitRule = {
  blockSeconds: number;
  identifier: string;
  limit: number;
  scope: string;
  windowSeconds: number;
};

export type AuthRateLimitPolicy =
  | "email-start"
  | "email-verify"
  | "finalize"
  | "oauth-callback-github"
  | "oauth-callback-google"
  | "oauth-start-github"
  | "oauth-start-google"
  | "password-sign-up"
  | "password-sign-in";

export type AuthRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function readRateLimitSecret() {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET?.trim();

  if (secret) {
    if (process.env.NODE_ENV === "production" && secret.length < 32) {
      throw new Error(
        "AUTH_RATE_LIMIT_SECRET must contain at least 32 characters in production.",
      );
    }
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_RATE_LIMIT_SECRET is required in production.");
  }

  return "fugue-development-rate-limit-key";
}

export function validateAuthRateLimitConfiguration() {
  readRateLimitSecret();
}

function buildBucketKey(rule: RateLimitRule) {
  const digest = createHmac("sha256", readRateLimitSecret())
    .update(rule.identifier, "utf8")
    .digest("base64url");
  return `${rule.scope}:${digest}`;
}

function readTimestamp(value: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function consumeRule(
  client: PoolClient,
  rule: RateLimitRule,
  now: Date,
): Promise<AuthRateLimitResult> {
  const bucketKey = buildBucketKey(rule);

  await client.query(
    `
      INSERT INTO app_auth_rate_limits (
        bucket_key,
        window_started_at,
        window_seconds,
        attempt_count,
        updated_at
      )
      VALUES ($1, $2, $3, 0, $2)
      ON CONFLICT (bucket_key) DO NOTHING
    `,
    [bucketKey, now.toISOString(), rule.windowSeconds],
  );

  const result = await client.query<RateLimitRow>(
    `
      SELECT
        window_started_at,
        window_seconds,
        attempt_count,
        blocked_until
      FROM app_auth_rate_limits
      WHERE bucket_key = $1
      FOR UPDATE
    `,
    [bucketKey],
  );
  const row = result.rows[0];

  if (!row) {
    throw new Error("Authentication rate-limit row was not created.");
  }

  const blockedUntil = readTimestamp(row.blocked_until);

  if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((blockedUntil.getTime() - now.getTime()) / 1_000),
      ),
    };
  }

  const previousWindow = readTimestamp(row.window_started_at) ?? now;
  const storedWindowSeconds = Number(row.window_seconds);
  const windowExpired =
    storedWindowSeconds !== rule.windowSeconds ||
    previousWindow.getTime() + rule.windowSeconds * 1_000 <= now.getTime();
  const previousCount = windowExpired ? 0 : Number(row.attempt_count);
  const nextCount = previousCount + 1;
  let nextBlockedUntil: Date | null = null;

  if (nextCount > rule.limit) {
    const exponent = Math.min(nextCount - rule.limit - 1, 6);
    nextBlockedUntil = new Date(
      now.getTime() + rule.blockSeconds * 2 ** exponent * 1_000,
    );
  }

  await client.query(
    `
      UPDATE app_auth_rate_limits
      SET
        window_started_at = $2,
        window_seconds = $3,
        attempt_count = $4,
        blocked_until = $5,
        updated_at = $6
      WHERE bucket_key = $1
    `,
    [
      bucketKey,
      (windowExpired ? now : previousWindow).toISOString(),
      rule.windowSeconds,
      nextCount,
      nextBlockedUntil?.toISOString() ?? null,
      now.toISOString(),
    ],
  );

  return {
    allowed: nextBlockedUntil === null,
    retryAfterSeconds: nextBlockedUntil
      ? Math.max(1, Math.ceil((nextBlockedUntil.getTime() - now.getTime()) / 1_000))
      : 0,
  };
}

function createRules(
  request: Request,
  policy: AuthRateLimitPolicy,
  subject?: string,
): RateLimitRule[] {
  const clientIdentifier = readClientIp(request) ?? "unverified-client";
  const subjectIdentifier = subject?.trim().toLowerCase() || "unknown-subject";

  switch (policy) {
    case "email-start":
      return [
        {
          scope: policy,
          identifier: `ip:${clientIdentifier}`,
          limit: 12,
          windowSeconds: 600,
          blockSeconds: 60,
        },
        {
          scope: policy,
          identifier: `email:${subjectIdentifier}`,
          limit: 5,
          windowSeconds: 900,
          blockSeconds: 120,
        },
        {
          scope: "email-provider",
          identifier: "provider:resend",
          limit: 600,
          windowSeconds: 60,
          blockSeconds: 30,
        },
      ];
    case "password-sign-in":
      return [
        {
          scope: policy,
          identifier: `ip:${clientIdentifier}`,
          limit: 30,
          windowSeconds: 600,
          blockSeconds: 30,
        },
        {
          scope: policy,
          identifier: `identity:${clientIdentifier}:${subjectIdentifier}`,
          limit: 8,
          windowSeconds: 900,
          blockSeconds: 60,
        },
      ];
    case "password-sign-up":
      return [
        {
          scope: policy,
          identifier: `ip:${clientIdentifier}`,
          limit: 12,
          windowSeconds: 600,
          blockSeconds: 60,
        },
        {
          scope: policy,
          identifier: `identity:${clientIdentifier}:${subjectIdentifier}`,
          limit: 5,
          windowSeconds: 900,
          blockSeconds: 120,
        },
        {
          scope: "email-provider",
          identifier: "provider:resend",
          limit: 600,
          windowSeconds: 60,
          blockSeconds: 30,
        },
      ];
    case "oauth-start-google":
    case "oauth-start-github":
      return [
        {
          scope: policy,
          identifier: `ip:${clientIdentifier}`,
          limit: 30,
          windowSeconds: 600,
          blockSeconds: 60,
        },
        {
          scope: policy,
          identifier: "provider:global",
          limit: 1_000,
          windowSeconds: 60,
          blockSeconds: 30,
        },
      ];
    case "oauth-callback-google":
    case "oauth-callback-github":
      return [
        {
          scope: policy,
          identifier: `ip:${clientIdentifier}`,
          limit: 60,
          windowSeconds: 600,
          blockSeconds: 60,
        },
        {
          scope: policy,
          identifier: "provider:global",
          limit: 1_500,
          windowSeconds: 60,
          blockSeconds: 30,
        },
      ];
    case "email-verify":
    case "finalize":
      return [
        {
          scope: policy,
          identifier: `ip:${clientIdentifier}`,
          limit: 30,
          windowSeconds: 600,
          blockSeconds: 60,
        },
      ];
  }
}

export async function consumeAuthRateLimit(
  request: Request,
  policy: AuthRateLimitPolicy,
  subject?: string,
): Promise<AuthRateLimitResult> {
  await ensureDbSchema();
  const rules = createRules(request, policy, subject).sort((left, right) =>
    buildBucketKey(left).localeCompare(buildBucketKey(right)),
  );

  const decision = await withDbTransaction(async (client) => {
    let retryAfterSeconds = 0;

    for (const rule of rules) {
      const result = await consumeRule(client, rule, new Date());

      if (!result.allowed) {
        retryAfterSeconds = Math.max(retryAfterSeconds, result.retryAfterSeconds);
      }
    }

    return {
      allowed: retryAfterSeconds === 0,
      retryAfterSeconds,
    };
  });

  try {
    await queryDb(
      `
        WITH expired AS (
          SELECT bucket_key
          FROM app_auth_rate_limits
          WHERE updated_at < NOW() - INTERVAL '7 days'
          ORDER BY updated_at ASC
          LIMIT 200
        )
        DELETE FROM app_auth_rate_limits AS rate_limit
        USING expired
        WHERE rate_limit.bucket_key = expired.bucket_key
      `,
    );
  } catch (error) {
    console.error("Could not clean expired authentication rate-limit buckets.", {
      category: error instanceof Error ? error.name : "unknown",
    });
  }

  return decision;
}

export async function enforceAuthRateLimit(
  request: Request,
  policy: AuthRateLimitPolicy,
  subject?: string,
) {
  try {
    const result = await consumeAuthRateLimit(request, policy, subject);

    if (result.allowed) {
      return null;
    }

    console.warn(
      JSON.stringify({
        event: "fugue_web_auth_rate_limit",
        outcome: "limited",
        policy,
      }),
    );
    return Response.json(
      {
        error: "Too many attempts. Wait before trying again.",
        retryAfter: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(result.retryAfterSeconds),
        },
      },
    );
  } catch (error) {
    console.error("Authentication rate-limit storage unavailable.", {
      category: error instanceof Error ? error.name : "unknown",
      policy,
    });
    return Response.json(
      { error: "Authentication protection is temporarily unavailable. Try again." },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "5",
        },
      },
    );
  }
}
