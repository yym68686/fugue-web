"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useI18n } from "@/components/providers/i18n-provider";

type PasswordSignInFormProps = {
  returnTo: string;
};

export function PasswordSignInForm({ returnTo }: PasswordSignInFormProps) {
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      className="fg-form-grid"
      action="/api/auth/password/sign-in"
      method="post"
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

      <Button type="submit" variant="primary">
        {t("Sign in with password")}
      </Button>
    </form>
  );
}
