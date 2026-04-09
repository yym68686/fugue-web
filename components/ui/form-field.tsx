import type { ReactNode } from "react";

import { cx } from "@/lib/ui/cx";
import { HintTooltip } from "@/components/ui/hint-tooltip";

type FormFieldProps = {
  children: ReactNode;
  error?: string;
  hint?: ReactNode;
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
    <div className="fg-field-stack">
      <span className="fg-field-label">
        <span className="fg-field-label__main">
          <label className="fg-field-label__text" htmlFor={htmlFor}>
            {label}
          </label>
          {!error && hint ? <HintTooltip ariaLabel={label}>{hint}</HintTooltip> : null}
        </span>
        {optionalLabel ? <span className="fg-field-label__meta">{optionalLabel}</span> : null}
      </span>
      <span className={cx("fg-field-control", error && "is-invalid")}>{children}</span>
      {error ? <span className="fg-field-error">{error}</span> : null}
    </div>
  );
}
