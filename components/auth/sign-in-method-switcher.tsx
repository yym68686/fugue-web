"use client";

import { useEffect, useState } from "react";

import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { PasswordSignInForm } from "@/components/auth/password-sign-in-form";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/components/providers/i18n-provider";

type SignInMethod = "email_link" | "password";

export function SignInMethodSwitcher({
  emailVerificationRequired,
  initialMethod = "password",
  returnTo,
}: {
  emailVerificationRequired: boolean;
  initialMethod?: SignInMethod;
  returnTo: string;
}) {
  const { t } = useI18n();
  const [method, setMethod] = useState<SignInMethod>(initialMethod);

  useEffect(() => {
    setMethod(initialMethod);
  }, [initialMethod]);

  return (
    <div className="fg-auth-method-switcher">
      <SegmentedControl
        ariaLabel={t("Sign-in method")}
        className="fg-auth-method-switcher__control"
        onChange={setMethod}
        options={[
          { label: t("Password"), value: "password" },
          { label: t("Email link"), value: "email_link" },
        ]}
        value={method}
      />

      <div className="fg-auth-method-switcher__body">
        {method === "password" ? (
          <PasswordSignInForm returnTo={returnTo} />
        ) : (
          <EmailAuthForm
            emailVerificationRequired={emailVerificationRequired}
            mode="signin"
            returnTo={returnTo}
          />
        )}
      </div>
    </div>
  );
}
