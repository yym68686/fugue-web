import "server-only";

import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import { normalizeEmail } from "@/lib/auth/validation";
import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb, withDbTransaction } from "@/lib/db/pool";

export type BillingTopupStatus = "pending" | "processing" | "completed" | "failed";

type BillingTopupRow = {
  amount_cents: number;
  checkout_id: string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  currency: string | null;
  failed_at: Date | string | null;
  order_id: string | null;
  payer_email: string | null;
  product_id: string | null;
  provider: string;
  request_id: string;
  status: BillingTopupStatus;
  tenant_id: string;
  units: number;
  updated_at: Date | string;
  user_email: string;
};

export type BillingTopupRecord = {
  amountCents: number;
  checkoutId: string | null;
  completedAt: string | null;
  createdAt: string;
  currency: string | null;
  failedAt: string | null;
  orderId: string | null;
  payerEmail: string | null;
  productId: string | null;
  provider: string;
  requestId: string;
  status: BillingTopupStatus;
  tenantId: string;
  units: number;
  updatedAt: string;
  userEmail: string;
};

type CreemEventRow = {
  created_at: Date | string;
  creem_event_id: string;
};

export type BillingTopupClaim =
  | { state: "claimed"; topup: BillingTopupRecord }
  | { state: "completed"; topup: BillingTopupRecord }
  | { state: "failed"; topup: BillingTopupRecord }
  | { state: "processing"; topup: BillingTopupRecord }
  | { state: "missing"; topup: null };

function readTimestamp(value: Date | string | null) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function toTopupRecord(row: BillingTopupRow): BillingTopupRecord {
  return {
    amountCents: row.amount_cents,
    checkoutId: row.checkout_id,
    completedAt: readTimestamp(row.completed_at),
    createdAt: readTimestamp(row.created_at) ?? new Date().toISOString(),
    currency: row.currency,
    failedAt: readTimestamp(row.failed_at),
    orderId: row.order_id,
    payerEmail: row.payer_email,
    productId: row.product_id,
    provider: row.provider,
    requestId: row.request_id,
    status: row.status,
    tenantId: row.tenant_id,
    units: row.units,
    updatedAt: readTimestamp(row.updated_at) ?? new Date().toISOString(),
    userEmail: normalizeEmail(row.user_email),
  };
}

function buildTopupUpdateArgs(payload: {
  checkoutId?: string | null;
  currency?: string | null;
  orderId?: string | null;
  payerEmail?: string | null;
  productId?: string | null;
}) {
  return {
    checkoutId: payload.checkoutId?.trim() || null,
    currency: payload.currency?.trim().toUpperCase().slice(0, 8) || null,
    orderId: payload.orderId?.trim() || null,
    payerEmail: payload.payerEmail?.trim().toLowerCase().slice(0, 254) || null,
    productId: payload.productId?.trim() || null,
  };
}

