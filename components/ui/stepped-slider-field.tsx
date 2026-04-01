import type { CSSProperties } from "react";

import { cx } from "@/lib/ui/cx";

import { FormField } from "@/components/ui/form-field";

type SteppedSliderFieldProps = {
  disabled?: boolean;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  max: number;
  maxLabel: string;
  min?: number;
  minLabel: string;
  name?: string;
  onChange: (value: number) => void;
  step: number;
  value: number;
  valueLabel?: string;
};

type ClampSteppedValueOptions = {
  max: number;
  min?: number;
  step?: number;
  value: number;
};

export function clampSteppedValue({
  max,
  min = 0,
  step = 0,
  value,
}: ClampSteppedValueOptions) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
    return min;
  }

  const bounded = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

  if (!Number.isFinite(step) || step <= 0) {
    return bounded;
  }

  const snapped = min + Math.round((bounded - min) / step) * step;
  const precision = Number.isInteger(step) ? 0 : (String(step).split(".")[1]?.length ?? 0);
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(Math.min(precision, 6)));
}

export function SteppedSliderField({
  disabled = false,
  error,
  hint,
  id,
  label,
  max,
  maxLabel,
  min = 0,
  minLabel,
  name,
  onChange,
  step,
  value,
  valueLabel,
}: SteppedSliderFieldProps) {
  const safeValue = clampSteppedValue({
    max,
    min,
    step,
    value,
  });
  const percent =
    max <= min ? 0 : Math.min(100, Math.max(0, ((safeValue - min) / (max - min)) * 100));
  const sliderStyle = {
    "--fg-slider-percent": `${percent}%`,
  } as CSSProperties;
  const resolvedValueLabel = valueLabel ?? String(safeValue);

  return (
    <FormField error={error} hint={hint} htmlFor={id} label={label}>
      <div className={cx("fg-stepped-slider", disabled && "is-disabled")} style={sliderStyle}>
        <strong className="fg-stepped-slider__value-pill">{resolvedValueLabel}</strong>
        <input
          aria-valuetext={resolvedValueLabel}
          className="fg-stepped-slider__input"
          disabled={disabled}
          id={id}
          max={max}
          min={min}
          name={name}
          onChange={(event) => {
            const nextValue = clampSteppedValue({
              max,
              min,
              step,
              value: Number(event.target.value),
            });

            if (Number.isFinite(nextValue)) {
              onChange(nextValue);
            }
          }}
          step={step}
          type="range"
          value={safeValue}
        />
        <div aria-hidden="true" className="fg-stepped-slider__bounds">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    </FormField>
  );
}
