"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast";

type FormState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

type EmailAuthFormProps = {
  emailVerificationRequired: boolean;
  mode: "signin" | "signup";
};

type ApiPayload = {
  error?: string;
  message?: string;
  ok?: boolean;
  redirectTo?: string;
};

export function EmailAuthForm({ emailVerificationRequired, mode }: EmailAuthFormProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});

  const buttonLabel =
    mode === "signup"
      ? emailVerificationRequired
        ? "Create account"
        : "Create account now"
      : emailVerificationRequired
        ? "Send sign-in link"
        : "Continue with email";

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
      }),
    });

    const payload = (await response.json()) as ApiPayload;

    if (!response.ok) {
      const errorMessage = payload.error ?? "Something went wrong. Try again.";
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
          ? "Check your inbox for the verification link."
          : "Signed in."),
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
            ? "We send one verification link. No password required."
            : "We verify the email locally and open the session immediately."
        }
        htmlFor="auth-email"
        label="Email"
      >
        <input
          autoComplete="email"
          className="fg-input"
          id="auth-email"
          inputMode="email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
      </FormField>

      {state.kind === "error" ? <InlineAlert variant="error">{state.message}</InlineAlert> : null}
      {state.kind === "success" ? <InlineAlert variant="success">{state.message}</InlineAlert> : null}

      <Button disabled={isPending} type="submit" variant="primary">
        {isPending ? "Working" : buttonLabel}
      </Button>
    </form>
  );
}
