import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import NewProjectWizard from "@/components/projects/NewProjectWizard";
import { requireActivePageSession } from "@/lib/auth/page-access";
import { getCachedWorkspaceAccessByEmail } from "@/lib/server/session-state-cache";
import { listRuntimeTargets, type RuntimeTarget } from "@/lib/fugue/console";

export const dynamic = "force-dynamic";

async function getRuntimes(email: string): Promise<RuntimeTarget[]> {
  const workspace = await getCachedWorkspaceAccessByEmail(email);
  if (!workspace) return [];
  try {
    return await listRuntimeTargets(workspace.adminKeySecret);
  } catch {
    return [];
  }
}

export default async function NewProjectPage() {
  const { session } = await requireActivePageSession();
  const runtimes = await getRuntimes(session.email);

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Projects / New</div>
            <h1>新建项目</h1>
            <div className="meta">
              <span>从 GitHub、容器镜像或源码归档创建项目并部署首个应用</span>
            </div>
          </div>
          <div className="actions">
            <Link className="btn ghost" href="/projects">
              返回项目
            </Link>
          </div>
        </div>

        <NewProjectWizard runtimes={runtimes} />
      </div>
    </AppLayout>
  );
}
