import type { Locale } from "@/lib/i18n/core";
import { getPublicPriceBook } from "@/lib/billing/public-price-book";
import { MAX_TOPUP_USD, MIN_TOPUP_USD, TOPUP_PRESETS } from "@/lib/billing/topup-options";
import { publicText } from "@/components/landing/public-shell";

export function PricingDetails({ locale }: { locale: Locale }) {
  const text = (en: string, zh: string) => publicText(locale, en, zh);
  const book = getPublicPriceBook();
  const money = (microcents: number, estimate = false) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2,
    maximumFractionDigits: estimate ? 2 : 8,
  }).format(microcents / 100_000_000);

  return <div className="pricing-details">
    <div className="pricing-intro">
      <div>
        <div className="lp-eyebrow">{text("PREPAID HOSTING", "预付费托管")}</div>
        <h2>{text("Start with $5 in credits", "$5 起充值")}</h2>
        <p className="doc-p">{text("Buy credits once. Hosting charges are deducted hourly from your balance. No automatic renewal or automatic top-up.", "一次性购买额度，托管费用逐小时从余额扣除。没有自动续订或自动充值。")}</p>
      </div>
      <div className="pricing-topups">
        <span>{text("Preset credit amounts", "预设充值金额")}</span>
        <div className="pricing-amounts">{TOPUP_PRESETS.map((amount) => <span key={amount}>${amount}</span>)}</div>
        <p>{text(`Custom top-ups: $${MIN_TOPUP_USD}–$${MAX_TOPUP_USD.toLocaleString("en-US")} in whole USD.`, `自定义充值：$${MIN_TOPUP_USD}–$${MAX_TOPUP_USD.toLocaleString("en-US")}，以整数美元为单位。`)}</p>
        <p>{text("These are credit purchases, not monthly plans. Applicable taxes are shown at checkout.", "以上为额度购买金额，不是包月套餐。适用税费在收银台展示。")}</p>
      </div>
    </div>
    {book ? <>
      <h3>{text("Standard managed resource rates", "标准托管资源单价")}</h3>
      <p className="doc-p">{text(`USD · Published ${book.effective_date} · Monthly estimates use ${book.hours_per_month} hours.`, `美元计价 · 公示日期 ${book.effective_date} · 月度估算按 ${book.hours_per_month} 小时计算。`)}</p>
      <div className="pricing-table-wrap">
        <table className="pricing-table">
          <caption className="sr-only">{text("Managed hosting resource prices in USD", "托管资源价格，单位美元")}</caption>
          <thead><tr><th scope="col">{text("Resource", "资源")}</th><th scope="col">{text("Per hour", "每小时")}</th><th scope="col">{text("Monthly estimate", "月度估算")}</th></tr></thead>
          <tbody>{[
            [text("CPU / core", "CPU / 核"), book.cpu_microcents_per_millicore_hour * 1000],
            [text("Memory / GiB", "内存 / GiB"), book.memory_microcents_per_mib_hour * 1024],
            [text("Storage / GiB", "存储 / GiB"), book.storage_microcents_per_gib_hour],
          ].map(([label, rate]) => <tr key={label}><th scope="row">{label}</th><td>{money(Number(rate))}</td><td>{money(Number(rate) * book.hours_per_month)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="doc-note">
        <strong>{text("Example: 2 CPU cores + 4 GiB memory + 30 GiB storage", "示例：2 核 CPU + 4 GiB 内存 + 30 GiB 存储")}</strong>
        <p>{money((book.cpu_microcents_per_millicore_hour * 2000 + book.memory_microcents_per_mib_hour * 4096 + book.storage_microcents_per_gib_hour * 30) * book.hours_per_month, true)} {text("/ month, before taxes and additional billable resources. This is an estimate, not a fixed-price plan.", "/ 月，不含税及额外计费资源。这是估算，并非固定价格套餐。")}</p>
      </div>
    </> : <div className="doc-note" role="status">
      {text("Resource rates are temporarily unavailable. Contact support for current rates before purchasing hosting credits.", "资源单价暂时不可用。购买托管额度前，请联系支持确认当前单价。")}
      {" "}<a href="/support">{text("Contact support", "联系支持")}</a>
    </div>}
    <p className="doc-p">{text("Charges are based on configured resource caps, including reserved capacity while idle, rather than instantaneous CPU or memory utilization. Retained images and other billable storage can add to the total. Separately priced servers use the rates shown when you select them. Check the billing dashboard before allocating resources.", "费用基于配置的资源额度，包括闲置的预留容量，而非瞬时 CPU 或内存利用率。保留镜像及其他计费存储可能增加总费用。单独定价的服务器采用选择时展示的单价。分配资源前，请查看账单控制台。")}</p>
    <p className="doc-p">{text("Credits are delivered to your account after payment confirmation. To stop further charges, release billable resources and reduce your resource caps; stopping an app alone may not end storage or reserved-capacity charges.", "付款确认后，额度将加入您的账户。如需停止后续计费，请释放计费资源并减少资源额度；仅停止应用可能不会终止存储或预留容量费用。")}</p>
    <div className="public-links">
      <a className="btn primary" href="/auth/sign-up">{text("Create account", "创建账号")}</a>
      <a href="/billing">{text("Open billing", "查看账单")}</a>
      <a href="/terms#refunds">{text("Refund policy", "退款说明")}</a>
    </div>
  </div>;
}
