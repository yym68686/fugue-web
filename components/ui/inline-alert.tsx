import type { ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

type InlineAlertProps = {
  children: ReactNode;
  variant?: "info" | "error" | "success";
};

export function InlineAlert({ children, variant = "info" }: InlineAlertProps) {
  return (
    <div
      className={cx("fg-inline-alert", `fg-inline-alert--${variant}`)}
      role={variant === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
