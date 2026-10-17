import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/core";

export const SUPPORT_EMAIL = "support@fugue.pro";

export function publicText(locale: Locale, en: string, zh: string) {
  return locale === "zh-CN" ? zh : en;
}

export function PublicHeader({ locale, home = false }: { locale: Locale; home?: boolean }) {
  const text = (en: string, zh: string) => publicText(locale, en, zh);
  return (
    <header className="lp-top">
      <a className="lp-brand" href="/" aria-label={text("Fugue home", "Fugue 首页")}>
        <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <path d="M2 8 H14" stroke="#326CE5" strokeWidth="2" />
          <path d="M8 13 H24" stroke="#7DA8F5" strokeWidth="2" />
          <path d="M2 18 H18" stroke="#326CE5" strokeWidth="2" opacity=".55" />
        </svg>
        <b>fugue</b><span className="lp-badge">CLOUD</span>
      </a>
      <nav className="lp-nav" aria-label={text("Main navigation", "主导航")}>
        {home && <a href="#how">{text("How it works", "工作原理")}</a>}
        <a href="/pricing">{text("Pricing", "价格")}</a>
        <a href="/docs">{text("Docs", "文档")}</a>
        <a href="/support">{text("Support", "支持")}</a>
        <a className="lp-nav-cta" href="/auth/sign-in">{text("Sign in", "登录")}</a>
      </nav>
    </header>
  );
}

export function PublicFooter({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const text = (en: string, zh: string) => publicText(locale, en, zh);
  return (
    <footer className={compact ? "public-footer console-footer" : "public-footer lp-foot"}>
      <span>© {new Date().getFullYear()} Fugue</span>
      <nav aria-label={text("Pricing, policies and support", "价格、政策与支持")}>
        <a href="/pricing">{text("Pricing", "价格")}</a>
        <a href="/privacy">{text("Privacy Policy", "隐私政策")}</a>
        <a href="/terms">{text("Terms of Service", "服务条款")}</a>
        <a href="/terms#refunds">{text("Refunds", "退款说明")}</a>
        <a href="/support">{text("Support", "支持")}</a>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </nav>
    </footer>
  );
}

export function PublicPage({ locale, title, intro, children }: {
  locale: Locale; title: string; intro: string; children: ReactNode;
}) {
  return (
    <div className="lp">
      <PublicHeader locale={locale} />
      <main className="lp-main doc-main public-main">
        <div className="doc-hero"><h1>{title}</h1><p className="lp-lede">{intro}</p></div>
        {children}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
