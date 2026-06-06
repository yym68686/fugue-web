import type { HTMLAttributes, ReactNode } from "react";

import { PlatformIcon } from "@/components/platform/platform-icon";
import { cx } from "@/lib/ui/cx";

export function PlatformShell({
  children,
  className,
  mobileNavigation,
  sidebar,
  topbar,
}: {
  children: ReactNode;
  className?: string;
  mobileNavigation?: ReactNode;
  sidebar: ReactNode;
  topbar: ReactNode;
}) {
  return (
    <main className={cx("fp-design-system fp-app-shell", className)}>
      <aside className="fp-sidebar fp-sidebar--desktop">{sidebar}</aside>
      <section className="fp-main">
        <header className="fp-topbar">
          {mobileNavigation ? (
            <details className="fp-mobile-nav">
              <summary className="fp-button fp-icon-button fp-icon-button--sm fp-mobile-nav__trigger">
                <PlatformIcon name="menu" />
                <span className="fg-visually-hidden">Open navigation</span>
              </summary>
              <div className="fp-mobile-nav__backdrop" />
              <div className="fp-mobile-nav__panel">{mobileNavigation}</div>
            </details>
          ) : null}
          {topbar}
        </header>
        {children}
      </section>
    </main>
  );
}

export function PlatformSidebar({
  brand,
  children,
  command,
  footer,
}: {
  brand: ReactNode;
  children: ReactNode;
  command?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="fp-sidebar__brand">{brand}</div>
      {command}
      <nav className="fp-nav">{children}</nav>
      {footer ? <div className="fp-sidebar__footer">{footer}</div> : null}
    </>
  );
}

export function PlatformSidebarBrand({
  meta,
  title,
}: {
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="fp-sidebar-brand">
      <span className="fp-brand-mark" aria-hidden="true" />
      <span className="fp-sidebar-brand__copy">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </span>
    </div>
  );
}

export function PlatformCommand({ children }: { children: ReactNode }) {
  return (
    <button className="fp-command" type="button">
      <PlatformIcon name="search" />
      <span>{children}</span>
      <kbd className="fp-command__kbd">/</kbd>
    </button>
  );
}

export function PlatformTopbar({
  actions,
  breadcrumbs,
  className,
}: {
  actions?: ReactNode;
  breadcrumbs: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("fp-topbar__inner", className)}>
      <div className="fp-breadcrumb">{breadcrumbs}</div>
      {actions ? <div className="fp-topbar__actions">{actions}</div> : null}
    </div>
  );
}

export function PlatformBreadcrumbs({
  items,
}: {
  items: Array<{ current?: boolean; href?: string; label: ReactNode }>;
}) {
  return (
    <>
      {items.map((item, index) => (
        <span
          aria-current={item.current ? "page" : undefined}
          className="fp-breadcrumb__item"
          key={index}
        >
          {item.href && !item.current ? <a href={item.href}>{item.label}</a> : item.label}
          {index < items.length - 1 ? (
            <PlatformIcon className="fp-breadcrumb__separator" name="chevron-right" />
          ) : null}
        </span>
      ))}
    </>
  );
}

export function PlatformPage({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return <div className={cx("fp-page", wide && "fp-page--wide", className)}>{children}</div>;
}

export function PlatformPageHeader({
  actions,
  children,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className="fp-page-header">
      <div className="fp-page-header__copy">
        {eyebrow ? <p className="fp-eyebrow">{eyebrow}</p> : null}
        <h1 className="fp-page-title">{title}</h1>
        {description ? <p className="fp-page-description">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="fp-page-header__actions">{actions}</div> : null}
    </section>
  );
}

export function PlatformSection({
  children,
  className,
  description,
  title,
  ...rest
}: {
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={cx("fp-section", className)}>
      {title || description ? (
        <div className="fp-section__header">
          {title ? <h2 className="fp-section-heading">{title}</h2> : null}
          {description ? <p className="fp-section-copy">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PlatformStack({
  children,
  className,
  tight = false,
}: {
  children: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return <div className={cx("fp-stack", tight && "fp-stack--tight", className)}>{children}</div>;
}

export function PlatformGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("fp-grid", className)}>{children}</div>;
}

