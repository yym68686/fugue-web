import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
} from "react";

import { cx } from "@/lib/ui/cx";

export type PlatformButtonVariant = "default" | "primary" | "ghost" | "danger";
export type PlatformButtonSize = "default" | "sm" | "lg";

type SharedButtonProps = {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  size?: PlatformButtonSize;
  variant?: PlatformButtonVariant;
};

function buttonClassName({
  className,
  size = "default",
  variant = "default",
}: {
  className?: string;
  size?: PlatformButtonSize;
  variant?: PlatformButtonVariant;
}) {
  return cx(
    "fp-button",
    variant !== "default" && `fp-button--${variant}`,
    size !== "default" && `fp-button--${size}`,
    className,
  );
}

export function PlatformButton({
  children,
  className,
  disabled,
  icon,
  size = "default",
  type = "button",
  variant = "default",
  ...rest
}: SharedButtonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={buttonClassName({ className, size, variant })}
      disabled={disabled}
      type={type}
    >
      {icon ? <span className="fp-button__icon">{icon}</span> : null}
      <span className="fp-button__label">{children}</span>
    </button>
  );
}

export function PlatformButtonLink({
  children,
  className,
  href,
  icon,
  prefetch = false,
  size = "default",
  variant = "default",
  ...rest
}: SharedButtonProps &
  Omit<ComponentProps<typeof Link>, "children" | "className" | "href"> & {
    href: ComponentProps<typeof Link>["href"];
  }) {
  return (
    <Link
      {...rest}
      className={buttonClassName({ className, size, variant })}
      href={href}
      prefetch={prefetch}
    >
      {icon ? <span className="fp-button__icon">{icon}</span> : null}
      <span className="fp-button__label">{children}</span>
    </Link>
  );
}

export function PlatformButtonAnchor({
  children,
  className,
  href,
  icon,
  size = "default",
  variant = "default",
  ...rest
}: SharedButtonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  }) {
  return (
    <a
      {...rest}
      className={buttonClassName({ className, size, variant })}
      href={href}
    >
      {icon ? <span className="fp-button__icon">{icon}</span> : null}
      <span className="fp-button__label">{children}</span>
    </a>
  );
}

export function PlatformIconButton({
  children,
  className,
  label,
  size = "default",
  variant = "ghost",
  ...rest
}: {
  children: ReactNode;
  label: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> &
  Pick<SharedButtonProps, "className" | "size" | "variant">) {
  return (
    <button
      {...rest}
      aria-label={label}
      className={buttonClassName({
        className: cx("fp-icon-button", size === "sm" && "fp-icon-button--sm", className),
        size,
        variant,
      })}
      type={rest.type ?? "button"}
    >
      {children}
    </button>
  );
}

export function PlatformButtonGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("fp-button-group", className)}>{children}</div>;
}

