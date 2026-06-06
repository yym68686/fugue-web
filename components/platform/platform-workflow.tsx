import type { ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

export function PlatformWizard({
  children,
  className,
  eyebrow,
  railTitle,
}: {
  children: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  railTitle?: ReactNode;
}) {
  return (
    <main className={cx("fp-design-system fp-fullscreen-dialog", className)}>
      <section className="fp-wizard">
        {railTitle ? <div className="fp-wizard__rail-title">{railTitle}</div> : null}
        {eyebrow ? <p className="fp-wizard__eyebrow">{eyebrow}</p> : null}
        {children}
      </section>
    </main>
  );
}

export function PlatformStepList({
  children,
}: {
  children: ReactNode;
}) {
  return <ol className="fp-step-list">{children}</ol>;
}

export function PlatformStep({
  children,
  status = "pending",
  title,
}: {
  children?: ReactNode;
  status?: "active" | "complete" | "pending";
  title: ReactNode;
}) {
  return (
    <li className={cx("fp-step", `fp-step--${status}`)}>
      <span className="fp-step__marker" aria-hidden="true" />
      <div className="fp-step__body">
        <strong>{title}</strong>
        {children ? <p>{children}</p> : null}
      </div>
    </li>
  );
}

