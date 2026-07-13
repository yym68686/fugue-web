import { fontHeading, fontMono, fontSans } from "@fugue/ui/fonts";
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Fugue Console UI fixture",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable}`}
      lang="en"
    >
      <body>
        <main data-app-root>{children}</main>
      </body>
    </html>
  );
}
