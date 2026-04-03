import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fugueFontVariables } from "@/app/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fugue",
  description:
    "Fugue deploys GitHub repositories, Docker images, and local uploads on shared infrastructure first, then lets teams move the same app onto their own machine without losing the route.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fugueFontVariables} fg-theme-dark`}>{children}</body>
    </html>
  );
}
