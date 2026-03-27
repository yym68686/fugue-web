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
    <div {...rest} className={cx("fg-bezel fg-proof-shell", className)}>
      <div className="fg-bezel__inner">{children}</div>
    </div>
  );
}

export function ProofShellRibbon({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("fg-proof-shell__ribbon", className)}>
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
    <div {...rest} className={cx("fg-proof-shell__empty", className)}>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  );
}
