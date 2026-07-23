import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { FinalizePanel } from "@/components/auth/finalize-panel";

export const metadata: Metadata = {
  title: "Finish sign-in — Fugue",
};

export default function FinalizePage() {
  return (
    <AuthShell>
      <FinalizePanel />
    </AuthShell>
  );
}
