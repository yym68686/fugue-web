import Link from "next/link";

import { Button } from "@fugue/ui/components/button";

import { PublicShell } from "@/components/fugue-coss/shells";
import { getRequestI18n } from "@/lib/i18n/server";
import { createShellMessages } from "@/lib/i18n/ui-messages";

export default async function NotFoundPage() {
  const { t } = await getRequestI18n();

  return (
    <PublicShell messages={createShellMessages(t)}>
      <section className="coss-container coss-page coss-stack">
        <p className="coss-eyebrow">404</p>
        <h1 className="coss-page-title">{t("Page not found")}</h1>
        <p className="coss-page-description">
          {t("The requested page does not exist or is no longer available.")}
        </p>
        <div className="coss-actions">
          <Button render={<Link href="/" />}>{t("Back home")}</Button>
          <Button render={<Link href="/docs" />} variant="outline">
            {t("Read docs")}
          </Button>
        </div>
      </section>
    </PublicShell>
  );
}
