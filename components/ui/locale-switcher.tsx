"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/providers/i18n-provider";
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  type Locale,
  type LocalePreference,
} from "@/lib/i18n/core";
import { cx } from "@/lib/ui/cx";

const LOCALE_OPTIONS: Array<{
  labels: Record<Locale, string>;
  value: Locale;
}> = [
  { labels: { en: "English", "zh-CN": "英语", "zh-TW": "英語" }, value: "en" },
  {
    labels: { en: "Simplified Chinese", "zh-CN": "简体中文", "zh-TW": "簡體中文" },
    value: "zh-CN",
  },
  {
    labels: { en: "Traditional Chinese", "zh-CN": "繁体中文", "zh-TW": "繁體中文" },
    value: "zh-TW",
  },
];

type LocaleSwitcherVariant = "segmented" | "pill";

function writeLocalePreference(preference: LocalePreference) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  if (preference === "auto") {
    document.cookie = `${LOCALE_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    return;
  }

  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(preference)}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

function useLanguageSelectControl() {
  const { locale, localePreference, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticPreference, setOptimisticPreference] =
    useState<LocalePreference>(localePreference);

  useEffect(() => {
    setOptimisticPreference(localePreference);
  }, [localePreference]);

  const effectiveLocale =
    optimisticPreference === "auto" ? locale : optimisticPreference;

  return {
    effectiveLocale,
    isPending,
    label:
      effectiveLocale === "zh-CN"
        ? "语言"
        : effectiveLocale === "zh-TW"
          ? "語言"
          : "Language",
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
  };
}

function LanguageSelect({
  className,
  onChangeComplete,
}: {
  className?: string;
  onChangeComplete?: (preference: LocalePreference) => void;
}) {
  const control = useLanguageSelectControl();
  const selectId = useId();

  return (
    <label
      className={cx("language-select", className)}
      htmlFor={selectId}
      title={control.label}
    >
      <span>{control.label}</span>
      <select
        aria-label={control.label}
        disabled={control.isPending}
        id={selectId}
        name="locale"
        onChange={(event) => {
          const nextPreference = event.target.value as LocalePreference;
          const changed = control.setPreference(nextPreference);

          if (changed) {
            onChangeComplete?.(nextPreference);
          }
        }}
        value={control.effectiveLocale}
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.labels[control.effectiveLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LocaleSwitcher({
  className,
  onChangeComplete,
}: {
  className?: string;
  onChangeComplete?: (preference: LocalePreference) => void;
  variant?: LocaleSwitcherVariant;
}) {
  return (
    <LanguageSelect
      className={className}
      onChangeComplete={onChangeComplete}
    />
  );
}

export function LocaleUtilityMenu({ className }: { className?: string }) {
  return <LanguageSelect className={className} />;
}

export function LocaleMenuButton({ className }: { className?: string }) {
  return <LanguageSelect className={className} />;
}
