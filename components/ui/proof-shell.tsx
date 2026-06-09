import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

type ProofShellProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
};

type ProofShellEmptyProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
};

export function ProofShell({ children, className, ...rest }: ProofShellProps) {
  return (
    <div {...rest} className={cx("ml-card-shell", className)}>
      <div className="ml-card-shell__inner">{children}</div>
    </div>
  );
}

export function ProofShellRibbon({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("ml-card-shell__ribbon", className)}>
      {children}
    </div>
  );
}

export function ProofShellEmpty({
  children,
  className,
  description,
  title,
  ...rest
}: ProofShellEmptyProps) {
  return (
    <div {...rest} className={cx("ml-empty-state", className)}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  );
}
