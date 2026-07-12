import { LoadingPage } from "@/components/fugue-coss/shells";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function AuthLoading() {
  const { t } = await getRequestI18n();

  return (
    <LoadingPage
      description={t("Preparing the secure sign-in flow.")}
      label={t("Loading authentication…")}
    />
  );
}
