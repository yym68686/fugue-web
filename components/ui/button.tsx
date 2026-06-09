import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

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
  Omit<ComponentProps<typeof Link>, "children" | "className" | "href"> & {
    href: ComponentProps<typeof Link>["href"];
  };
type ButtonAnchorProps = SharedProps &
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
  const morlaneVariant = variant === "route" ? "primary" : variant;
  const morlaneSize = size === "compact" || size === "tight" ? "sm" : null;

  return cx(
    "button",
    morlaneVariant,
    morlaneSize,
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
        "button-icon",
        style === "island" && "island",
        style === "plain" && "plain",
        placement,
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
      {isBusy ? <span aria-hidden="true" className="button-status" /> : null}
      <span>{label}</span>
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
    prefetch = false,
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
    <Link {...rest} className={classes} href={href} prefetch={prefetch}>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  );
}

export function ButtonAnchor(props: ButtonAnchorProps) {
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
    <a {...rest} className={classes} href={href}>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </a>
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
      className={cx("button-inline", className)}
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
