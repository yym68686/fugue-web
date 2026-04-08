"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/providers/i18n-provider";

type FormState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

type EmailAuthFormProps = {
  emailVerificationRequired: boolean;
  mode: "signin" | "signup";
  returnTo: string;
};

type ApiPayload = {
  error?: string;
  message?: string;
  ok?: boolean;
  redirectTo?: string;
};

export function EmailAuthForm({
  emailVerificationRequired,
  mode,
  returnTo,
}: EmailAuthFormProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});

  const buttonLabel =
    mode === "signup"
      ? emailVerificationRequired
        ? t("Create account")
        : t("Create account now")
      : emailVerificationRequired
        ? t("Send sign-in link")
        : t("Continue with email");

  useEffect(() => {
    if (state.kind === "idle") {
      return;
    }

    showToast({
      message: state.message,
      variant: state.kind,
    });
  }, [showToast, state]);

  async function handleSubmit(formData: FormData) {
    setFieldErrors({});
    setState({ kind: "idle" });

    const response = await fetch("/api/auth/email/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: formData.get("email"),
        mode,
        returnTo,
      }),
    });

    const payload = (await response.json()) as ApiPayload;

    if (!response.ok) {
      const errorMessage = t(payload.error ?? "Something went wrong. Try again.");
      const nextFieldErrors: { email?: string } = {};

      if (errorMessage.toLowerCase().includes("email")) {
        nextFieldErrors.email = errorMessage;
      }

      if (nextFieldErrors.email) {
        setFieldErrors(nextFieldErrors);
      }

      setState({ kind: "error", message: errorMessage });
      return;
    }

    if (payload.redirectTo) {
      window.location.assign(payload.redirectTo);
      return;
    }

    setState({
      kind: "success",
      message:
        payload.message ??
        (emailVerificationRequired
          ? t("Check your inbox for the verification link.")
          : t("Signed in.")),
    });
  }

  return (
    <form
      className="fg-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        startTransition(() => {
          void handleSubmit(formData);
        });
      }}
    >
      <FormField
        error={fieldErrors.email}
        hint={
          emailVerificationRequired
            ? t("We send one verification link. No password required.")
            : t("We verify the email locally and open the session immediately.")
        }
        htmlFor="auth-email"
        label={t("Email")}
      >
        <input
          autoComplete="email"
          className="fg-input"
          id="auth-email"
          inputMode="email"
          name="email"
          placeholder={t("you@company.com")}
          required
          type="email"
        />
      </FormField>
      <Button loading={isPending} loadingLabel={t("Working")} type="submit" variant="primary">
        {buttonLabel}
      </Button>
    </form>
  );
}
