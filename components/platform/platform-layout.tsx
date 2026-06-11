import type { HTMLAttributes, ReactNode } from "react";

import { PlatformIcon } from "@/components/platform/platform-icon";
import { PlatformShellFrame } from "@/components/platform/platform-shell-frame";
import { cx } from "@/lib/ui/cx";

export function PlatformShell({
  children,
  className,
  collapseSidebarLabel = "Collapse sidebar",
  expandSidebarLabel = "Expand sidebar",
  mobileNavigation,
  mobileNavigationLabel = "Open menu",
  sidebar,
  topbar,
}: {
  children: ReactNode;
  className?: string;
  collapseSidebarLabel?: string;
  expandSidebarLabel?: string;
  mobileNavigation?: ReactNode;
  mobileNavigationLabel?: string;
  sidebar: ReactNode;
  topbar: ReactNode;
}) {
  return (
    <PlatformShellFrame
      className={className}
      collapseSidebarLabel={collapseSidebarLabel}
      expandSidebarLabel={expandSidebarLabel}
      mobileNavigation={mobileNavigation}
      mobileNavigationLabel={mobileNavigationLabel}
      sidebar={sidebar}
      topbar={topbar}
    >
      {children}
    </PlatformShellFrame>
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
      <div className="sidebar-top fp-sidebar__brand">{brand}</div>
      {command}
      <nav className="nav-links fp-nav">{children}</nav>
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
    <div className="brand fp-sidebar-brand">
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
  title,
}: {
  actions?: ReactNode;
  breadcrumbs: ReactNode;
  className?: string;
  title?: ReactNode;
}) {
  return (
    <>
      <div className={cx("topbar-heading fp-topbar__inner", className)}>
        <div className="fp-breadcrumb breadcrumbs">{breadcrumbs}</div>
        {title ? <strong className="topbar-title">{title}</strong> : null}
      </div>
      {actions ? <div className="fp-topbar__actions">{actions}</div> : null}
    </>
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
    <section className="page-header fp-page-header">
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
    <section {...rest} className={cx("section fp-section", className)}>
      {title || description ? (
        <div className="section-header fp-section__header">
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
