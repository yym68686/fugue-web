import "server-only";

import { createPrivateKey } from "node:crypto";
import { integrationServices, type IntegrationKey } from "@/lib/admin/integration-keys";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import { withDbSchemaRetry } from "@/lib/db/schema";
import { writeSecurityAuditEvent } from "@/lib/security/audit";
import { sealText, unsealText } from "@/lib/security/seal";

function usesDeploymentOnly() {
  return process.env.FUGUE_WEB_INTEGRATIONS_ENV_ONLY === "1";
}

export async function runtimeIntegrationSecret(integration: IntegrationKey, deploymentSecret: string) {
  if (usesDeploymentOnly()) return deploymentSecret;
  const { rows: [row] } = await withDbSchemaRetry(() => queryDb<{ sealed_value: string }>(
    "SELECT sealed_value FROM app_integration_credentials WHERE integration = $1",
    [integration],
  ));
  if (!row) return deploymentSecret;
  const value = JSON.parse(unsealText(row.sealed_value)) as { integration?: string; value?: string };
  if (value.integration !== integration || typeof value.value !== "string") {
    throw new Error("503 Integration credential is unavailable.");
  }
  return value.value;
}

export async function externalServiceSettings() {
  const { rows } = await withDbSchemaRetry(() => queryDb<{ integration: string }>(
    "SELECT integration FROM app_integration_credentials",
  ));
  const overrides = new Set(rows.map(({ integration }) => integration));
  return integrationServices.map(({ name, keys }) => ({
    name,
    credentials: keys.map((integration) => ({
      integration,
      deploymentConfigured: Boolean(process.env[integration]?.trim()),
      overridden: overrides.has(integration),
      deploymentOnly: usesDeploymentOnly(),
    })),
  }));
}

export async function saveIntegrationCredential(integration: IntegrationKey, value: string | null, actorEmail: string) {
  const baseline = process.env[integration]?.trim();
  if (usesDeploymentOnly() || (value !== null && !baseline)) {
    throw new Error("409 Configure the integration in the deployment environment first.");
  }
  if (value !== null && integration === "GITHUB_APP_PRIVATE_KEY") {
    value = value.replace(/\\n/g, "\n");
    try {
      const key = createPrivateKey(value);
      if (key.asymmetricKeyType !== "rsa") throw new Error();
    } catch {
      throw new Error("400 A valid RSA private key is required.");
    }
  }
  // A rotation must not move the existing billing integration between live and test.
  if (value !== null && integration === "CREEM_API_KEY" &&
    value.startsWith("creem_test_") !== baseline!.startsWith("creem_test_")) {
    throw new Error("400 Creem test/live mode is deployment-managed.");
  }
  const sealed = value === null ? null : sealText(JSON.stringify({ integration, value }));
  await withDbSchemaRetry(() => withDbTransaction(async (db) => {
    if (sealed === null) {
      await db.query("DELETE FROM app_integration_credentials WHERE integration = $1", [integration]);
    } else {
      await db.query(`INSERT INTO app_integration_credentials(integration, sealed_value)
        VALUES ($1, $2) ON CONFLICT(integration) DO UPDATE SET sealed_value = EXCLUDED.sealed_value`, [integration, sealed]);
    }
    await writeSecurityAuditEvent(db, {
      action: "admin.integration-credential.updated",
      actorEmail,
      metadata: { integration, override: sealed !== null },
    });
  }));
}
