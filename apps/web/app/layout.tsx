import { fontHeading, fontMono, fontSans } from "@fugue/ui/fonts";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { LocaleSelectProvider } from "@/components/i18n/locale-select";
import { ClientTelemetry } from "@/components/shared/client-telemetry";
import { getDocumentLocaleAttributes } from "@/lib/i18n/core";
import { getRequestI18n } from "@/lib/i18n/server";
import { createClientUiMessages } from "@/lib/i18n/ui-messages";
import { getCanonicalPublicOrigin } from "@/lib/site/metadata";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getCanonicalPublicOrigin()),
  applicationName: "Fugue",
  title: {
    default: "Fugue — Deploy and move applications across runtimes",
    template: "%s | Fugue",
  },
  description:
    "Import an application, run it on a managed runtime, and move it to your own server without changing its route or operating workflow.",
  openGraph: {
    type: "website",
    siteName: "Fugue",
    title: "Fugue — Deploy and move applications across runtimes",
    description:
      "Import an application, run it on a managed runtime, and move it to your own server without changing its route or operating workflow.",
    images: [{ url: "/icon.png", width: 1024, height: 1024, alt: "Fugue" }],
  },
  twitter: {
    card: "summary",
    title: "Fugue — Deploy and move applications across runtimes",
    description:
      "Import an application, run it on a managed runtime, and move it to your own server without changing its route or operating workflow.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17191c" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, localePreference, t } = await getRequestI18n();

  return (
    <html
      {...getDocumentLocaleAttributes(locale, localePreference)}
      className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable}`}
    >
      <body data-app-root>
        <LocaleSelectProvider
          value={{
            initialPreference: localePreference,
            label: t("Interface language"),
            messages: createClientUiMessages(t),
            options: [
              { label: t("Auto"), value: "auto" },
              { label: "English", value: "en" },
              { label: t("Simplified Chinese"), value: "zh-CN" },
              { label: t("Traditional Chinese"), value: "zh-TW" },
            ],
          }}
        >
          {children}
          <ClientTelemetry />
        </LocaleSelectProvider>
      </body>
    </html>
  );
}
