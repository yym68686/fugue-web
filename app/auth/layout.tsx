import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { I18nProvider } from "@/lib/i18n/client";
import { getRequestI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Fugue — Account",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { locale, preference } = await getRequestI18n();
  return (
    <I18nProvider locale={locale} preference={preference}>
      {children}
    </I18nProvider>
  );
}
