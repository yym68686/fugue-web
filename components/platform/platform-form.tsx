import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cx } from "@/lib/ui/cx";

export function PlatformField({
  children,
  error,
  help,
  label,
  labelProps,
}: {
  children: ReactNode;
  error?: ReactNode;
  help?: ReactNode;
  label?: ReactNode;
  labelProps?: LabelHTMLAttributes<HTMLLabelElement>;
}) {
  return (
    <div className="fp-field">
      {label ? (
        <label {...labelProps} className={cx("fp-label", labelProps?.className)}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="fp-field-error">{error}</p> : null}
      {!error && help ? <p className="fp-help">{help}</p> : null}
    </div>
  );
}

export function PlatformInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx("fp-input", className)} />;
}

export function PlatformTextarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx("fp-textarea", className)} />;
}

export function PlatformSelect({
  children,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx("fp-select", className)}>
      {children}
    </select>
  );
}

export function PlatformToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("fp-toolbar", className)}>{children}</div>;
}

export function PlatformSearchField({
  label,
  ...rest
}: {
  label: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="fp-toolbar__search">
      <span className="fg-visually-hidden">{label}</span>
      <span aria-hidden="true">⌕</span>
      <input {...rest} className={cx("fp-search-input", rest.className)} />
    </label>
  );
}

export function PlatformSegmentedControl({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div aria-label={label} className={cx("fp-segmented", className)} role="group">
      {children}
    </div>
  );
}

export function PlatformSegmentedItem({
  children,
  pressed,
  ...rest
}: {
  children: ReactNode;
  pressed?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      aria-pressed={pressed ? "true" : "false"}
      className={cx("fp-segmented__item", rest.className)}
      type={rest.type ?? "button"}
    >
      {children}
    </button>
  );
}
