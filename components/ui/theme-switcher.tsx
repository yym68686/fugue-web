"use client";

import { useI18n } from "@/components/providers/i18n-provider";
import { useTheme } from "@/components/providers/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import { cx } from "@/lib/ui/cx";

type ThemeSwitcherVariant = "segmented" | "pill";

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
    </svg>
  );
}

function ThemeToggleButton({
  className,
  onChangeComplete,
}: {
  className?: string;
  onChangeComplete?: (preference: ThemePreference) => void;
}) {
  const { resolvedTheme, setPreference } = useTheme();
  const { t } = useI18n();
  const isDark = resolvedTheme === "dark";
  const nextPreference: ThemePreference = isDark ? "light" : "dark";
  const label = t("Toggle theme");

  return (
    <button
      aria-label={label}
      className={cx("icon-button", className)}
      onClick={() => {
        setPreference(nextPreference);
        onChangeComplete?.(nextPreference);
      }}
      title={label}
      type="button"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function ThemeSwitcher({
  className,
  onChangeComplete,
}: {
  className?: string;
  onChangeComplete?: (preference: ThemePreference) => void;
  variant?: ThemeSwitcherVariant;
}) {
  return (
    <ThemeToggleButton
      className={className}
      onChangeComplete={onChangeComplete}
    />
  );
}

export function ThemeUtilityMenu({ className }: { className?: string }) {
  return <ThemeToggleButton className={className} />;
}

export function ThemeMenuButton({ className }: { className?: string }) {
  return <ThemeToggleButton className={className} />;
}
