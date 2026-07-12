import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    noarchive: true,
    nocache: true,
  },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
