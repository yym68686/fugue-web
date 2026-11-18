import type { ObjectStorageConfigWrite } from "@/lib/fugue/console";

export function parseObjectStorageSettings(input: unknown): ObjectStorageConfigWrite | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const values = input as Record<string, unknown>;
  if (Object.keys(values).length !== 3) return null;
  if (values.provider === "cloudflare-r2" &&
      typeof values.account_id === "string" && /^[a-f0-9]{32}$/.test(values.account_id) &&
      typeof values.api_token === "string" && /^[^\s]{20,512}$/.test(values.api_token)) {
    return { provider: values.provider, credentials: { account_id: values.account_id, api_token: values.api_token } };
  }
  if (values.provider === "backblaze-b2" &&
      typeof values.key_id === "string" && /^[a-zA-Z0-9]{12,128}$/.test(values.key_id) &&
      typeof values.application_key === "string" && /^[a-zA-Z0-9+/_=-]{20,256}$/.test(values.application_key)) {
    return { provider: values.provider, credentials: { key_id: values.key_id, application_key: values.application_key } };
  }
  return null;
}

export function isSettingsWriteRequest(request: Request, expectedOrigin: string) {
  return request.headers.get("origin") === expectedOrigin &&
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() === "application/json";
}
