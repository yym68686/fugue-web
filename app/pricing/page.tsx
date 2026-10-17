import type { Metadata } from "next";
import { PublicPage, publicText } from "@/components/landing/public-shell";
import { PricingDetails } from "@/components/landing/pricing";
import { getRequestI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pricing — Fugue", description: "Prepaid hosting credits from $5. See Fugue's CPU, memory and storage rates and hourly billing explained." };

export default async function PricingPage() {
  const { locale } = await getRequestI18n();
  return <PublicPage locale={locale} title={publicText(locale, "Hosting with clear pricing", "清晰透明的托管价格")}
    intro={publicText(locale, "Choose your resources. See the cost before you deploy.", "选择所需资源，部署前了解费用。") }>
    <PricingDetails locale={locale} />
  </PublicPage>;
}
