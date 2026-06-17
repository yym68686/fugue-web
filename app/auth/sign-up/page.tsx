import { AuthPanel } from "@/components/fugue-coss/interactive";
import { AuthShell } from "@/components/fugue-coss/shells";

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your Fugue account"
      description="Create the account first, then continue the saved project or template deployment intent."
    >
      <AuthPanel mode="sign-up" />
    </AuthShell>
  );
}
