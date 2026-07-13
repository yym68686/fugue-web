"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useState,
  useTransition,
} from "react";

import type { LocalePreference } from "@/lib/i18n/core";
import { type ClientUiMessages, createClientUiMessages } from "@/lib/i18n/ui-messages";

type LocaleOption = {
  label: string;
  value: LocalePreference;
};

type LocaleSelectConfig = {
  initialPreference: LocalePreference;
  label: string;
  messages: ClientUiMessages;
  options: LocaleOption[];
};

const defaultLocaleSelectConfig: LocaleSelectConfig = {
  initialPreference: "auto",
  label: "Interface language",
  messages: createClientUiMessages((key) => key),
  options: [
    { label: "Auto", value: "auto" },
    { label: "English", value: "en" },
    { label: "Simplified Chinese", value: "zh-CN" },
    { label: "Traditional Chinese", value: "zh-TW" },
  ],
};

const LocaleSelectContext = createContext<LocaleSelectConfig>(
  defaultLocaleSelectConfig,
);

export function LocaleSelectProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: LocaleSelectConfig;
}) {
  return (
    <LocaleSelectContext.Provider value={value}>
      {children}
    </LocaleSelectContext.Provider>
  );
}

export function LocaleSelect({
  initialPreference,
  label,
  options,
}: {
  initialPreference?: LocalePreference;
  label?: string;
  options?: LocaleOption[];
}) {
  const id = useId();
  const inheritedConfig = useContext(LocaleSelectContext);
  const messages = inheritedConfig.messages;
  const resolvedInitialPreference =
    initialPreference ?? inheritedConfig.initialPreference;
  const resolvedLabel = label ?? inheritedConfig.label;
  const resolvedOptions = options ?? inheritedConfig.options;
  const [preference, setPreference] = useState(resolvedInitialPreference);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="coss-locale-select">
      <label htmlFor={id}>{resolvedLabel}</label>
      <select
        disabled={isPending}
        id={id}
        name="locale"
        aria-label={resolvedLabel}
        onChange={(event) => {
          const previousPreference = preference;
          const nextPreference = event.currentTarget.value as LocalePreference;
          setPreference(nextPreference);
          setError("");
          startTransition(async () => {
            try {
              const response = await fetch("/api/preferences/locale", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ locale: nextPreference }),
              });
              if (!response.ok) {
                throw new Error(messages.localeUpdateFailed);
              }
              window.location.reload();
            } catch (requestError) {
              setPreference(previousPreference);
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : messages.localeUpdateFailed,
              );
            }
          });
        }}
        value={preference}
      >
        {resolvedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span aria-live="polite" className="coss-sr-only">
        {error}
      </span>
    </div>
  );
}

export function useClientUiMessages() {
  return useContext(LocaleSelectContext).messages;
}
