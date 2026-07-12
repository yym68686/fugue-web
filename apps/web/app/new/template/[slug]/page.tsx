import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { notFound, redirect } from "next/navigation";
import { NewProjectWizard } from "@/components/deploy/new-project-wizard";
import { NewProjectShell } from "@/components/fugue-coss/shells";
import { CodeBlock } from "@/components/shared/code-block";
import { PageHeader } from "@/components/shared/page-header";
import { normalizeTemplateRouteSlug } from "@/lib/deploy/template-route-slug";
import { getRequestI18n } from "@/lib/i18n/server";
import {
  createNewProjectFormMessages,
  createShellMessages,
} from "@/lib/i18n/ui-messages";

type TemplatePageProps = {
  params: Promise<{ slug: string }> | { slug: string };
};

export default async function TemplateDeployPage({ params }: TemplatePageProps) {
  const [{ slug }, { locale, t }] = await Promise.all([
    Promise.resolve(params),
    getRequestI18n(),
  ]);
  const normalizedSlug = normalizeTemplateRouteSlug(slug);

  if (!normalizedSlug) {
    notFound();
  }

  if (normalizedSlug.redirectPath) {
    redirect(normalizedSlug.redirectPath);
  }

  const canonicalSlug = normalizedSlug.slug;

  return (
    <NewProjectShell activeStep="Configure" messages={createShellMessages(t)}>
      <PageHeader
        eyebrow={t("Template deploy")}
        title={`${t("Deploy")} ${canonicalSlug}`}
        description={t(
          "Template metadata, variables, default runtime, and fugue.yaml topology are reviewed before project creation.",
        )}
      />
      <Alert variant="info" role="status">
        <AlertTitle>{t("Canonical template checked")}</AlertTitle>
        <AlertDescription>
          {t(
            "The template slug is resolved before rendering. Missing metadata falls back to the standard repository import path.",
          )}
        </AlertDescription>
      </Alert>
      <CodeBlock>{`template: ${canonicalSlug}\nservices:\n  web:\n    port: 3000\n    route: public\n  db:\n    type: postgres\n    failover: managed`}</CodeBlock>
      <NewProjectWizard
        locale={locale}
        messages={createNewProjectFormMessages(t)}
        template={canonicalSlug}
      />
    </NewProjectShell>
  );
}
