import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, Manrope, Syne } from "next/font/google";

import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-fugue-heading",
  weight: ["500", "600", "700", "800"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-fugue-body",
  weight: ["400", "500", "600", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-fugue-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Fugue",
  description:
    "Fugue v8 landing page with Google sign-in, verified email access, and a protected control shell behind the public route.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${syne.variable} ${manrope.variable} ${ibmPlexMono.variable} fg-theme-dark`}>
        {children}
      </body>
    </html>
  );
}
