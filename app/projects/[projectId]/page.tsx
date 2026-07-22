import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import ProjectWorkbench, {
  type WorkbenchService,
} from '@/components/workbench/ProjectWorkbench';
import ProjectSettings from '@/components/workbench/ProjectSettings';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getCachedWorkspaceAccessByEmail } from '@/lib/server/session-state-cache';
import {
  getConsoleApp,
  getConsoleProject,
  listProjectImageUsage,
  isFugueNotFound,
  type ConsoleAppDetail,
  type ConsoleProjectDetail,
} from '@/lib/fugue/console';
import { fmtBytes, fmtMillicores, fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

type ProjectLoad = {
  detail: ConsoleProjectDetail;
  apps: ConsoleAppDetail[];
  imageBytes: number;
};

async function loadProject(
  email: string,
  projectId: string,
): Promise<ProjectLoad | null> {
  const workspace = await getCachedWorkspaceAccessByEmail(email);
  if (!workspace) return null;

  const key = workspace.adminKeySecret;
  try {
    const [detail, imageUsage] = await Promise.all([
      getConsoleProject(key, projectId),
      listProjectImageUsage(key).catch(() => []),
    ]);
    // Fetch each app's full detail (spec/route/backing services) in parallel.
    const apps = await Promise.all(
      detail.apps.map((a) => getConsoleApp(key, a.id).catch(() => null)),
    );
    const imageBytes =
      imageUsage.find((u) => u.project_id === projectId)?.total_size_bytes ?? 0;
    return {
      detail,
      apps: apps.filter((a): a is ConsoleAppDetail => a !== null),
      imageBytes,
    };
  } catch (error) {
    if (isFugueNotFound(error)) return null;
    throw error;
  }
}

function buildServices(apps: ConsoleAppDetail[]): WorkbenchService[] {
  const services: WorkbenchService[] = [];
  for (const app of apps) {
    services.push({
      kind: 'app',
      id: app.id,
      name: app.name,
      app,
      phase: app.status?.phase,
    });
    for (const svc of app.backing_services ?? []) {
      if (!svc.id) continue;
      services.push({
        kind: 'db',
        id: svc.id,
        name: svc.name || svc.type || 'database',
        svc,
        phase: svc.status,
      });
    }
  }
  return services;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ service?: string; tab?: string }>;
}) {
  const { session } = await requireActivePageSession();
  const { projectId: rawProjectId } = await params;
  const projectId = decodeURIComponent(rawProjectId);
  const { service: initialServiceId, tab: initialTab } = await searchParams;

  const loaded = await loadProject(session.email, projectId);
  if (!loaded) {
    notFound();
  }

  const { detail, apps, imageBytes } = loaded;
  const projectName = detail.project_name || detail.project?.name || projectId;
  const services = buildServices(apps);

  const totalCpu = apps.reduce(
    (sum, a) => sum + (a.current_resource_usage?.cpu_millicores ?? 0),
    0,
  );
  const totalMem = apps.reduce(
    (sum, a) => sum + (a.current_resource_usage?.memory_bytes ?? 0),
    0,
  );
  const totalDisk = apps.reduce(
    (sum, a) => sum + (a.current_resource_usage?.ephemeral_storage_bytes ?? 0),
    0,
  );

  return (
    <AppLayout>
      <div className="page">
        <div className="crumb">
          <Link href="/projects">项目</Link>
          <span> / </span>
          <span>{projectName}</span>
        </div>

        <div className="phead">
          <div>
            <div className="eyebrow">Project</div>
            <h1>{projectName}</h1>
            <div className="meta">
              <span className="mono">{detail.project_id}</span>
              {detail.project?.slug && <span>· {detail.project.slug}</span>}
            </div>
          </div>
          <div className="actions">
            <Link href="/projects" className="btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              返回项目
            </Link>
          </div>
        </div>

        <div className="kv-grid kv-grid-3">
          <div className="kv">
            <div className="kv-k">应用数</div>
            <div className="kv-v">{apps.length}</div>
          </div>
          <div className="kv">
            <div className="kv-k">CPU 用量</div>
            <div className="kv-v">{fmtMillicores(totalCpu)}</div>
          </div>
          <div className="kv">
            <div className="kv-k">内存用量</div>
            <div className="kv-v">{fmtBytes(totalMem)}</div>
          </div>
          <div className="kv">
            <div className="kv-k">磁盘用量</div>
            <div className="kv-v">{fmtBytes(totalDisk)}</div>
          </div>
          <div className="kv">
            <div className="kv-k">镜像占用</div>
            <div className="kv-v">{fmtBytes(imageBytes)}</div>
          </div>
          <div className="kv">
            <div className="kv-k">更新于</div>
            <div className="kv-v">{fmtDate(detail.project?.updated_at)}</div>
          </div>
        </div>

        <ProjectWorkbench
          services={services}
          initialServiceId={initialServiceId}
          initialTab={initialTab}
        />

        <ProjectSettings
          projectId={detail.project_id}
          name={detail.project?.name || projectName}
          description={detail.project?.description || ''}
        />
      </div>
    </AppLayout>
  );
}
