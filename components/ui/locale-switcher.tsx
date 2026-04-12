"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

function readPreferenceShortLabel(preference: LocalePreference, autoLabel: string) {
  if (preference === "auto") {
    return autoLabel;
  }

  return EXPLICIT_LOCALE_LABELS[preference].shortLabel;
}

function readPreferenceLongLabel(preference: LocalePreference, autoLabel: string) {
  if (preference === "auto") {
    return autoLabel;
  }

  return EXPLICIT_LOCALE_LABELS[preference].label;
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
  const { localePreference, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticPreference, setOptimisticPreference] = useState<LocalePreference>(localePreference);

  useEffect(() => {
    setOptimisticPreference(localePreference);
  }, [localePreference]);

  const autoLabel = t("Auto");
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
    autoLabel,
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
    triggerLabel: readPreferenceShortLabel(optimisticPreference, autoLabel),
    triggerTitle: readPreferenceLongLabel(optimisticPreference, autoLabel),
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

export function LocaleMenuButton({ className }: { className?: string }) {
  const control = useLocalePreferenceControl();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
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

  return (
    <details
      className={cx("fg-locale-menu", className)}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
      ref={detailsRef}
    >
      <summary
        aria-expanded={open}
        aria-label={control.t("Interface language")}
        className="fg-button fg-button--secondary fg-button--compact fg-locale-menu__trigger"
        ref={triggerRef}
      >
        <span className="fg-button__label" title={control.triggerTitle}>
          {control.triggerLabel}
        </span>
        <span aria-hidden="true" className="fg-button__icon is-plain is-trailing fg-locale-menu__caret">
          v
        </span>
      </summary>

      <div className="fg-locale-menu__panel">
        <p className="fg-locale-menu__title fg-mono">{control.t("Interface language")}</p>
        <LocaleSwitcherControl
          className="fg-locale-menu__switcher"
          onChange={(nextPreference) => {
            const changed = control.setPreference(nextPreference);

            if (changed) {
              setOpen(false);
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
