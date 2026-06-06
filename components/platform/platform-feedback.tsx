import type { ReactNode } from "react";

import { PlatformButtonLink } from "@/components/platform/platform-actions";
import { PlatformIcon, type PlatformIconName } from "@/components/platform/platform-icon";
import { cx } from "@/lib/ui/cx";

export function PlatformAlert({
  children,
  className,
  title,
  tone = "info",
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  tone?: "danger" | "info" | "warning";
}) {
  return (
    <div className={cx("fp-alert", tone !== "info" && `fp-alert--${tone}`, className)}>
      {title ? <strong className="fp-alert__title">{title}</strong> : null}
      {children ? <div className="fp-alert__copy">{children}</div> : null}
    </div>
  );
}

export function PlatformEmptyState({
  action,
  copy,
  icon = "project",
  title,
}: {
  action?: ReactNode;
  copy?: ReactNode;
  icon?: PlatformIconName;
  title: ReactNode;
}) {
  return (
    <section className="fp-empty">
      <span className="fp-empty__icon">
        <PlatformIcon name={icon} />
      </span>
      <h2 className="fp-empty__title">{title}</h2>
      {copy ? <p className="fp-empty__copy">{copy}</p> : null}
      {action}
    </section>
  );
}

export function PlatformErrorState({
  actionHref,
  actionLabel,
  copy,
  title,
}: {
  actionHref?: string;
  actionLabel?: ReactNode;
  copy?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className="fp-error-state">
      <span className="fp-empty__icon">
        <PlatformIcon name="error" />
      </span>
      <h2 className="fp-empty__title">{title}</h2>
      {copy ? <p className="fp-empty__copy">{copy}</p> : null}
      {actionHref && actionLabel ? (
        <PlatformButtonLink href={actionHref} variant="primary">
          {actionLabel}
        </PlatformButtonLink>
      ) : null}
    </section>
  );
}

export function PlatformLoadingState({
  children,
  label = "Loading",
}: {
  children?: ReactNode;
  label?: string;
}) {
  return (
    <section aria-busy="true" aria-label={label} className="fp-loading-state" role="status">
      {children ?? (
        <div className="fp-loading-state__stack">
          <span className="fp-skeleton" style={{ height: "2rem", width: "11rem" }} />
          <span className="fp-skeleton" style={{ height: "1rem", width: "18rem" }} />
          <span className="fp-skeleton" style={{ height: "1rem", width: "14rem" }} />
        </div>
      )}
    </section>
  );
}

export function PlatformSkeleton({
  className,
  height,
  width,
}: {
  className?: string;
  height?: string;
  width?: string;
}) {
  return <span className={cx("fp-skeleton", className)} style={{ height, width }} />;
}

export function PlatformModal({
  children,
  footer,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="fp-modal-backdrop">
      <section aria-modal="true" className="fp-modal" role="dialog">
        <header className="fp-modal__header">
          <h2 className="fp-section-heading">{title}</h2>
        </header>
        <div className="fp-modal__body">{children}</div>
        {footer ? <footer className="fp-modal__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function PlatformDrawer({
  children,
  footer,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  title: ReactNode;
}) {
  return (
    <aside aria-modal="true" className="fp-drawer" role="dialog">
      <header className="fp-drawer__header">
        <h2 className="fp-section-heading">{title}</h2>
      </header>
      <div className="fp-drawer__body">{children}</div>
      {footer ? <footer className="fp-drawer__footer">{footer}</footer> : null}
    </aside>
  );
}
