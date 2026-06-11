import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

import { PlatformIcon, type PlatformIconName } from "@/components/platform/platform-icon";
import { cx } from "@/lib/ui/cx";

export function PlatformCard({
  children,
  className,
  flush = false,
  raised = false,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
  raised?: boolean;
}) {
  return (
    <section
      className={cx(
        "fp-card",
        flush && "fp-card--flush",
        raised && "fp-card--raised",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PlatformCardHeader({
  actions,
  title,
}: {
  actions?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="fp-card__header">
      <span>{title}</span>
      {actions ? <span className="fp-card__actions">{actions}</span> : null}
    </div>
  );
}

export function PlatformCardBody({ children }: { children: ReactNode }) {
  return <div className="fp-card__body">{children}</div>;
}

export function PlatformCardFooter({ children }: { children: ReactNode }) {
  return <div className="fp-card__footer">{children}</div>;
}

export function PlatformMetric({
  delta,
  deltaDirection = "up",
  label,
  sparkline,
  value,
}: {
  delta?: ReactNode;
  deltaDirection?: "down" | "up";
  label: ReactNode;
  sparkline?: ReactNode;
  value: ReactNode;
}) {
  return (
    <article className="fp-card fp-metric">
      <div className="fp-metric__body">
        <span className="fp-metric__label">{label}</span>
        <strong className="fp-metric__value">{value}</strong>
        {delta ? (
          <span
            className={cx(
              "fp-metric__delta",
              deltaDirection === "down" && "fp-metric__delta--down",
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      {sparkline ? <div className="fp-metric__visual">{sparkline}</div> : null}
    </article>
  );
}

export function PlatformMetricGrid({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} className={cx("fp-metric-grid", className)}>
      {children}
    </section>
  );
}

export function PlatformResourceList({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cx("fp-resource-list", className)}>
      {children}
    </div>
  );
}

type PlatformResourceRowSharedProps = {
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: PlatformIconName | ReactNode;
  meta?: ReactNode;
  title: ReactNode;
};

function resourceRowContent({
  actions,
  badges,
  description,
  icon,
  meta,
  title,
}: PlatformResourceRowSharedProps) {
  return (
    <>
      {icon ? (
        <span className="fp-row__icon">
          {typeof icon === "string" ? <PlatformIcon name={icon as PlatformIconName} /> : icon}
        </span>
      ) : null}
      <span className="fp-row__main">
        <span className="fp-row__title">{title}</span>
        {meta ? <span className="fp-row__meta">{meta}</span> : null}
        {description ? <span className="fp-row__description">{description}</span> : null}
      </span>
      {badges || actions ? (
        <div className="fp-row__side">
          {badges}
          {actions}
        </div>
      ) : null}
    </>
  );
}

export function PlatformResourceRow({
  actions,
  badges,
  className,
  description,
  icon,
  meta,
  title,
  ...props
}: PlatformResourceRowSharedProps & HTMLAttributes<HTMLDivElement>) {
  const rowProps = { actions, badges, description, icon, meta, title };

  return (
    <div {...props} className={cx("fp-row", className)}>
      {resourceRowContent(rowProps)}
    </div>
  );
}

export function PlatformResourceLink({
  actions,
  badges,
  className,
  description,
  href,
  icon,
  meta,
  prefetch = false,
  title,
  ...props
}: PlatformResourceRowSharedProps &
  Omit<ComponentProps<typeof Link>, "children" | "className" | "href"> & {
    href: ComponentProps<typeof Link>["href"];
  }) {
  const rowProps = { actions, badges, description, icon, meta, title };

  return (
    <Link className={cx("fp-row", className)} href={href} prefetch={prefetch} {...props}>
      {resourceRowContent(rowProps)}
    </Link>
  );
}

export function PlatformBadge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "danger" | "info" | "neutral" | "success" | "warning";
}) {
  return (
    <span className={cx("fp-badge", tone !== "neutral" && `fp-badge--${tone}`, className)}>
      {children}
    </span>
  );
}

export function PlatformStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "danger" | "neutral" | "success" | "warning";
}) {
  return (
    <span className={cx("fp-status", tone !== "neutral" && `fp-status--${tone}`)}>
      {children}
    </span>
  );
}

export function PlatformTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("fp-table-wrap", className)}>
      <table className="fp-table">{children}</table>
    </div>
  );
}

export function PlatformKeyValueList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <dl className={cx("fp-key-value-list", className)}>{children}</dl>;
}

export function PlatformKeyValueItem({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="fp-key-value-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
