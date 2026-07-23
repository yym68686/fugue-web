import "server-only";

/**
 * Platform-admin backend calls used only during workspace provisioning.
 *
 * Unlike lib/fugue/console.ts (which acts on behalf of a tenant using that
 * tenant's scoped admin key), these calls use the server-only
 * FUGUE_BOOTSTRAP_KEY (platform.admin) to create a tenant and mint that
 * tenant's admin key. The bootstrap key never leaves the server.
 */

export type FugueTenant = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type FugueApiKey = {
  id: string;
  tenantId: string;
  label: string;
  prefix: string;
  status?: string;
  scopes: string[];
};

class FugueAdminError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(`${status} ${message}`);
    this.name = "FugueAdminError";
    this.status = status;
  }
}

function readApiBaseUrl(): string {
  const raw = process.env.FUGUE_API_URL?.trim();
  if (!raw) {
    throw new Error("Missing FUGUE_API_URL. Configure the fugue backend URL.");
  }
  return raw.replace(/\/+$/, "");
}

function readBootstrapKey(): string {
  const raw = process.env.FUGUE_BOOTSTRAP_KEY?.trim();
  if (!raw) {
    throw new Error(
      "Missing FUGUE_BOOTSTRAP_KEY. Workspace provisioning requires the bootstrap key.",
    );
  }
  return raw;
}

async function adminSend<T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${readApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${readBootstrapKey()}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = response.statusText || "request failed";
    try {
      const text = await response.text();
      if (text) {
        const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
        const message = parsed.error ?? parsed.message;
        if (typeof message === "string" && message.trim()) {
          detail = message.trim();
        } else {
          detail = text.slice(0, 200);
        }
      }
    } catch {
      // keep the statusText fallback
    }
    throw new FugueAdminError(response.status, detail);
  }

  if (response.status === 204) {
    return {} as T;
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

type RawTenant = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type RawApiKey = {
  id?: unknown;
  tenant_id?: unknown;
  label?: unknown;
  prefix?: unknown;
  status?: unknown;
  scopes?: unknown;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapTenant(raw: RawTenant): FugueTenant {
  return {
    id: str(raw.id),
    name: str(raw.name),
    slug: str(raw.slug),
    status: optStr(raw.status) ?? undefined,
    createdAt: optStr(raw.created_at),
    updatedAt: optStr(raw.updated_at),
  };
}

function mapApiKey(raw: RawApiKey): FugueApiKey {
  return {
    id: str(raw.id),
    tenantId: str(raw.tenant_id),
    label: str(raw.label),
    prefix: str(raw.prefix),
    status: optStr(raw.status) ?? undefined,
    scopes: strArray(raw.scopes),
  };
}

/** List every tenant visible to the platform-admin bootstrap key. */
export async function listFugueTenants(): Promise<FugueTenant[]> {
  const data = await adminSend<{ tenants?: RawTenant[] }>("GET", "/v1/tenants");
  return Array.isArray(data.tenants) ? data.tenants.map(mapTenant) : [];
}

/** Create a new tenant. Returns the created tenant. */
export async function createFugueTenant(name: string): Promise<FugueTenant> {
  const data = await adminSend<{ tenant?: RawTenant }>("POST", "/v1/tenants", {
    name,
  });
  if (!data.tenant?.id) {
    throw new Error("Tenant creation returned no tenant id.");
  }
  return mapTenant(data.tenant);
}

/** List every api key visible to the bootstrap key. */
export async function listFugueApiKeys(): Promise<FugueApiKey[]> {
  const data = await adminSend<{ api_keys?: RawApiKey[] }>("GET", "/v1/api-keys");
  return Array.isArray(data.api_keys) ? data.api_keys.map(mapApiKey) : [];
}

/** Mint a new api key for a tenant. Returns the key metadata and its secret. */
export async function createFugueApiKey(input: {
  tenantId: string;
  label: string;
  scopes: readonly string[];
}): Promise<{ apiKey: FugueApiKey; secret: string }> {
  const data = await adminSend<{ api_key?: RawApiKey; secret?: unknown }>(
    "POST",
    "/v1/api-keys",
    {
      tenant_id: input.tenantId,
      label: input.label,
      scopes: [...input.scopes],
    },
  );
  const secret = str(data.secret);
  if (!data.api_key?.id || !secret) {
    throw new Error("Api key creation returned no secret.");
  }
  return { apiKey: mapApiKey(data.api_key), secret };
}

/** Re-enable a disabled api key. Returns the updated key. */
export async function enableFugueApiKey(id: string): Promise<FugueApiKey> {
  const data = await adminSend<{ api_key?: RawApiKey }>(
    "POST",
    `/v1/api-keys/${encodeURIComponent(id)}/enable`,
  );
  if (!data.api_key?.id) {
    throw new Error("Enabling api key returned no key.");
  }
  return mapApiKey(data.api_key);
}

export function readAdminErrorStatus(error: unknown): number | null {
  return error instanceof FugueAdminError ? error.status : null;
}

