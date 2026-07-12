import { DNSConsole } from "@/components/console/islands/dns-console";
import { PageHeader } from "@/components/shared/page-header";
import { createDnsStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function DNSPage() {
  const { locale, t } = await getRequestI18n();

  return (
    <>
      <PageHeader
        title={t("Hosted DNS")}
        description={t(
          "Tenant DNS zones, records, delegation preflight, and Fugue-managed app records.",
        )}
      />
      <DNSConsole locale={locale} messages={createDnsStateMessages(t)} />
    </>
  );
}
