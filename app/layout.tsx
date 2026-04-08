import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fugueFontVariables } from "@/app/fonts";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { getRequestI18n } from "@/lib/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestI18n();

  return {
    title: "Fugue",
    description: t(
      "Fugue deploys GitHub repositories, Docker images, and local uploads on shared infrastructure first, then lets teams move the same app onto their own machine without losing the route.",
    ),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { locale } = await getRequestI18n();

  return (
    <html lang={locale}>
      <body className={`${fugueFontVariables} fg-theme-dark`}>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
