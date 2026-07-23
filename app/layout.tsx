import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
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
    <html lang={locale} className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: buildThemeBootstrapScript(preference),
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
