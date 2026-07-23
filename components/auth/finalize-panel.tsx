"use client";

import { useEffect, useRef, useState } from "react";

import { useT } from "@/lib/i18n/client";

export function FinalizePanel() {
  const t = useT();
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const value = window.location.hash.replace(/^#/, "").trim();
    setToken(value);
    // Auto-complete as soon as a token is present.
    if (value) {
      setSubmitting(true);
      // Defer to allow the hidden input value to render.
      requestAnimationFrame(() => formRef.current?.submit());
    }
  }, []);

  const missing = token === "";

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h1>{t("Completing sign-in")}</h1>
        <p>{t("Securely establishing your session, please wait…")}</p>
      </div>

      {missing ? (
        <div className="auth-alert" role="alert" style={{ marginBottom: 14 }}>
          {t("No sign-in token found. Please start sign-in again.")}
        </div>
      ) : (
        <div className="auth-alert ok" style={{ marginBottom: 14 }}>
          {submitting ? t("Establishing session…") : t("Sign-in token is ready.")}
        </div>
      )}

      <form
        ref={formRef}
        action="/auth/finalize/complete"
        method="post"
        className="auth-form"
        onSubmit={() => setSubmitting(true)}
      >
        <input name="token" readOnly type="hidden" value={token ?? ""} />
        <button
          type="submit"
          className="btn primary block"
          disabled={!token || submitting}
        >
          {submitting ? t("Processing…") : t("Complete sign-in")}
        </button>
      </form>

      <div className="auth-foot">
        {t("Having trouble?")}<a href="/auth/sign-in">{t("Sign in again")}</a>
      </div>
    </div>
  );
}
