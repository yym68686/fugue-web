import assert from "node:assert/strict";
import test from "node:test";
import { isSettingsWriteRequest, parseObjectStorageSettings } from "@/lib/admin/settings-input";

test("storage settings accept only the exact credential fields for a supported provider", () => {
  const b2 = { provider: "backblaze-b2", key_id: "123456789012", application_key: "syntheticApplicationKey" };
  assert.deepEqual(parseObjectStorageSettings(b2), {
    provider: "backblaze-b2",
    credentials: { key_id: b2.key_id, application_key: b2.application_key },
  });
  const r2 = { provider: "cloudflare-r2", account_id: "a".repeat(32), api_token: "syntheticCloudflareToken" };
  assert.deepEqual(parseObjectStorageSettings(r2), {
    provider: "cloudflare-r2",
    credentials: { account_id: r2.account_id, api_token: r2.api_token },
  });
  for (const bad of [null, [], { ...b2, provider: "arbitrary-service" }, { ...b2, endpoint: "https://example.invalid" },
    { ...b2, application_key: "short" }, { ...r2, api_token: "bad token with whitespace" }]) {
    assert.equal(parseObjectStorageSettings(bad), null);
  }
});

test("admin storage settings writes require JSON and the exact canonical origin", () => {
  const origin = "https://console.example.invalid";
  const req = (headers: Record<string, string>) => new Request(origin + "/api/admin/settings", { method: "PUT", headers });
  assert.equal(isSettingsWriteRequest(req({ origin, "content-type": "application/json; charset=utf-8" }), origin), true);
  for (const headers of [{ "content-type": "application/json" }, { origin, "content-type": "text/plain" },
    { origin: "https://foreign.example.invalid", "content-type": "application/json" }]) {
    assert.equal(isSettingsWriteRequest(req(headers as Record<string, string>), origin), false);
  }
});
import { parseIntegrationSettings } from "@/lib/admin/integration-keys";
test("only explicitly supported integration credentials can be overridden", () => {
  assert.deepEqual(parseIntegrationSettings({ integration: "CREEM_API_KEY", secret: " synthetic-key " }), {
    integration: "CREEM_API_KEY", secret: "synthetic-key",
  });
  assert.deepEqual(parseIntegrationSettings({ integration: "GOOGLE_CLIENT_SECRET", secret: null }), {
    integration: "GOOGLE_CLIENT_SECRET", secret: null,
  });
  assert.equal(parseIntegrationSettings({ integration: "FUGUE_BOOTSTRAP_KEY", secret: "synthetic-key" }), null);
  assert.equal(parseIntegrationSettings({ integration: "GOOGLE_CLIENT_SECRET", secret: "a b" }), null);
  assert.equal(parseIntegrationSettings({ integration: "RESEND_API_KEY", secret: "x".repeat(8193) }), null);
});
