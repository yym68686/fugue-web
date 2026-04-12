"use client";

import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useI18n } from "@/components/providers/i18n-provider";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n/core";
import { cx } from "@/lib/ui/cx";

const LOCALE_LABELS: Record<
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

function buildOptionLabel(locale: Locale): ReactNode {
  const { label, shortLabel } = LOCALE_LABELS[locale];

  return (
    <>
      <span className="fg-visually-hidden">{label}</span>
      <span aria-hidden="true" className="fg-locale-switcher__code" title={label}>
        {shortLabel}
      </span>
    </>
  );
}

function writeLocaleCookie(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticLocale, setOptimisticLocale] = useState<Locale>(locale);

  useEffect(() => {
    setOptimisticLocale(locale);
  }, [locale]);

  const options: readonly SegmentedControlOption<Locale>[] = (["en", "zh-CN", "zh-TW"] as const).map((value) => ({
    disabled: isPending,
    label: buildOptionLabel(value),
    value,
  }));

  return (
    <SegmentedControl
      ariaLabel={t("Interface language")}
      className={cx("fg-locale-switcher", isPending && "is-pending", className)}
      controlClassName="fg-locale-switcher__control"
      itemClassName="fg-locale-switcher__item"
      labelClassName="fg-locale-switcher__label"
      onChange={(nextLocale) => {
        if (nextLocale === locale) {
          return;
        }

        setOptimisticLocale(nextLocale);
        writeLocaleCookie(nextLocale);
        startTransition(() => {
          router.refresh();
        });
      }}
      options={options}
      value={optimisticLocale}
    />
  );
}
