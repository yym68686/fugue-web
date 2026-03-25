import type { ReactNode } from "react";

import { ButtonLink, type ButtonVariant } from "@/components/ui/button";

type IntroAction = {
  href: string;
  label: string;
  variant?: ButtonVariant;
};

export function ConsolePageIntro({
  actions = [],
  description,
  eyebrow,
  title,
}: {
  actions?: IntroAction[];
  description: ReactNode;
  eyebrow: string;
  title: ReactNode;
}) {
  return (
    <section className="fg-console-page-intro">
      <div className="fg-console-page-intro__copy">
        <p className="fg-label">{eyebrow}</p>
        <h1 className="fg-ui-heading">{title}</h1>
        <p className="fg-copy">{description}</p>
      </div>

      {actions.length ? (
        <div className="fg-console-page-intro__actions">
          {actions.map((action) => (
            <ButtonLink href={action.href} key={action.href} variant={action.variant ?? "secondary"}>
              {action.label}
            </ButtonLink>
          ))}
        </div>
      ) : null}
    </section>
  );
}
