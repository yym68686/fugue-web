import type { Metadata } from "next";
import Policy from "@/components/landing/policies";

export const metadata: Metadata = { title: "Terms of Service — Fugue", description: "Fugue hosting terms, prepaid billing, refunds and acceptable use." };

export default function TermsPage() {
  return <Policy kind="terms" />;
}
