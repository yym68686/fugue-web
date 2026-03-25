import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

export type ButtonVariant = "route" | "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "compact" | "tight";
type ButtonIconPlacement = "leading" | "trailing";
type ButtonIconStyle = "plain" | "island";

type SharedProps = {
  children: ReactNode;
  className?: string;
  icon?: ReactNode | null;
  iconPlacement?: ButtonIconPlacement;
  iconStyle?: ButtonIconStyle;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

type ButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    loadingLabel?: ReactNode;
  };
type ButtonLinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

type InlineButtonProps = {
  blocked?: boolean;
  busy?: boolean;
  busyLabel?: ReactNode;
  className?: string;
  danger?: boolean;
  disabled?: boolean;
  label: ReactNode;
  onClick: () => void;
};

const DEFAULT_ROUTE_ICON = <span aria-hidden="true">-&gt;</span>;

function buildClassName(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "default",
  className?: string,
) {
  return cx(
    "fg-button",
    `fg-button--${variant}`,
    size === "compact" && "fg-button--compact",
    size === "tight" && "fg-button--tight",
    className,
  );
}

function resolveIcon(variant: ButtonVariant, icon: ReactNode | null | undefined) {
  if (icon === undefined && variant === "route") {
    return DEFAULT_ROUTE_ICON;
  }

  return icon ?? null;
}

function buildAccessory(
  icon: ReactNode,
  placement: ButtonIconPlacement,
  style: ButtonIconStyle,
) {
  return (
    <span
      className={cx(
        "fg-button__icon",
        style === "island" && "is-island",
        style === "plain" && "is-plain",
        placement === "leading" && "is-leading",
        placement === "trailing" && "is-trailing",
      )}
    >
      {icon}
    </span>
  );
}

export function Button(props: ButtonProps) {
  const {
    children,
    className,
    disabled = false,
    icon,
    iconPlacement,
    iconStyle,
    loading = false,
    loadingLabel,
    size = "default",
    type = "button" as const,
    variant = "secondary",
    ...rest
  } = props;

  const isBusy = loading || rest["aria-busy"] === true || rest["aria-busy"] === "true";
  const classes = buildClassName(variant, size, className);
  const resolvedIcon = resolveIcon(variant, icon);
  const resolvedPlacement = iconPlacement ?? (variant === "route" ? "trailing" : "leading");
  const resolvedIconStyle = iconStyle ?? (variant === "route" ? "island" : "plain");
  const label = isBusy && loadingLabel ? loadingLabel : children;
  const leadingIcon =
    !isBusy && resolvedIcon && resolvedPlacement === "leading"
      ? buildAccessory(resolvedIcon, "leading", resolvedIconStyle)
      : null;
  const trailingIcon =
    !isBusy && resolvedIcon && resolvedPlacement === "trailing"
      ? buildAccessory(resolvedIcon, "trailing", resolvedIconStyle)
      : null;

  return (
    <button
      {...rest}
      aria-busy={isBusy || undefined}
      className={classes}
      data-loading={isBusy ? "true" : undefined}
      disabled={disabled || loading}
      type={type}
    >
      {leadingIcon}
      {isBusy ? <span aria-hidden="true" className="fg-button__status" /> : null}
      <span className="fg-button__label">{label}</span>
      {trailingIcon}
    </button>
  );
}

export function ButtonLink(props: ButtonLinkProps) {
  const {
    children,
    className,
    href,
    icon,
    iconPlacement,
    iconStyle,
    size = "default",
    variant = "secondary",
    ...rest
  } = props;

  const classes = buildClassName(variant, size, className);
  const resolvedIcon = resolveIcon(variant, icon);
  const resolvedPlacement = iconPlacement ?? (variant === "route" ? "trailing" : "leading");
  const resolvedIconStyle = iconStyle ?? (variant === "route" ? "island" : "plain");
  const leadingIcon =
    resolvedIcon && resolvedPlacement === "leading"
      ? buildAccessory(resolvedIcon, "leading", resolvedIconStyle)
      : null;
  const trailingIcon =
    resolvedIcon && resolvedPlacement === "trailing"
      ? buildAccessory(resolvedIcon, "trailing", resolvedIconStyle)
      : null;

  return (
    <Link {...rest} className={classes} href={href}>
      {leadingIcon}
      <span className="fg-button__label">{children}</span>
      {trailingIcon}
    </Link>
  );
}

export function InlineButton({
  blocked = false,
  busy = false,
  busyLabel,
  className,
  danger = false,
  disabled = false,
  label,
  onClick,
}: InlineButtonProps) {
  return (
    <Button
      aria-disabled={blocked || disabled || undefined}
      className={cx("fg-button--inline", className)}
      disabled={blocked || disabled}
      loading={busy}
      loadingLabel={busyLabel}
      onClick={() => {
        if (blocked || busy || disabled) {
          return;
        }

        onClick();
      }}
      size="tight"
      type="button"
      variant={danger ? "danger" : "secondary"}
    >
      {label}
    </Button>
  );
}
