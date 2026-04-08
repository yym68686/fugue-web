import { ButtonAnchor } from "@/components/ui/button";
import { getRequestI18n } from "@/lib/i18n/server";

export async function ProviderButton({
  href,
  provider,
}: {
  href: string;
  provider: "github" | "google";
}) {
  const { t } = await getRequestI18n();
  const label = t(provider === "github" ? "GitHub" : "Google");
  const mark = provider === "github" ? "GH" : "G";

  return (
    <ButtonAnchor
      className="fg-provider-button"
      href={href}
      icon={<span aria-hidden="true" className="fg-provider-button__mark">{mark}</span>}
      iconPlacement="leading"
      iconStyle="plain"
      variant="secondary"
    >
      {t("Continue with {label}", { label })}
    </ButtonAnchor>
  );
}
