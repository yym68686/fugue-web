import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@fugue/ui/components/toast";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    noarchive: true,
    nocache: true,
  },
};

export default function NewProjectLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
