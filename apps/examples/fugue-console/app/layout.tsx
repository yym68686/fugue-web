import type { Metadata } from "next";
import { GeistMono } from "@fugue/ui/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "Fugue Console UI fixture",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={GeistMono.variable}>
        <main data-app-root>{children}</main>
      </body>
    </html>
  );
}
