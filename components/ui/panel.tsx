import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("fg-bezel fg-panel", className)}>
      <div className="fg-bezel__inner">{children}</div>
    </section>
  );
}

export function PanelSection({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("fg-panel__section", className)}>
      {children}
    </div>
  );
}

export function PanelTitle({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 {...rest} className={cx("fg-panel__title fg-ui-heading", className)}>
      {children}
    </h2>
  );
}

export function PanelCopy({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cx("fg-panel__copy", className)}>{children}</p>;
}

export function PanelDivider({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("fg-panel__divider", className)}>{children}</div>;
}
