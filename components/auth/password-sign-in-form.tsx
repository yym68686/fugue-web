"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useI18n } from "@/components/providers/i18n-provider";

type PasswordSignInFormProps = {
  returnTo: string;
};

export function PasswordSignInForm({ returnTo }: PasswordSignInFormProps) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const handlePageShow = () => {
      setIsSubmitting(false);
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return (
    <form
      className="fg-form-grid"
      action="/api/auth/password/sign-in"
      method="post"
      onSubmit={async (event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const email = String(formData.get("email") ?? "");
        const password = String(formData.get("password") ?? "");

        try {
          const response = await fetch("/api/auth/password/sign-in", {
            body: JSON.stringify({ email, password, returnTo }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "post",
          });
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
            redirectTo?: string;
          } | null;

          if (!response.ok) {
            setError(payload?.error ?? t("Fugue could not open the workspace session. Try again."));
            setIsSubmitting(false);
            return;
          }

          window.location.assign(payload?.redirectTo ?? returnTo);
        } catch {
          setError(t("Fugue could not open the workspace session. Try again."));
          setIsSubmitting(false);
        }
      }}
    >
      <input name="returnTo" type="hidden" value={returnTo} />
      <FormField
        hint={t("Use the same account email shown in Profile.")}
        htmlFor="password-signin-email"
        label={t("Email")}
      >
        <input
          autoComplete="email"
          className="fg-input"
          id="password-signin-email"
          inputMode="email"
          name="email"
          placeholder={t("you@company.com")}
          required
          type="email"
        />
      </FormField>

      <FormField
        hint={t("Use the password saved from the profile page.")}
        htmlFor="password-signin-password"
        label={t("Password")}
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
        <span>{t("Show password")}</span>
      </label>
      {error ? (
        <p className="fg-form-status is-error" role="alert">
          {error}
        </p>
      ) : null}

      <Button loading={isSubmitting} loadingLabel={t("Signing in")} type="submit" variant="primary">
        {t("Sign in with password")}
      </Button>
    </form>
  );
}
