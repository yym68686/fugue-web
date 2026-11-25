import { PublicHeader, PublicFooter, publicText } from "@/components/landing/public-shell";
import { getRequestI18n } from "@/lib/i18n/server";

export default async function Landing() {
  const { locale } = await getRequestI18n();
  const text = (en: string, zh: string) => publicText(locale, en, zh);
  return (
    <div className="lp">
      <PublicHeader locale={locale} />
      <main className="lp-main landing-main">
        <h1>Fugue</h1>
        <a className="btn primary" href="/auth/sign-up">{text("Create account", "创建账号")}</a>
        <nav className="landing-tasks" aria-label={text("Resources", "资源")}>
          <a href="/docs#deploy">{text("Deploy a service", "部署服务")}</a>
          <a href="/docs#nodes">{text("Connect a server", "接入服务器")}</a>
          <a href="/pricing">{text("View pricing", "查看价格")}</a>
        </nav>
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
