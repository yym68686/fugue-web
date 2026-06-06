import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";

import "../console.css";
import "../deploy.css";
import "../cloudflare-runtime.css";

export default function NewLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
