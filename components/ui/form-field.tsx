import type { ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

type FormFieldProps = {
  children: ReactNode;
  error?: string;
  hint?: string;
  htmlFor: string;
  label: string;
  optionalLabel?: string;
};

export function FormField({
  children,
  error,
  hint,
  htmlFor,
  label,
  optionalLabel,
}: FormFieldProps) {
  return (
    <label className="fg-field-stack" htmlFor={htmlFor}>
      <span className="fg-field-label">
        <span>{label}</span>
        {optionalLabel ? <span className="fg-field-label__meta">{optionalLabel}</span> : null}
      </span>
      <span className={cx("fg-field-control", error && "is-invalid")}>{children}</span>
      {error ? <span className="fg-field-error">{error}</span> : null}
      {!error && hint ? <span className="fg-field-hint">{hint}</span> : null}
    </label>
  );
}
