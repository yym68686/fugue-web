import { BillingConsole } from "@/components/console/islands/billing-console";
import { PageHeader } from "@/components/shared/page-header";
import { createBillingStateMessages } from "@/lib/i18n/console-messages";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function BillingPage() {
  const { locale, t } = await getRequestI18n();

  return (
    <>
      <PageHeader
        title={t("Billing")}
        description={t(
          "Prepaid balance, managed capacity envelope, image storage, price book, checkout status, and billing events.",
        )}
      />
      <BillingConsole locale={locale} messages={createBillingStateMessages(t)} />
    </>
  );
}
