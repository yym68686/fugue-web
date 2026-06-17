import { redirect } from "next/navigation";

import { Alert, CodeBlock, PageHeader } from "@/components/coss/ui";
import { NewProjectWizard } from "@/components/fugue-coss/interactive";
import { NewProjectShell } from "@/components/fugue-coss/shells";

type TemplatePageProps = {
  params: Promise<{ slug: string }> | { slug: string };
};

export default async function TemplateDeployPage({ params }: TemplatePageProps) {
  const { slug } = await Promise.resolve(params);
  const canonicalSlug = slug.trim().toLowerCase();

  if (slug !== canonicalSlug) {
    redirect(`/new/template/${canonicalSlug}`);
  }

  return (
    <NewProjectShell activeStep="Configure">
      <PageHeader
        eyebrow="Template deploy"
        title={`Deploy ${canonicalSlug}`}
        description="Template metadata, variables, default runtime, and fugue.yaml topology are reviewed before project creation."
      />
      <Alert tone="info" title="Canonical template checked">
        The template slug is resolved before rendering. Missing metadata falls back to the standard repository import path.
      </Alert>
      <CodeBlock>{`template: ${canonicalSlug}\nservices:\n  web:\n    port: 3000\n    route: public\n  db:\n    type: postgres\n    failover: managed`}</CodeBlock>
      <NewProjectWizard template={canonicalSlug} />
    </NewProjectShell>
  );
}
