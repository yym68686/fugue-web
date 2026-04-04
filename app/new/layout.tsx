import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";

import "../console.css";
import "../deploy.css";

export default function NewLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
