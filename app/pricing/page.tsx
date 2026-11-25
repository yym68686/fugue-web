import type { Metadata } from "next";
import { PublicPage, publicText } from "@/components/landing/public-shell";
import { PricingDetails } from "@/components/landing/pricing";
import { getRequestI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pricing — Fugue", description: "Prepaid hosting credits from $5. See Fugue's CPU, memory and storage rates and hourly billing explained." };

export default async function PricingPage() {
  const { locale } = await getRequestI18n();
  return <PublicPage locale={locale} title={publicText(locale, "Pricing", "价格")}>
    <PricingDetails locale={locale} />
  </PublicPage>;
}
