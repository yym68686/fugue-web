import { FinalizePanel } from "@/components/fugue-coss/interactive";
import { AuthShell } from "@/components/fugue-coss/shells";

export default function FinalizePage() {
  return (
    <AuthShell
      title="Finalize session"
      description="Convert the OAuth or email-link handoff into a Fugue browser session."
    >
      <FinalizePanel />
    </AuthShell>
  );
}
