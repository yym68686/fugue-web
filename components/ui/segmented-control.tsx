import { ScrollableControlStrip } from "@/components/ui/scrollable-control-strip";
import type { KeyboardEvent, ReactNode } from "react";

import { cx } from "@/lib/ui/cx";

export type SegmentedControlOption<Value extends string> = {
  disabled?: boolean;
  label: ReactNode;
  value: Value;
};

export function SegmentedControl<Value extends string>({
  ariaLabel,
  className,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: Value) => void;
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
}) {
  function moveSelection(index: number, direction: 1 | -1) {
    const total = options.length;

    for (let step = 1; step <= total; step += 1) {
      const nextIndex = (index + (step * direction) + total) % total;
      const nextOption = options[nextIndex];

      if (nextOption && !nextOption.disabled) {
        return { index: nextIndex, option: nextOption };
      }
    }

    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let targetIndex = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      const next = moveSelection(index, 1);

      if (!next) {
        return;
      }

      targetIndex = next.index;
      onChange(next.option.value);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      const previous = moveSelection(index, -1);

      if (!previous) {
        return;
      }

      targetIndex = previous.index;
      onChange(previous.option.value);
    } else if (event.key === "Home") {
      const firstEnabled = options.findIndex((option) => !option.disabled);

      if (firstEnabled === -1) {
        return;
      }

      targetIndex = firstEnabled;
      onChange(options[firstEnabled].value);
    } else if (event.key === "End") {
      const reversedIndex = [...options].reverse().findIndex((option) => !option.disabled);

      if (reversedIndex === -1) {
        return;
      }

      targetIndex = options.length - 1 - reversedIndex;
      onChange(options[targetIndex].value);
    } else {
      return;
    }

    event.preventDefault();

    const group = event.currentTarget.parentElement;
    const buttons = group?.querySelectorAll<HTMLButtonElement>(".fg-segmented__item");
    const nextButton = buttons?.[targetIndex];

    nextButton?.focus();
  }

  return (
    <ScrollableControlStrip
      activeSelector='[aria-pressed="true"]'
      className={className}
      variant="segmented"
      watchKey={value}
    >
      <div aria-label={ariaLabel} className="fg-segmented" role="group">
        {options.map((option, index) => {
          const isActive = option.value === value;

          return (
            <button
              aria-pressed={isActive}
              className={cx("fg-segmented__item", isActive && "is-active")}
              data-state={isActive ? "active" : "inactive"}
              disabled={option.disabled}
              key={option.value}
              onClick={() => {
                if (option.disabled || isActive) {
                  return;
                }

                onChange(option.value);
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
              type="button"
            >
              <span className="fg-segmented__label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </ScrollableControlStrip>
  );
}
