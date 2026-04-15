"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import type { ThemePreference } from "@/lib/theme";
import { cx } from "@/lib/ui/cx";

type ThemeSwitcherVariant = "segmented" | "pill";

const THEME_OPTIONS = ["auto", "light", "dark"] as const;

function readThemeLabel(preference: ThemePreference, t: (key: string) => string) {
  if (preference === "light") {
    return t("Light");
  }

  if (preference === "dark") {
    return t("Dark");
  }

  return t("Auto");
}

function useThemePreferenceControl() {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();
  const options: readonly SegmentedControlOption<ThemePreference>[] =
    THEME_OPTIONS.map((value) => ({
      label:
        value === "auto"
          ? t("Auto")
          : t(value === "light" ? "Light" : "Dark"),
      value,
    }));

  return {
    options,
    preference,
    setPreference,
    t,
    triggerAriaLabel: `${t("Theme")}: ${readThemeLabel(preference, t)}`,
  };
}

function useMenuDisclosure() {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const container = detailsRef.current;

      if (!container) {
        return;
      }

      if (event.target instanceof Node && container.contains(event.target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setOpen(false);
      triggerRef.current?.focus();
    }

    function handleFocusIn(event: FocusEvent) {
      const container = detailsRef.current;

      if (!container) {
        return;
      }

      if (event.target instanceof Node && container.contains(event.target)) {
        return;
      }

      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  return {
    detailsRef,
    open,
    panelId,
    setOpen,
    triggerRef,
  };
}

function ThemeSwitcherControl({
  className,
  onChange,
  options,
  preference,
  t,
  variant = "segmented",
}: {
  className?: string;
  onChange: (preference: ThemePreference) => void;
  options: readonly SegmentedControlOption<ThemePreference>[];
  preference: ThemePreference;
  t: (key: string) => string;
  variant?: ThemeSwitcherVariant;
}) {
  return (
    <SegmentedControl
      ariaLabel={t("Theme")}
      className={cx("fg-locale-switcher", className)}
      controlClassName="fg-locale-switcher__control"
      itemClassName={cx(
        "fg-locale-switcher__item",
        variant === "pill" && "fg-locale-switcher__item--pill",
      )}
      labelClassName={cx(
        "fg-locale-switcher__label",
        variant === "pill" && "fg-locale-switcher__label--pill",
      )}
      onChange={onChange}
      options={options}
      value={preference}
      variant={variant}
    />
  );
}

export function ThemeSwitcher({
  className,
  onChangeComplete,
  variant = "segmented",
}: {
  className?: string;
  onChangeComplete?: (preference: ThemePreference) => void;
  variant?: ThemeSwitcherVariant;
}) {
  const control = useThemePreferenceControl();

  return (
    <ThemeSwitcherControl
      className={className}
      onChange={(nextPreference) => {
        if (nextPreference === control.preference) {
          return;
        }

        control.setPreference(nextPreference);
        onChangeComplete?.(nextPreference);
      }}
      options={control.options}
      preference={control.preference}
      t={control.t}
      variant={variant}
    />
  );
}

export function ThemeUtilityMenu({ className }: { className?: string }) {
  const control = useThemePreferenceControl();
  const disclosure = useMenuDisclosure();
  const currentLabel = readThemeLabel(control.preference, control.t);

  return (
    <details
      className={cx("fg-locale-utility", className)}
      onToggle={(event) => disclosure.setOpen(event.currentTarget.open)}
      open={disclosure.open}
      ref={disclosure.detailsRef}
    >
      <summary
        aria-controls={disclosure.panelId}
        aria-expanded={disclosure.open}
        aria-label={control.triggerAriaLabel}
        className="fg-locale-utility__trigger"
        ref={disclosure.triggerRef}
      >
        <span className="fg-locale-utility__value">{currentLabel}</span>
        <span aria-hidden="true" className="fg-locale-utility__chevron">
          <svg viewBox="0 0 12 12">
            <path
              d="M3 4.5 6 7.5 9 4.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.2"
            />
          </svg>
        </span>
      </summary>

      <div className="fg-locale-utility__panel" id={disclosure.panelId}>
        <ul aria-label={control.t("Theme")} className="fg-locale-utility__list">
          {THEME_OPTIONS.map((value) => {
            const isActive = value === control.preference;

            return (
              <li className="fg-locale-utility__list-item" key={value}>
                <button
                  aria-pressed={isActive}
                  className={cx("fg-locale-utility__option", isActive && "is-active")}
                  onClick={() => {
                    if (!isActive) {
                      control.setPreference(value);
                    }

                    disclosure.setOpen(false);
                  }}
                  type="button"
                >
                  <span className="fg-locale-utility__option-label">
                    {value === "auto"
                      ? control.t("Auto")
                      : control.t(value === "light" ? "Light" : "Dark")}
                  </span>
                  <span aria-hidden="true" className="fg-locale-utility__option-mark" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

export function ThemeMenuButton({ className }: { className?: string }) {
  const control = useThemePreferenceControl();
  const disclosure = useMenuDisclosure();
  const currentLabel = readThemeLabel(control.preference, control.t);

  return (
    <details
      className={cx("fg-locale-menu", className)}
      onToggle={(event) => disclosure.setOpen(event.currentTarget.open)}
      open={disclosure.open}
      ref={disclosure.detailsRef}
    >
      <summary
        aria-controls={disclosure.panelId}
        aria-expanded={disclosure.open}
        aria-label={control.triggerAriaLabel}
        className="fg-button fg-button--secondary fg-button--compact fg-locale-menu__trigger"
        ref={disclosure.triggerRef}
      >
        <span className="fg-button__label">{currentLabel}</span>
      </summary>

      <div className="fg-locale-menu__panel" id={disclosure.panelId}>
        <p className="fg-locale-menu__title fg-mono">{control.t("Theme")}</p>
        <ThemeSwitcherControl
          className="fg-locale-menu__switcher"
          onChange={(nextPreference) => {
            if (nextPreference !== control.preference) {
              control.setPreference(nextPreference);
            }

            disclosure.setOpen(false);
          }}
          options={control.options}
          preference={control.preference}
          t={control.t}
        />
      </div>
    </details>
  );
}
