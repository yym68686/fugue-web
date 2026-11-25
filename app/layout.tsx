import type { Metadata } from "next";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "./visual-system.css";
import {
  THEME_COOKIE_NAME,
  buildThemeBootstrapScript,
  parseThemePreference,
} from "@/lib/theme";
import { getRequestI18n } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Fugue — Control plane",
  description: "Fugue PaaS control panel",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const preference = parseThemePreference(
    cookieStore.get(THEME_COOKIE_NAME)?.value,
  );
  const { locale } = await getRequestI18n();

  return (
    <html lang={locale} className={`h-full ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: buildThemeBootstrapScript(preference),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
