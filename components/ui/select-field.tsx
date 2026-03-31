import type { ReactNode, SelectHTMLAttributes } from "react";

import { cx } from "@/lib/ui/cx";

function SelectChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="12"
      viewBox="0 0 12 12"
      width="12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.25 4.5 6 8.25 9.75 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  children: ReactNode;
  wrapperClassName?: string;
};

export function SelectField({
  children,
  className,
  disabled,
  wrapperClassName,
  ...props
}: SelectFieldProps) {
  return (
    <span
      className={cx("fg-select", disabled && "is-disabled", wrapperClassName)}
      data-disabled={disabled ? "true" : undefined}
    >
      <select {...props} className={cx("fg-select__control", className)} disabled={disabled}>
        {children}
      </select>
      <span aria-hidden="true" className="fg-select__icon">
        <SelectChevronIcon />
      </span>
    </span>
  );
}
