import type { Metadata } from "next";
import Policy from "@/components/landing/policies";

export const metadata: Metadata = { title: "Privacy Policy — Fugue", description: "How Fugue handles account, hosting, billing and support information." };

export default function PrivacyPage() {
  return <Policy kind="privacy" />;
}
