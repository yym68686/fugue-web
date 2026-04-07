"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";

type PasswordSignInFormProps = {
  returnTo: string;
};

type FormState =
  | { kind: "idle" }
  | { kind: "error"; message: string };

type ApiPayload = {
  error?: string;
  ok?: boolean;
  redirectTo?: string;
};

export function PasswordSignInForm({ returnTo }: PasswordSignInFormProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  useEffect(() => {
    if (state.kind !== "error") {
      return;
    }

    showToast({
      message: state.message,
      variant: "error",
    });
  }, [showToast, state]);

  async function handleSubmit(formData: FormData) {
    setFieldErrors({});
    setState({ kind: "idle" });

    const response = await fetch("/api/auth/password/sign-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
        returnTo,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiPayload;

    if (!response.ok) {
      const message = payload.error ?? "Email or password is incorrect.";
      setFieldErrors({
        password: message,
      });
      setState({
        kind: "error",
        message,
      });
      return;
    }

    if (payload.redirectTo) {
      window.location.assign(payload.redirectTo);
    }
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
        hint="Use the same account email shown in Profile."
        htmlFor="password-signin-email"
        label="Email"
      >
        <input
          autoComplete="email"
          className="fg-input"
          id="password-signin-email"
          inputMode="email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
      </FormField>

      <FormField
        error={fieldErrors.password}
        hint="Use the password saved from the profile page."
        htmlFor="password-signin-password"
        label="Password"
      >
        <input
          autoComplete="current-password"
          className="fg-input"
          id="password-signin-password"
          name="password"
          required
          type={showPassword ? "text" : "password"}
        />
      </FormField>

      <label className="fg-password-toggle">
        <input
          checked={showPassword}
          onChange={(event) => setShowPassword(event.currentTarget.checked)}
          type="checkbox"
        />
        <span>Show password</span>
      </label>

      <Button loading={isPending} loadingLabel="Signing in" type="submit" variant="primary">
        Sign in with password
      </Button>
    </form>
  );
}
