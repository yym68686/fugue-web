import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import NewProjectWizard from "@/components/projects/NewProjectWizard";
import { requireActivePageSession } from "@/lib/auth/page-access";
import { getCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";
import { deploymentTargets } from "@/lib/fugue/runtime-management";
import { getRequestI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

async function getRuntimes(email: string) {
  const workspace = await getCachedWorkspaceAccessByEmail(email);
  if (!workspace)
    return { runtimes: [], error: "Your workspace is not ready yet." };
  try {
    return {
      runtimes: await deploymentTargets(
        workspace.adminKeySecret,
        workspace.tenantId,
      ),
    };
  } catch {
    return {
      runtimes: [],
      error:
        "Server inventory is unavailable. Auto-assign will use the backend's default placement.",
    };
  }
}

export default async function NewProjectPage() {
  const { session } = await requireActivePageSession();
  const { t } = await getRequestI18n();
  const { runtimes, error } = await getRuntimes(session.email);

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Projects / New</div>
            <h1>{t("New project")}</h1>
            <div className="meta">
              <span>
                {t(
                  "Create a project from GitHub, a container image, or a source archive and deploy your first app",
                )}
              </span>
            </div>
          </div>
          <div className="actions">
            <Link className="btn ghost" href="/projects">
              {t("Back to projects")}
            </Link>
          </div>
        </div>

        <NewProjectWizard runtimes={runtimes} runtimeError={error} />
      </div>
    </AppLayout>
  );
}
