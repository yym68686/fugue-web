import type { ReactNode } from "react";

import { getRequestI18n } from "@/lib/i18n/server";

function BrandMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" strokeLinecap="round" />
      <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

function Feature({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="lp-feature">
      <div className="lp-feature-code">{code}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export default async function Landing() {
  const { t } = await getRequestI18n();
  return (
    <div className="lp">
      <header className="lp-top">
        <a className="lp-brand" href="/">
          <BrandMark />
          <b>fugue</b>
          <span className="lp-badge">CLOUD</span>
        </a>
        <nav className="lp-nav">
          <a href="#how">{t("How it works")}</a>
          <a href="#features">{t("Capabilities")}</a>
          <a href="/docs">{t("Docs")}</a>
          <a className="lp-nav-cta" href="/auth/sign-in">
            {t("Sign in")}
          </a>
        </nav>
      </header>

      <main className="lp-main">
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">Multi-tenant PaaS · on k3s</div>
            <h1>
              {t("Hand your code to Fugue,")}
              <br />
              {t("focus on your ")}<span className="lp-hl">{t("product")}</span>{t(".")}
            </h1>
            <p className="lp-lede">
              {t(
                "Connect a GitHub repository to build and deploy automatically. Built-in multi-tenant isolation, secret management, real-time usage and cluster observability — like conducting a fugue, every service is its own voice.",
              )}
            </p>
            <div className="lp-cta">
              <a className="btn primary block" href="/auth/sign-up">
                {t("Get started free")}
              </a>
              <a className="btn block" href="/auth/sign-in">
                {t("I already have an account")}
              </a>
            </div>
            <div className="lp-trust">
              <span className="dot ok"></span> {t("One-click sign-in with Google / GitHub, or sign up with email")}
            </div>
          </div>

          <aside className="lp-score" aria-hidden="true">
            <div className="lp-score-head">
              <span>the score</span>
              <span className="lp-score-tick">live</span>
            </div>
            <div className="lp-voices">
              <div className="lp-voice">
                <span className="lp-voice-label">api</span>
                <div className="lp-voice-line">
                  <i className="lp-mark ok" style={{ left: "12%" }} />
                  <i className="lp-mark ok" style={{ left: "48%" }} />
                  <i className="lp-mark ok" style={{ left: "82%" }} />
                </div>
              </div>
              <div className="lp-voice">
                <span className="lp-voice-label">web</span>
                <div className="lp-voice-line">
                  <i className="lp-mark ok" style={{ left: "20%" }} />
                  <i className="lp-mark run" style={{ left: "66%" }} />
                </div>
              </div>
              <div className="lp-voice">
                <span className="lp-voice-label">worker</span>
                <div className="lp-voice-line">
                  <i className="lp-mark ok" style={{ left: "8%" }} />
                  <i className="lp-mark ok" style={{ left: "40%" }} />
                  <i className="lp-mark warn" style={{ left: "74%" }} />
                </div>
              </div>
              <div className="lp-voice">
                <span className="lp-voice-label">cron</span>
                <div className="lp-voice-line">
                  <i className="lp-mark ok" style={{ left: "30%" }} />
                  <i className="lp-mark ok" style={{ left: "90%" }} />
                </div>
              </div>
              <div className="lp-playhead" />
            </div>
          </aside>
        </section>

        <section className="lp-how" id="how">
          <div className="lp-step">
            <span className="lp-step-n">01</span>
            <div>
              <h4>{t("Connect a repository")}</h4>
              <p>{t("Authorize GitHub and pick a repository. Fugue reads the branch and prepares the build.")}</p>
            </div>
          </div>
          <div className="lp-step">
            <span className="lp-step-n">02</span>
            <div>
              <h4>{t("Automatic builds")}</h4>
              <p>{t("Every push triggers a build. Dockerfile or buildpack is detected automatically to produce an image.")}</p>
            </div>
          </div>
          <div className="lp-step">
            <span className="lp-step-n">03</span>
            <div>
              <h4>{t("Rolling releases")}</h4>
              <p>{t("Multi-replica rolling releases shift traffic only after health checks pass, with automatic rollback on failure.")}</p>
            </div>
          </div>
        </section>

        <section className="lp-features" id="features">
          <Feature code="TENANT" title={t("Full multi-tenant isolation")}>
            {t("Every workspace has its own tenant, secrets, and usage boundaries, invisible to one another.")}
          </Feature>
          <Feature code="DEPLOY" title={t("From GitHub to production")}>
            {t("github-sync imports automatically, Dockerfile build strategy, replicas roll out to your domain.")}
          </Feature>
          <Feature code="KEYS" title={t("Key and node management")}>
            {t("API keys are authorized by scope, node keys manage the cluster, and secrets stay sealed and encrypted throughout.")}
          </Feature>
          <Feature code="OBSERV" title={t("Real-time usage and billing")}>
            {t("Cluster health, service overview, audit events, and top-up billing, all on one screen.")}
          </Feature>
        </section>

        <section className="lp-final">
          <h2>{t("Ready to deploy?")}</h2>
          <p>{t("From blank to a live service in minutes.")}</p>
          <a className="btn primary" href="/auth/sign-up">
            {t("Create account")}
          </a>
        </section>
      </main>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} Fugue</span>
        <span className="lp-foot-mono">multi-tenant PaaS · k3s</span>
      </footer>
    </div>
  );
}
