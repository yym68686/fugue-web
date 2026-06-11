"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { FormField } from "@/components/ui/form-field";

type DeployRepositoryLinkFieldProps = {
  defaultValue: string;
  desktopAutoFocus?: boolean;
  id: string;
  name: string;
};

function looksReadyForSubmission(value: string) {
  try {
    const url = new URL(value);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    return Boolean(url.protocol && url.host && pathSegments.length >= 2);
  } catch {
    return false;
  }
}

export function DeployRepositoryLinkField({
  defaultValue,
  desktopAutoFocus = false,
  id,
  name,
}: DeployRepositoryLinkFieldProps) {
  const { t } = useI18n();
  const autoSubmitTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(defaultValue);
  const lastSubmittedValueRef = useRef(defaultValue.trim());

  useEffect(() => {
    if (autoSubmitTimeoutRef.current !== null) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }

    setValue(defaultValue);
    lastSubmittedValueRef.current = defaultValue.trim();
  }, [defaultValue]);

  useEffect(() => {
    if (!desktopAutoFocus) {
      return;
    }

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    inputRef.current?.focus();
  }, [desktopAutoFocus]);

  useEffect(() => {
    const nextValue = value.trim();

    if (
      nextValue === lastSubmittedValueRef.current ||
      (nextValue && !looksReadyForSubmission(nextValue))
    ) {
      return;
    }

    autoSubmitTimeoutRef.current = window.setTimeout(() => {
      const form = inputRef.current?.form;

      if (!form) {
        return;
      }

      lastSubmittedValueRef.current = nextValue;
      form.requestSubmit();
    }, 360);

    return () => {
      if (autoSubmitTimeoutRef.current !== null) {
        window.clearTimeout(autoSubmitTimeoutRef.current);
        autoSubmitTimeoutRef.current = null;
      }
    };
  }, [value]);

  function submitCurrentValue() {
    const nextValue = value.trim();

    if (nextValue === lastSubmittedValueRef.current) {
      return;
    }

    if (autoSubmitTimeoutRef.current !== null) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }

    const form = inputRef.current?.form;

    if (!form) {
      return;
    }

    lastSubmittedValueRef.current = nextValue;
    form.requestSubmit();
  }

  return (
    <FormField htmlFor={id} label={t("Repository link")}>
      <input
        autoCapitalize="none"
        autoComplete="url"
        className="fg-input"
        id={id}
        inputMode="url"
        name={name}
        onBlur={submitCurrentValue}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }

          event.preventDefault();
          submitCurrentValue();
        }}
        placeholder="https://github.com/owner/repo"
        ref={inputRef}
        spellCheck={false}
        type="url"
        value={value}
      />
    </FormField>
  );
}
