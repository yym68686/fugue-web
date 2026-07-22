import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { FinalizePanel } from "@/components/auth/finalize-panel";

export const metadata: Metadata = {
  title: "完成登录 — Fugue",
};

export default function FinalizePage() {
  return (
    <AuthShell>
      <FinalizePanel />
    </AuthShell>
  );
}
