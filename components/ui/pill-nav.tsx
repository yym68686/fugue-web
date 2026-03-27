import Link from "next/link";
import type { AnchorHTMLAttributes, ComponentProps, HTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

type PillNavProps = Omit<HTMLAttributes<HTMLElement>, "aria-label" | "children"> & {
  ariaLabel: string;
  children: ReactNode;
};

type PillNavItemSharedProps = {
  active?: boolean;
  children: ReactNode;
  className?: string;
};

type PillNavLinkProps = PillNavItemSharedProps &
  Omit<ComponentProps<typeof Link>, "aria-current" | "children" | "className">;

type PillNavAnchorProps = PillNavItemSharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "aria-current" | "children" | "className"> & {
    href: string;
  };

function buildItemClassName(active: boolean, className?: string) {
  return cx(className, active && "is-active");
}

export function PillNav({ ariaLabel, children, className, ...rest }: PillNavProps) {
  return (
    <nav {...rest} aria-label={ariaLabel} className={cx("fg-pill-nav", className)}>
      {children}
    </nav>
  );
}

export function PillNavLink({ active = false, children, className, ...rest }: PillNavLinkProps) {
  return (
    <Link
      {...rest}
      aria-current={active ? "page" : undefined}
      className={buildItemClassName(active, className)}
      data-state={active ? "active" : "inactive"}
    >
      {children}
    </Link>
  );
}

export function PillNavAnchor({
  active = false,
  children,
  className,
  href,
  ...rest
}: PillNavAnchorProps) {
  return (
    <a
      {...rest}
      aria-current={active ? "page" : undefined}
      className={buildItemClassName(active, className)}
      data-state={active ? "active" : "inactive"}
      href={href}
    >
      {children}
    </a>
  );
}
