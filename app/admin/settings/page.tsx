import AppLayout from "@/components/AppLayout";
import IntegrationSettings from "@/components/admin/IntegrationSettings";
import ObjectStorageSettings from "@/components/admin/ObjectStorageSettings";
import { externalServiceSettings } from "@/lib/admin/external-services";
import { requireActiveAdminPageSession } from "@/lib/auth/page-access";
import { getObjectStorageConfig } from "@/lib/fugue/console";
import { getRequestI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireActiveAdminPageSession();
  const { t } = await getRequestI18n();
  const [r2, b2, integrations] = await Promise.all([
    getObjectStorageConfig("cloudflare-r2").catch(() => null),
    getObjectStorageConfig("backblaze-b2").catch(() => null),
    externalServiceSettings().catch(() => null),
  ]);
  return (
    <AppLayout>
      <div className="page">
        <div className="phead"><div><h1>{t("Platform settings")}</h1><p className="muted">{t("Configure management credentials for project object storage. Saved secrets are never displayed.")}</p></div></div>
        <ObjectStorageSettings provider="cloudflare-r2" initial={r2} />
        <ObjectStorageSettings provider="backblaze-b2" initial={b2} />
        <section className="panel mt-4 p-4">
          <h2>{t("External integrations")}</h2>
          <p className="muted">{t("Rotate credentials for existing integrations. Changes apply immediately; verify them with the provider. Initial setup and account identifiers stay in deployment configuration.")}</p>
          <ul className="mt-3 space-y-3">
            {integrations?.map(({ name, credentials }) => (
              <li key={name}><strong>{t(name)}</strong>
                {credentials.map((credential) => <IntegrationSettings key={credential.integration} credential={credential} />)}
              </li>
            ))}
            {!integrations && <li>{t("Status unavailable")}</li>}
          </ul>
        </section>
      </div>
    </AppLayout>
  );
}
