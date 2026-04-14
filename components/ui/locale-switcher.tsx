"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/providers/i18n-provider";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  type LocalePreference,
  type Locale,
} from "@/lib/i18n/core";
import { cx } from "@/lib/ui/cx";

const EXPLICIT_LOCALE_LABELS: Record<
  Locale,
  {
    label: string;
    shortLabel: string;
  }
> = {
  en: {
    label: "English",
    shortLabel: "EN",
  },
  "zh-CN": {
    label: "简体中文",
    shortLabel: "简",
  },
  "zh-TW": {
    label: "繁體中文",
    shortLabel: "繁",
  },
};

const EXPLICIT_LOCALE_VALUES = ["en", "zh-CN", "zh-TW"] as const;

function buildOptionLabel(label: string, shortLabel: string): ReactNode {
  return (
    <>
      <span className="fg-visually-hidden">{label}</span>
      <span aria-hidden="true" className="fg-locale-switcher__code" title={label}>
        {shortLabel}
      </span>
    </>
  );
}

function readLocaleLabel(locale: Locale) {
  return EXPLICIT_LOCALE_LABELS[locale].label;
}

function writeLocalePreference(preference: LocalePreference) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  if (preference === "auto") {
    document.cookie = `${LOCALE_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    return;
  }

  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(preference)}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

function useLocalePreferenceControl() {
  const { locale, localePreference, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticPreference, setOptimisticPreference] = useState<LocalePreference>(localePreference);

  useEffect(() => {
    setOptimisticPreference(localePreference);
  }, [localePreference]);

  const autoLabel = t("Auto");
  const effectiveLocale = optimisticPreference === "auto" ? locale : optimisticPreference;
  const triggerLabel = readLocaleLabel(effectiveLocale);
  const triggerTitle =
    optimisticPreference === "auto" ? `${triggerLabel} (${autoLabel})` : triggerLabel;
  const options: readonly SegmentedControlOption<LocalePreference>[] = [
    {
      disabled: isPending,
      label: buildOptionLabel(autoLabel, autoLabel),
      value: "auto",
    },
    ...(["en", "zh-CN", "zh-TW"] as const).map((value) => ({
      disabled: isPending,
      label: buildOptionLabel(EXPLICIT_LOCALE_LABELS[value].label, EXPLICIT_LOCALE_LABELS[value].shortLabel),
      value,
    })),
  ];

  return {
    effectiveLocale,
    isPending,
    preference: optimisticPreference,
    setPreference(nextPreference: LocalePreference) {
      if (nextPreference === optimisticPreference) {
        return false;
      }

      setOptimisticPreference(nextPreference);
      writeLocalePreference(nextPreference);
      startTransition(() => {
        router.refresh();
      });

      return true;
    },
    t,
    triggerAriaLabel: `${t("Interface language")}: ${triggerTitle}`,
    triggerLabel,
    triggerTitle,
    options,
  };
}

function LocaleSwitcherControl({
  className,
  onChange,
  options,
  preference,
  pending,
  t,
}: {
  className?: string;
  onChange: (preference: LocalePreference) => void;
  options: readonly SegmentedControlOption<LocalePreference>[];
  pending: boolean;
  preference: LocalePreference;
  t: (key: string) => string;
}) {
  return (
    <SegmentedControl
      ariaLabel={t("Interface language")}
      className={cx("fg-locale-switcher", pending && "is-pending", className)}
      controlClassName="fg-locale-switcher__control"
      itemClassName="fg-locale-switcher__item"
      labelClassName="fg-locale-switcher__label"
      onChange={onChange}
      options={options}
      value={preference}
    />
  );
}

export function LocaleSwitcher({
  className,
  onChangeComplete,
}: {
  className?: string;
  onChangeComplete?: (preference: LocalePreference) => void;
}) {
  const control = useLocalePreferenceControl();

  return (
    <LocaleSwitcherControl
      className={className}
      onChange={(nextPreference) => {
        const changed = control.setPreference(nextPreference);

        if (changed) {
          onChangeComplete?.(nextPreference);
        }
      }}
      options={control.options}
      pending={control.isPending}
      preference={control.preference}
      t={control.t}
    />
  );
}

function useLocaleMenuDisclosure() {
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

export function LocaleUtilityMenu({ className }: { className?: string }) {
  const control = useLocalePreferenceControl();
  const disclosure = useLocaleMenuDisclosure();

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
        <span
          className="fg-locale-utility__value"
          lang={control.effectiveLocale}
          title={control.triggerTitle}
        >
          {control.triggerLabel}
        </span>
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
        <ul aria-label={control.t("Interface language")} className="fg-locale-utility__list">
          {EXPLICIT_LOCALE_VALUES.map((value) => {
            const isActive = value === control.effectiveLocale;

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
                  <span className="fg-locale-utility__option-label" lang={value}>
                    {EXPLICIT_LOCALE_LABELS[value].label}
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

export function LocaleMenuButton({ className }: { className?: string }) {
  const control = useLocalePreferenceControl();
  const disclosure = useLocaleMenuDisclosure();

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
        <span className="fg-button__label" title={control.triggerTitle}>
          {control.triggerLabel}
        </span>
      </summary>

      <div className="fg-locale-menu__panel" id={disclosure.panelId}>
        <p className="fg-locale-menu__title fg-mono">{control.t("Interface language")}</p>
        <LocaleSwitcherControl
          className="fg-locale-menu__switcher"
          onChange={(nextPreference) => {
            const changed = control.setPreference(nextPreference);

            if (changed) {
              disclosure.setOpen(false);
            }
          }}
          options={control.options}
          pending={control.isPending}
          preference={control.preference}
          t={control.t}
        />
      </div>
    </details>
  );
}
