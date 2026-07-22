import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Fugue — 账号",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
