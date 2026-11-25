import { notFound } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import TemplateDeploy from "@/components/templates/TemplateDeploy";
import { getProjectTemplate } from "@/lib/templates/store";

export const dynamic = "force-dynamic";
export default async function TemplatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const template = await getProjectTemplate(token); if (!template) notFound();
  return <AppLayout><div className="page"><div className="phead"><h1>{template.name}</h1></div><TemplateDeploy token={token} template={template} /></div></AppLayout>;
}
