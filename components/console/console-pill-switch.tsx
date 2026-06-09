"use client";

import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control";

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
      controlClassName={controlClassName}
      onChange={onChange}
      options={options}
      value={value}
      variant="pill"
    />
  );
}
