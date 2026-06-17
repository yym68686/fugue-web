import { AuthPanel } from "@/components/fugue-coss/interactive";
import { AuthShell } from "@/components/fugue-coss/shells";

export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in to Fugue"
      description="Provider auth, password auth, and email link auth all preserve the requested return destination."
    >
      <AuthPanel mode="sign-in" />
    </AuthShell>
  );
}
