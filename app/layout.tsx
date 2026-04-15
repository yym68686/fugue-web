import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { fugueFontVariables } from "@/app/fonts";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getRequestI18n } from "@/lib/i18n/server";
import {
  THEME_COOKIE_NAME,
  buildThemeBootstrapScript,
  parseThemePreference,
  resolveThemePreference,
} from "@/lib/theme";
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
  const cookieStore = await cookies();
  const { locale, localePreference } = await getRequestI18n();
  const themePreference = parseThemePreference(
    cookieStore.get(THEME_COOKIE_NAME)?.value,
  );
  const initialTheme = resolveThemePreference(themePreference);

  return (
    <html
      data-theme={initialTheme}
      data-theme-preference={themePreference}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: buildThemeBootstrapScript(themePreference),
          }}
        />
      </head>
      <body
        className={`${fugueFontVariables} ${initialTheme === "light" ? "fg-theme-light" : "fg-theme-dark"}`}
      >
        <ThemeProvider
          initialPreference={themePreference}
          initialTheme={initialTheme}
        >
          <I18nProvider locale={locale} localePreference={localePreference}>
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
