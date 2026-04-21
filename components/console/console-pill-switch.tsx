"use client";

import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";
import { cx } from "@/lib/ui/cx";

export type ConsolePillSwitchOption<Value extends string> =
  SegmentedControlOption<Value>;

export function ConsolePillSwitch<Value extends string>({
  ariaLabel,
  className,
  controlClassName,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  controlClassName?: string;
  onChange: (value: Value) => void;
  options: readonly ConsolePillSwitchOption<Value>[];
  value: Value;
}) {
  return (
    <SegmentedControl
      ariaLabel={ariaLabel}
      className={className}
      controlClassName={cx("fg-console-nav", controlClassName)}
      itemClassName="fg-console-nav__link"
      labelClassName="fg-console-nav__title"
      onChange={onChange}
      options={options}
      value={value}
      variant="pill"
    />
  );
}
