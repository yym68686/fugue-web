import "server-only";

import { NextResponse } from "next/server";

import {
  getFugueBillingSummary,
  getFugueProjectImageUsage,
  topUpFugueBilling,
  updateFugueBilling,
  type FugueBillingSummary,
  type FugueResourceSpec,
} from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import { getWorkspaceAccessByEmail } from "@/lib/workspace/store";
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
import { normalizeEmail } from "@/lib/auth/validation";

export type BillingPageData = {
  billing: FugueBillingSummary | null;
  imageStorageBytes: number | null;
  syncError: string | null;
  workspace: {
    tenantId: string;
    tenantName: string;
  };
};

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

const MIN_BILLING_TOP_UP_UNITS = 5;
const MAX_BILLING_TOP_UP_UNITS = 5000;

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed.";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStatusError(status: number, message: string) {
  return new Error(`${status} ${message}`);
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

async function requireWorkspaceAccess(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    throw new Error("409 Create a workspace first.");
  }

  return workspace;
}

function sumProjectImageStorageBytes(
  imageUsage: Awaited<ReturnType<typeof getFugueProjectImageUsage>>,
) {
  return (imageUsage.projects ?? []).reduce(
    (total, project) => total + Math.max(project.totalSizeBytes, 0),
    0,
  );
}

export async function getBillingPageData(email: string) {
  const workspace = await getWorkspaceAccessByEmail(email);

  if (!workspace) {
    return null;
  }

  const [billingResult, imageUsageResult] = await Promise.allSettled([
    getFugueBillingSummary(workspace.adminKeySecret),
    getFugueProjectImageUsage(workspace.adminKeySecret),
  ]);

  if (billingResult.status === "rejected") {
    return {
      billing: null,
      imageStorageBytes: null,
      syncError: readErrorMessage(billingResult.reason),
      workspace: {
        tenantId: workspace.tenantId,
        tenantName: workspace.tenantName,
      },
    } satisfies BillingPageData;
  }

  return {
    billing: billingResult.value,
    imageStorageBytes:
      imageUsageResult.status === "fulfilled"
        ? sumProjectImageStorageBytes(imageUsageResult.value)
        : null,
    syncError:
      imageUsageResult.status === "rejected"
        ? "Image storage usage could not be refreshed right now."
        : null,
    workspace: {
      tenantId: workspace.tenantId,
      tenantName: workspace.tenantName,
    },
  } satisfies BillingPageData;
}

export async function updateBillingForEmail(
  email: string,
  payload: {
    managedCap: FugueResourceSpec;
  },
) {
  const workspace = await requireWorkspaceAccess(email);
  const storageGibibytes =
    payload.managedCap.storageGibibytes ??
    (await getFugueBillingSummary(workspace.adminKeySecret)).managedCap.storageGibibytes;

  return updateFugueBilling(workspace.adminKeySecret, {
    managedCap: {
      ...payload.managedCap,
      storageGibibytes,
    },
  });
}

export async function topUpBillingForEmail(
  email: string,
  payload: {
    amountCents: number;
    note?: string;
  },
) {
  const workspace = await requireWorkspaceAccess(email);

  return topUpFugueBilling(workspace.adminKeySecret, {
    amountCents: payload.amountCents,
    note: payload.note,
  });
}

export async function topUpBillingForTenant(
  tenantId: string,
  payload: {
    amountCents: number;
    note?: string;
  },
) {
  return topUpFugueBilling(getFugueEnv().bootstrapKey, {
    amountCents: payload.amountCents,
    note: payload.note,
    tenantId,
  });
}

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
  const successUrl = `${creemEnv.appPublicUrl}/app/billing?request_id=${encodeURIComponent(
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
    await topUpBillingForTenant(claim.topup.tenantId, {
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