async function getBillingTopupRowForUpdate(
  client: PoolClient,
  requestId: string,
) {
  const result = await client.query<BillingTopupRow>(
    `
      SELECT
        request_id,
        provider,
        user_email,
        tenant_id,
        product_id,
        units,
        amount_cents,
        status,
        checkout_id,
        order_id,
        currency,
        payer_email,
        completed_at,
        failed_at,
        created_at,
        updated_at
      FROM app_billing_topups
      WHERE request_id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [requestId.trim()],
  );

  return result.rows[0] ?? null;
}

export function generateBillingTopupRequestId() {
  return `topup_${randomUUID().replace(/-/g, "")}`;
}

export async function createBillingTopup(payload: {
  amountCents: number;
  productId: string;
  requestId?: string;
  tenantId: string;
  units: number;
  userEmail: string;
}) {
  await ensureDbSchema();

  const requestId = payload.requestId?.trim() || generateBillingTopupRequestId();
  const result = await queryDb<BillingTopupRow>(
    `
      INSERT INTO app_billing_topups (
        request_id,
        provider,
        user_email,
        tenant_id,
        product_id,
        units,
        amount_cents,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, 'creem', $2, $3, $4, $5, $6, 'pending', NOW(), NOW())
      RETURNING
        request_id,
        provider,
        user_email,
        tenant_id,
        product_id,
        units,
        amount_cents,
        status,
        checkout_id,
        order_id,
        currency,
        payer_email,
        completed_at,
        failed_at,
        created_at,
        updated_at
    `,
    [
      requestId,
      normalizeEmail(payload.userEmail),
      payload.tenantId.trim(),
      payload.productId.trim(),
      payload.units,
      payload.amountCents,
    ],
  );

  return toTopupRecord(result.rows[0]);
}

export async function getBillingTopupForUser(
  userEmail: string,
  requestId: string,
) {
  await ensureDbSchema();

  const result = await queryDb<BillingTopupRow>(
    `
      SELECT
        request_id,
        provider,
        user_email,
        tenant_id,
        product_id,
        units,
        amount_cents,
        status,
        checkout_id,
        order_id,
        currency,
        payer_email,
        completed_at,
        failed_at,
        created_at,
        updated_at
      FROM app_billing_topups
      WHERE user_email = $1
        AND request_id = $2
      LIMIT 1
    `,
    [normalizeEmail(userEmail), requestId.trim()],
  );

  return result.rows[0] ? toTopupRecord(result.rows[0]) : null;
}

export async function markBillingTopupFailed(
  requestId: string,
  payload?: {
    checkoutId?: string | null;
    currency?: string | null;
    orderId?: string | null;
    payerEmail?: string | null;
    productId?: string | null;
  },
) {
  await ensureDbSchema();

  const next = buildTopupUpdateArgs(payload ?? {});
  const result = await queryDb<BillingTopupRow>(
    `
      UPDATE app_billing_topups
      SET
        status = 'failed',
        checkout_id = COALESCE($2, checkout_id),
        order_id = COALESCE($3, order_id),
        currency = COALESCE($4, currency),
        payer_email = COALESCE($5, payer_email),
        product_id = COALESCE($6, product_id),
        failed_at = COALESCE(failed_at, NOW()),
        updated_at = NOW()
      WHERE request_id = $1
        AND status <> 'completed'
      RETURNING
        request_id,
        provider,
        user_email,
        tenant_id,
        product_id,
        units,
        amount_cents,
        status,
        checkout_id,
        order_id,
        currency,
        payer_email,
        completed_at,
        failed_at,
        created_at,
        updated_at
    `,
    [
      requestId.trim(),
      next.checkoutId,
      next.orderId,
      next.currency,
      next.payerEmail,
      next.productId,
    ],
  );

  return result.rows[0] ? toTopupRecord(result.rows[0]) : null;
}

export async function claimBillingTopupForCompletion(
  requestId: string,
  payload?: {
    checkoutId?: string | null;
    currency?: string | null;
    orderId?: string | null;
    payerEmail?: string | null;
    productId?: string | null;
  },
): Promise<BillingTopupClaim> {
  await ensureDbSchema();

  const next = buildTopupUpdateArgs(payload ?? {});

  return withDbTransaction(async (client) => {
    const row = await getBillingTopupRowForUpdate(client, requestId);

    if (!row) {
      return { state: "missing", topup: null };
    }

    const current = toTopupRecord(row);

    if (row.status === "completed") {
      return { state: "completed", topup: current };
    }

    if (row.status === "failed") {
      return { state: "failed", topup: current };
    }

    if (row.status === "processing") {
      return { state: "processing", topup: current };
    }

    const result = await client.query<BillingTopupRow>(
      `
        UPDATE app_billing_topups
        SET
          status = 'processing',
          checkout_id = COALESCE($2, checkout_id),
          order_id = COALESCE($3, order_id),
          currency = COALESCE($4, currency),
          payer_email = COALESCE($5, payer_email),
          product_id = COALESCE($6, product_id),
          updated_at = NOW()
        WHERE request_id = $1
        RETURNING
          request_id,
          provider,
          user_email,
          tenant_id,
          product_id,
          units,
          amount_cents,
          status,
          checkout_id,
          order_id,
          currency,
          payer_email,
          completed_at,
          failed_at,
          created_at,
          updated_at
      `,
      [
        requestId.trim(),
        next.checkoutId,
        next.orderId,
        next.currency,
        next.payerEmail,
        next.productId,
      ],
    );

    return {
      state: "claimed",
      topup: toTopupRecord(result.rows[0]),
    };
  });
}

export async function releaseBillingTopupClaim(
  requestId: string,
  payload?: {
    checkoutId?: string | null;
    currency?: string | null;
    orderId?: string | null;
    payerEmail?: string | null;
    productId?: string | null;
  },
) {
  await ensureDbSchema();

  const next = buildTopupUpdateArgs(payload ?? {});
  const result = await queryDb<BillingTopupRow>(
    `
      UPDATE app_billing_topups
      SET
        status = 'pending',
        checkout_id = COALESCE($2, checkout_id),
        order_id = COALESCE($3, order_id),
        currency = COALESCE($4, currency),
        payer_email = COALESCE($5, payer_email),
        product_id = COALESCE($6, product_id),
        updated_at = NOW()
      WHERE request_id = $1
        AND status = 'processing'
      RETURNING
        request_id,
        provider,
        user_email,
        tenant_id,
        product_id,
        units,
        amount_cents,
        status,
        checkout_id,
        order_id,
        currency,
        payer_email,
        completed_at,
        failed_at,
        created_at,
        updated_at
    `,
    [
      requestId.trim(),
      next.checkoutId,
      next.orderId,
      next.currency,
      next.payerEmail,
      next.productId,
    ],
  );

  return result.rows[0] ? toTopupRecord(result.rows[0]) : null;
}

export async function completeBillingTopup(
  requestId: string,
  payload?: {
    checkoutId?: string | null;
    currency?: string | null;
    orderId?: string | null;
    payerEmail?: string | null;
    productId?: string | null;
  },
) {
  await ensureDbSchema();

  const next = buildTopupUpdateArgs(payload ?? {});
  const result = await queryDb<BillingTopupRow>(
    `
      UPDATE app_billing_topups
      SET
        status = 'completed',
        checkout_id = COALESCE($2, checkout_id),
        order_id = COALESCE($3, order_id),
        currency = COALESCE($4, currency),
        payer_email = COALESCE($5, payer_email),
        product_id = COALESCE($6, product_id),
        completed_at = COALESCE(completed_at, NOW()),
        failed_at = NULL,
        updated_at = NOW()
      WHERE request_id = $1
      RETURNING
        request_id,
        provider,
        user_email,
        tenant_id,
        product_id,
        units,
        amount_cents,
        status,
        checkout_id,
        order_id,
        currency,
        payer_email,
        completed_at,
        failed_at,
        created_at,
        updated_at
    `,
    [
      requestId.trim(),
      next.checkoutId,
      next.orderId,
      next.currency,
      next.payerEmail,
      next.productId,
    ],
  );

  return result.rows[0] ? toTopupRecord(result.rows[0]) : null;
}

export async function creemEventExists(creemEventId: string) {
  await ensureDbSchema();

  const result = await queryDb<CreemEventRow>(
    `
      SELECT creem_event_id, created_at
      FROM app_creem_events
      WHERE creem_event_id = $1
      LIMIT 1
    `,
    [creemEventId.trim()],
  );

  return result.rows.length > 0;
}

export async function recordCreemEvent(payload: {
  amountCents?: number | null;
  creemEventId: string;
  currency?: string | null;
  eventType: string;
  rawPayload: unknown;
  requestId?: string | null;
  status: string;
  tenantId?: string | null;
  userEmail?: string | null;
}) {
  await ensureDbSchema();

  const result = await queryDb(
    `
      INSERT INTO app_creem_events (
        creem_event_id,
        event_type,
        status,
        request_id,
        user_email,
        tenant_id,
        amount_cents,
        currency,
        raw_payload,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::jsonb,
        NOW()
      )
      ON CONFLICT (creem_event_id) DO NOTHING
    `,
    [
      payload.creemEventId.trim().slice(0, 128),
      payload.eventType.trim().slice(0, 128),
      payload.status.trim().slice(0, 32),
      payload.requestId?.trim() || null,
      payload.userEmail ? normalizeEmail(payload.userEmail) : null,
      payload.tenantId?.trim() || null,
      payload.amountCents ?? null,
      payload.currency?.trim().toUpperCase().slice(0, 8) || null,
      JSON.stringify(payload.rawPayload ?? {}),
    ],
  );

  return (result.rowCount ?? 0) > 0;
}
