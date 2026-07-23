import type { ReactNode } from "react";

import { getRequestI18n } from "@/lib/i18n/server";

export async function AuthShell({ children }: { children: ReactNode }) {
  const { t } = await getRequestI18n();
  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <a className="auth-brand" href="/">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" opacity=".55" />
          </svg>
          <span>
            <b>fugue</b>
          </span>
          <span className="badge">CLOUD</span>
        </a>

        <div className="auth-aside-body">
          <div className="eyebrow">Multi-tenant PaaS on k3s</div>
          <h2>{t("Hand your code to Fugue and focus on your product.")}</h2>
          <p>
            {t(
              "Connect a GitHub repo to build and deploy automatically, with built-in multi-tenant isolation, secret management, and usage billing.",
            )}
          </p>
          <div className="auth-points">
            <div className="row">
              <span className="dot ok"></span> {t("One-click deploy from GitHub with automatic builds")}
            </div>
            <div className="row">
              <span className="dot ok"></span> {t("A dedicated tenant and secrets for every workspace")}
            </div>
            <div className="row">
              <span className="dot ok"></span> {t("Real-time usage, billing, and cluster observability")}
            </div>
          </div>
        </div>
      </aside>

      <main className="auth-main">{children}</main>
    </div>
  );
}
