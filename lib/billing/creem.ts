import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getAuthEnv } from "@/lib/auth/env";

type CreemObject = Record<string, unknown>;

export type CreemEnv = {
  apiBaseUrl: string;
  apiKey: string;
  appPublicUrl: string;
  productId: string;
  webhookSecret: string;
};

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function normalizePublicUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function readConfiguredValue(name: string) {
  const value = readOptionalEnv(name);

  if (!value) {
    throw new Error(`503 Missing billing environment variable: ${name}.`);
  }

  return value;
}

function readCreemBaseUrl(apiKey: string) {
  return apiKey.startsWith("creem_test_")
    ? "https://test-api.creem.io"
    : "https://api.creem.io";
}

export function getCreemEnv(): CreemEnv {
  const apiKey = readConfiguredValue("CREEM_API_KEY");
  const appPublicUrl = normalizePublicUrl(
    readOptionalEnv("APP_PUBLIC_URL") ?? getAuthEnv().appBaseUrl,
  );

  return {
    apiBaseUrl: readCreemBaseUrl(apiKey),
    apiKey,
    appPublicUrl,
    productId: readConfiguredValue("CREEM_PRODUCT_ID"),
    webhookSecret: readConfiguredValue("CREEM_WEBHOOK_SECRET"),
  };
}

export function verifyCreemSignature(rawBody: Uint8Array, signature: string) {
  const normalizedSignature = signature.trim().toLowerCase();

  if (!normalizedSignature) {
    return false;
  }

  const digest = createHmac("sha256", getCreemEnv().webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (digest.length !== normalizedSignature.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(normalizedSignature, "utf8"),
    );
  } catch {
    return false;
  }
}

function asObject(value: unknown): CreemObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CreemObject)
    : null;
}

function readNestedString(source: CreemObject | null, key: string) {
  if (!source) {
    return null;
  }

  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractCreemCurrency(object: CreemObject) {
  const order = asObject(object.order);
  const transaction = asObject(object.transaction);
  const product = asObject(object.product);

  const rawValue =
    readNestedString(order, "currency") ??
    readNestedString(transaction, "currency") ??
    readNestedString(product, "currency");

  return rawValue ? rawValue.toUpperCase().slice(0, 8) : null;
}

export function extractCreemProductId(object: CreemObject) {
  const order = asObject(object.order);
  const product = object.product;

  const orderProduct = readNestedString(order, "product");

  if (orderProduct) {
    return orderProduct;
  }

  if (typeof product === "string" && product.trim()) {
    return product.trim();
  }

  const productObject = asObject(product);
  return readNestedString(productObject, "id");
}

function parseInteger(value: unknown) {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value)
  ) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function extractCreemAmountTotalCents(object: CreemObject) {
  const transaction = asObject(object.transaction);
  const order = asObject(object.order);

  return (
    parseInteger(object.amount_total) ??
    parseInteger(transaction?.amount_paid) ??
    parseInteger(order?.amount_paid)
  );
}

export function extractCreemPayerEmail(object: CreemObject) {
  const customer = asObject(object.customer);
  const order = asObject(object.order);
  const transaction = asObject(object.transaction);
  const orderCustomer = asObject(order?.customer);

  const rawValue =
    readNestedString(customer, "email") ??
    readNestedString(order, "customer_email") ??
    readNestedString(order, "email") ??
    readNestedString(orderCustomer, "email") ??
    readNestedString(transaction, "customer_email");

  return rawValue ? rawValue.toLowerCase().slice(0, 254) : null;
}

