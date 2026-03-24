import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

type ButtonVariant = "primary" | "ghost";
type ButtonSize = "default" | "compact";

type SharedProps = {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type ButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonLinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

function buildClassName(
  variant: ButtonVariant = "ghost",
  size: ButtonSize = "default",
  className?: string,
) {
  return cx(
    "fg-button",
    variant === "primary" ? "fg-button--primary" : "fg-button--ghost",
    size === "compact" && "fg-button--compact",
    className,
  );
}

export function Button(props: ButtonProps) {
  const {
    children,
    className,
    icon = <span aria-hidden="true">-&gt;</span>,
    size = "default",
    type = "button" as const,
    variant = "ghost",
    ...rest
  } = props;

  const classes = buildClassName(variant, size, className);
  const iconNode = <span className="fg-button__icon">{icon}</span>;

  return (
    <button {...rest} className={classes} type={type}>
      <span>{children}</span>
      {iconNode}
    </button>
  );
}

export function ButtonLink(props: ButtonLinkProps) {
  const {
    children,
    className,
    href,
    icon = <span aria-hidden="true">-&gt;</span>,
    size = "default",
    variant = "ghost",
    ...rest
  } = props;

  const classes = buildClassName(variant, size, className);
  const iconNode = <span className="fg-button__icon">{icon}</span>;

  return (
    <Link {...rest} className={classes} href={href}>
      <span>{children}</span>
      {iconNode}
    </Link>
  );
}
