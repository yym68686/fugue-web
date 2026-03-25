import { ButtonLink } from "@/components/ui/button";

export function ProviderButton({
  href,
  provider,
}: {
  href: string;
  provider: "google";
}) {
  return (
    <ButtonLink
      className="fg-provider-button"
      href={href}
      icon={<span aria-hidden="true" className="fg-provider-button__mark">G</span>}
      iconPlacement="leading"
      iconStyle="plain"
      variant="secondary"
    >
      Continue with {provider === "google" ? "Google" : provider}
    </ButtonLink>
  );
}
