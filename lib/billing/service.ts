import "server-only";

import { NextResponse } from "next/server";

import { normalizeEmail } from "@/lib/auth/validation";
import {
  extractCreemAmountTotalCents,
  extractCreemCurrency,
  extractCreemPayerEmail,
  extractCreemProductId,
  getCreemEnv,
  verifyCreemSignature,
} from "@/lib/billing/creem";
import {
  claimBillingTopupForCompletion,
  completeBillingTopup,
  createBillingTopup,
  creemEventExists,
  getBillingTopupForUser,
  markBillingTopupFailed,
  recordCreemEvent,
  releaseBillingTopupClaim,
  type BillingTopupRecord,
} from "@/lib/billing/topup-store";
import { topUpTenantBilling } from "@/lib/fugue/console";
import { getCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";

export type BillingTopupCheckout = {
  checkoutUrl: string;
  requestId: string;
};

export type BillingTopupStatusView = {
  amountCents: number;
  requestId: string;
  status: string;
  units: number;
};

// A top-up is denominated in whole USD "units" (1 unit = $1 = 100 cents). Bound
// the range so a fat-fingered amount can't open a $0 or $1M checkout.
const MIN_BILLING_TOP_UP_UNITS = 5;
const MAX_BILLING_TOP_UP_UNITS = 5000;

function readStatusError(status: number, message: string) {
  // Errors carry their HTTP status inline (`4xx ...`) so the route layer's
  // readErrorStatus can recover it — matching the convention used elsewhere.
  return new Error(`${status} ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readWholeDollarUnits(value: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw readStatusError(400, "amountUsd must be a whole USD amount.");
  }

  if (value < MIN_BILLING_TOP_UP_UNITS || value > MAX_BILLING_TOP_UP_UNITS) {
    throw readStatusError(
      400,
      `amountUsd must be between ${MIN_BILLING_TOP_UP_UNITS} and ${MAX_BILLING_TOP_UP_UNITS}.`,
    );
  }

  return value;
}

function readCheckoutUrl(payload: unknown) {
  if (!isObject(payload)) {
    return null;
  }

  const rawValue = payload.checkout_url;
  return typeof rawValue === "string" && rawValue.trim()
    ? rawValue.trim()
    : null;
}

function readCreemMetadata(payload: unknown) {
  if (!isObject(payload)) {
    return null;
  }

  return isObject(payload.metadata) ? payload.metadata : null;
}

async function requireWorkspaceAccess(email: string) {
  const workspace = await getCachedWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw readStatusError(409, "Create a workspace first.");
  }

  return workspace;
}

async function createCreemCheckout(payload: {
  customerEmail: string;
  requestId: string;
  successUrl: string;
  tenantId: string;
  units: number;
  userEmail: string;
}) {
  const creemEnv = getCreemEnv();

  let response: Response;

  try {
    response = await fetch(`${creemEnv.apiBaseUrl}/v1/checkouts`, {
      body: JSON.stringify({
        customer: {
          email: payload.customerEmail,
        },
        metadata: {
          purpose: "top_up",
          tenantId: payload.tenantId,
          units: payload.units,
          userEmail: payload.userEmail,
        },
        product_id: creemEnv.productId,
        request_id: payload.requestId,
        success_url: payload.successUrl,
        units: payload.units,
      }),
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        "x-api-key": creemEnv.apiKey,
      },
      method: "POST",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw readStatusError(502, "Payment provider error.");
  }

  if (!response.ok) {
    throw readStatusError(502, "Payment provider error.");
  }

  const payloadJson = await response.json().catch(() => null);
  const checkoutUrl = readCheckoutUrl(payloadJson);

  if (!checkoutUrl) {
    throw readStatusError(502, "Payment provider error.");
  }

  return {
    checkoutUrl,
    productId: creemEnv.productId,
  };
}

/**
 * Open a Creem checkout for a whole-dollar credit top-up.
 *
 * A `pending` top-up row is recorded first so the eventual webhook can be
 * reconciled by request_id; if the provider call fails, the row is flipped to
 * `failed` before the error propagates. The returned checkout URL is where the
 * browser is sent to pay.
 */
export async function createBillingTopupCheckoutForEmail(
  email: string,
  payload: {
    amountUsd: number;
  },
): Promise<BillingTopupCheckout> {
  const workspace = await requireWorkspaceAccess(email);
  const normalizedEmail = normalizeEmail(email);
  const units = readWholeDollarUnits(payload.amountUsd);
  const amountCents = units * 100;
  const creemEnv = getCreemEnv();
  const topup = await createBillingTopup({
    amountCents,
    productId: creemEnv.productId,
    tenantId: workspace.tenantId,
    units,
    userEmail: normalizedEmail,
  });
  const successUrl = `${creemEnv.appPublicUrl}/billing?request_id=${encodeURIComponent(
    topup.requestId,
  )}`;

  try {
    const checkout = await createCreemCheckout({
      customerEmail: normalizedEmail,
      requestId: topup.requestId,
      successUrl,
      tenantId: workspace.tenantId,
      units,
      userEmail: normalizedEmail,
    });

    return {
      checkoutUrl: checkout.checkoutUrl,
      requestId: topup.requestId,
    };
  } catch (error) {
    await markBillingTopupFailed(topup.requestId, {
      productId: creemEnv.productId,
    });
    throw error;
  }
}

export async function getBillingTopupStatusForEmail(
  email: string,
  requestId: string,
): Promise<BillingTopupStatusView> {
  const topup = await getBillingTopupForUser(email, requestId);

  if (!topup) {
    throw readStatusError(404, "Top-up request not found.");
  }

  return {
    amountCents: topup.amountCents,
    requestId: topup.requestId,
    status: topup.status,
    units: topup.units,
  };
}

function readCreemRequestId(object: Record<string, unknown>) {
  return typeof object.request_id === "string" && object.request_id.trim()
    ? object.request_id.trim()
    : null;
}

function readCreemEventMetadata(object: Record<string, unknown>) {
  const metadata = readCreemMetadata(object);

  if (!metadata) {
    return {
      purpose: null,
      tenantId: null,
      userEmail: null,
    };
  }

  return {
    purpose:
      typeof metadata.purpose === "string" && metadata.purpose.trim()
        ? metadata.purpose.trim()
        : null,
    tenantId:
      typeof metadata.tenantId === "string" && metadata.tenantId.trim()
        ? metadata.tenantId.trim()
        : null,
    userEmail:
      typeof metadata.userEmail === "string" && metadata.userEmail.trim()
        ? normalizeEmail(metadata.userEmail)
        : null,
  };
}

function readCreemOrderId(object: Record<string, unknown>) {
  if (!isObject(object.order)) {
    return null;
  }

  return typeof object.order.id === "string" && object.order.id.trim()
    ? object.order.id.trim()
    : null;
}

function readCreemCheckoutId(object: Record<string, unknown>) {
  return typeof object.id === "string" && object.id.trim() ? object.id.trim() : null;
}

function buildTopupNote(topup: BillingTopupRecord) {
  const fragments = ["Creem credits top-up"];

  if (topup.checkoutId) {
    fragments.push(`checkout=${topup.checkoutId}`);
  }

  if (topup.orderId) {
    fragments.push(`order=${topup.orderId}`);
  }

  fragments.push(`request=${topup.requestId}`);

  return fragments.join(" | ");
}

/**
 * Handle a Creem webhook delivery.
 *
 * The flow is: verify the HMAC signature → dedupe by event id → for a
 * `checkout.completed` top-up, validate product/currency/amount, then
 * atomically claim the pending row, credit the tenant's prepaid balance via the
 * platform bootstrap key, and mark the row completed. Every branch records the
 * event so replays are idempotent, and the tenant credit is bracketed by a
 * claim/release so a backend failure can't leave a row wedged in `processing`.
 * Always answers 200 for terminal outcomes so Creem stops retrying.
 */
export async function processCreemWebhookRequest(
  request: Request,
): Promise<NextResponse> {
  const signature = request.headers.get("creem-signature")?.trim() ?? "";

  if (!signature) {
    throw readStatusError(401, "Missing signature.");
  }

  const rawBody = new Uint8Array(await request.arrayBuffer());

  if (!verifyCreemSignature(rawBody, signature)) {
    throw readStatusError(401, "Invalid signature.");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(Buffer.from(rawBody).toString("utf8")) as unknown;
  } catch {
    throw readStatusError(400, "Invalid JSON payload.");
  }

  if (!isObject(payload)) {
    throw readStatusError(400, "Invalid JSON payload.");
  }

  const eventId =
    typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : null;
  const eventType =
    typeof payload.eventType === "string" && payload.eventType.trim()
      ? payload.eventType.trim()
      : null;

  if (!eventId) {
    throw readStatusError(400, "Missing event id.");
  }

  if (!eventType) {
    throw readStatusError(400, "Missing event type.");
  }

  if (await creemEventExists(eventId)) {
    return NextResponse.json({ ok: true });
  }

  const object = isObject(payload.object) ? payload.object : null;

  if (!object) {
    await recordCreemEvent({
      creemEventId: eventId,
      eventType,
      rawPayload: payload,
      status: "failed",
    });

    return NextResponse.json({ ok: true });
  }

  const requestId = readCreemRequestId(object);
  const checkoutId = readCreemCheckoutId(object);
  const orderId = readCreemOrderId(object);
  const currency = extractCreemCurrency(object);
  const productId = extractCreemProductId(object);
  const amountCents = extractCreemAmountTotalCents(object);
  const payerEmail = extractCreemPayerEmail(object);
  const metadata = readCreemEventMetadata(object);
  const normalizedEventType = eventType.toLowerCase();

  if (normalizedEventType !== "checkout.completed") {
    await recordCreemEvent({
      amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      requestId,
      status: "processed",
      tenantId: metadata.tenantId,
      userEmail: metadata.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  if (!requestId) {
    await recordCreemEvent({
      amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      status: "failed",
      tenantId: metadata.tenantId,
      userEmail: metadata.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  if (metadata.purpose !== "top_up") {
    await recordCreemEvent({
      amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      requestId,
      status: "processed",
      tenantId: metadata.tenantId,
      userEmail: metadata.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  const creemEnv = getCreemEnv();

  if (!productId || productId !== creemEnv.productId) {
    await markBillingTopupFailed(requestId, {
      checkoutId,
      currency,
      orderId,
      payerEmail,
      productId,
    });
    await recordCreemEvent({
      amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      requestId,
      status: "failed",
      tenantId: metadata.tenantId,
      userEmail: metadata.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  if (currency !== "USD") {
    await markBillingTopupFailed(requestId, {
      checkoutId,
      currency,
      orderId,
      payerEmail,
      productId,
    });
    await recordCreemEvent({
      amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      requestId,
      status: "failed",
      tenantId: metadata.tenantId,
      userEmail: metadata.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  const claim = await claimBillingTopupForCompletion(requestId, {
    checkoutId,
    currency,
    orderId,
    payerEmail,
    productId,
  });

  if (claim.state === "missing") {
    await recordCreemEvent({
      amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      requestId,
      status: "failed",
      tenantId: metadata.tenantId,
      userEmail: metadata.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  if (claim.state === "completed") {
    await recordCreemEvent({
      amountCents: claim.topup.amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      requestId,
      status: "processed",
      tenantId: claim.topup.tenantId,
      userEmail: claim.topup.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  if (claim.state === "failed") {
    await recordCreemEvent({
      amountCents: claim.topup.amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      requestId,
      status: "failed",
      tenantId: claim.topup.tenantId,
      userEmail: claim.topup.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  if (claim.state === "processing") {
    // Another delivery already holds the claim — tell Creem to retry later
    // rather than double-crediting.
    throw readStatusError(409, "Top-up is already being processed.");
  }

  if (amountCents !== null && amountCents !== claim.topup.amountCents) {
    await markBillingTopupFailed(requestId, {
      checkoutId,
      currency,
      orderId,
      payerEmail,
      productId,
    });
    await recordCreemEvent({
      amountCents,
      creemEventId: eventId,
      currency,
      eventType,
      rawPayload: payload,
      requestId,
      status: "failed",
      tenantId: claim.topup.tenantId,
      userEmail: claim.topup.userEmail,
    });

    return NextResponse.json({ ok: true });
  }

  try {
    await topUpTenantBilling(claim.topup.tenantId, {
      amountCents: claim.topup.amountCents,
      note: buildTopupNote({
        ...claim.topup,
        checkoutId: checkoutId ?? claim.topup.checkoutId,
        orderId: orderId ?? claim.topup.orderId,
      }),
    });
  } catch (error) {
    await releaseBillingTopupClaim(requestId, {
      checkoutId,
      currency,
      orderId,
      payerEmail,
      productId,
    });
    throw error;
  }

  const completed = await completeBillingTopup(requestId, {
    checkoutId,
    currency,
    orderId,
    payerEmail,
    productId,
  });

  await recordCreemEvent({
    amountCents: completed?.amountCents ?? claim.topup.amountCents,
    creemEventId: eventId,
    currency,
    eventType,
    rawPayload: payload,
    requestId,
    status: "processed",
    tenantId: completed?.tenantId ?? claim.topup.tenantId,
    userEmail: completed?.userEmail ?? claim.topup.userEmail,
  });

  return NextResponse.json({ ok: true });
}
