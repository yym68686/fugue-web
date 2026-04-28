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
import { useTransitionPresence } from "@/lib/ui/transition-presence";

const EXPLICIT_LOCALE_LABELS: Record<
  Locale,
  {
    label: string;
    pillLabel: string;
    shortLabel: string;
  }
> = {
  en: {
    label: "English",
    pillLabel: "English",
    shortLabel: "EN",
  },
  "zh-CN": {
    label: "简体中文",
    pillLabel: "简体",
    shortLabel: "简",
  },
  "zh-TW": {
    label: "繁體中文",
    pillLabel: "繁體",
    shortLabel: "繁",
  },
};

const EXPLICIT_LOCALE_VALUES = ["en", "zh-CN", "zh-TW"] as const;

type LocaleSwitcherVariant = "segmented" | "pill";

function buildOptionLabel({
  label,
  lang,
  visibleLabel,
  visibleClassName,
}: {
  label: string;
  lang?: Locale;
  visibleClassName?: string;
  visibleLabel: string;
}): ReactNode {
  return (
    <>
      <span className="fg-visually-hidden">{label}</span>
      <span
        aria-hidden="true"
        className={visibleClassName}
        lang={lang}
        title={label}
      >
        {visibleLabel}
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

function useLocalePreferenceControl(variant: LocaleSwitcherVariant = "segmented") {
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
  const usePillLabels = variant === "pill";
  const options: readonly SegmentedControlOption<LocalePreference>[] = [
    {
      disabled: isPending,
      label: buildOptionLabel({
        label: autoLabel,
        visibleClassName: usePillLabels ? undefined : "fg-locale-switcher__code",
        visibleLabel: autoLabel,
      }),
      value: "auto",
    },
    ...(["en", "zh-CN", "zh-TW"] as const).map((value) => ({
      disabled: isPending,
      label: buildOptionLabel({
        label: EXPLICIT_LOCALE_LABELS[value].label,
        lang: usePillLabels ? value : undefined,
        visibleClassName: usePillLabels ? undefined : "fg-locale-switcher__code",
        visibleLabel: usePillLabels
          ? EXPLICIT_LOCALE_LABELS[value].pillLabel
          : EXPLICIT_LOCALE_LABELS[value].shortLabel,
      }),
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
  variant = "segmented",
}: {
  className?: string;
  onChange: (preference: LocalePreference) => void;
  options: readonly SegmentedControlOption<LocalePreference>[];
  pending: boolean;
  preference: LocalePreference;
  t: (key: string) => string;
  variant?: LocaleSwitcherVariant;
}) {
  return (
    <SegmentedControl
      ariaLabel={t("Interface language")}
      className={cx(
        "fg-locale-switcher",
        pending && "is-pending",
        variant === "pill" && "fg-locale-switcher--pill",
        className,
      )}
      controlClassName="fg-locale-switcher__control"
      itemClassName={cx("fg-locale-switcher__item", variant === "pill" && "fg-locale-switcher__item--pill")}
      labelClassName={cx("fg-locale-switcher__label", variant === "pill" && "fg-locale-switcher__label--pill")}
      onChange={onChange}
      options={options}
      value={preference}
      variant={variant}
    />
  );
}

export function LocaleSwitcher({
  className,
  onChangeComplete,
  variant = "segmented",
}: {
  className?: string;
  onChangeComplete?: (preference: LocalePreference) => void;
  variant?: LocaleSwitcherVariant;
}) {
  const control = useLocalePreferenceControl(variant);

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
      variant={variant}
    />
  );
}

function useLocaleMenuDisclosure() {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelId = useId();
  const { close, closing, open, present, toggle } = useTransitionPresence({
    closePropertyName: "--dropdown-close-dur",
    fallbackCloseMs: 150,
  });

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

      close();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      close();
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

      close();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [close, open]);

  return {
    closing,
    detailsRef,
    open,
    panelId,
    present,
    close,
    toggle,
    triggerRef,
  };
}

export function LocaleUtilityMenu({ className }: { className?: string }) {
  const control = useLocalePreferenceControl();
  const disclosure = useLocaleMenuDisclosure();

  return (
    <details
      className={cx("fg-locale-utility", className)}
      open={disclosure.present}
      ref={disclosure.detailsRef}
    >
      <summary
        aria-controls={disclosure.panelId}
        aria-expanded={disclosure.open}
        aria-label={control.triggerAriaLabel}
        className="fg-locale-utility__trigger"
        onClick={(event) => {
          event.preventDefault();
          disclosure.toggle();
        }}
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

      <div
        className={cx(
          "fg-locale-utility__panel",
          "t-dropdown",
          disclosure.open && "is-open",
          disclosure.closing && "is-closing",
        )}
        data-origin="top-right"
        id={disclosure.panelId}
      >
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

                    disclosure.close();
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
      open={disclosure.present}
      ref={disclosure.detailsRef}
    >
      <summary
        aria-controls={disclosure.panelId}
        aria-expanded={disclosure.open}
        aria-label={control.triggerAriaLabel}
        className="fg-button fg-button--secondary fg-button--compact fg-locale-menu__trigger"
        onClick={(event) => {
          event.preventDefault();
          disclosure.toggle();
        }}
        ref={disclosure.triggerRef}
      >
        <span className="fg-button__label" title={control.triggerTitle}>
          {control.triggerLabel}
        </span>
      </summary>

      <div
        className={cx(
          "fg-locale-menu__panel",
          "t-dropdown",
          disclosure.open && "is-open",
          disclosure.closing && "is-closing",
        )}
        data-origin="top-right"
        id={disclosure.panelId}
      >
        <p className="fg-locale-menu__title fg-mono">{control.t("Interface language")}</p>
        <LocaleSwitcherControl
          className="fg-locale-menu__switcher"
          onChange={(nextPreference) => {
            const changed = control.setPreference(nextPreference);

            if (changed) {
              disclosure.close();
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
