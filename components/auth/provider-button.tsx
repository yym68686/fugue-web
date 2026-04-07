import { ButtonAnchor } from "@/components/ui/button";

export function ProviderButton({
  href,
  provider,
}: {
  href: string;
  provider: "github" | "google";
}) {
  const label = provider === "github" ? "GitHub" : "Google";
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
      Continue with {label}
    </ButtonAnchor>
  );
}
