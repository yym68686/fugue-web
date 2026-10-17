import type { Metadata } from "next";
import { PublicPage, publicText, SUPPORT_EMAIL } from "@/components/landing/public-shell";
import { getRequestI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Support — Fugue", description: "Contact Fugue for product help, billing questions, refunds and privacy requests." };

export default async function SupportPage() {
  const { locale } = await getRequestI18n();
  const text = (en: string, zh: string) => publicText(locale, en, zh);
  return <PublicPage locale={locale} title={text("How can we help?", "需要什么帮助？")}
    intro={text("Contact the Fugue operator for product help, billing questions or privacy requests.", "如需产品帮助、账单支持或提出隐私请求，请联系 Fugue 运营者。") }>
    <section className="support-card">
      <h2>{text("Email support", "邮件支持")}</h2>
      <a className="support-email" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      <p className="doc-p">{text("Include your account email, the affected project or application, and a short description of the issue. For payments, include your order reference and purchase date. Never send passwords, API keys or full card details.", "请提供账户邮箱、相关项目或应用，以及问题的简要描述。支付问题请附上订单编号与购买日期。请勿发送密码、API 密钥或完整银行卡信息。")}</p>
    </section>
    <nav className="doc-toc" aria-label={text("Help and policies", "帮助与政策")}>
      <a href="/docs">{text("Deployment documentation", "部署文档")}</a>
      <a href="/pricing">{text("Pricing and billing", "价格与计费")}</a>
      <a href="/terms#refunds">{text("Refund requests", "退款申请")}</a>
      <a href="/privacy#rights">{text("Privacy and account deletion", "隐私与账户删除")}</a>
    </nav>
  </PublicPage>;
}
