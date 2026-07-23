import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import ProjectWorkbench, {
  type WorkbenchService,
} from '@/components/workbench/ProjectWorkbench';
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
import { fmtBytes, fmtMillicores, fmtDate, fmtStorageUsage } from '@/lib/format';

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
  const seenBackingServices = new Set<string>();
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
      if (seenBackingServices.has(svc.id)) continue;
      seenBackingServices.add(svc.id);
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

  // Sum usage across every service in the project — apps and their backing
  // services (databases) alike — so the header totals match the service cards.
  const usages = services.map((s) =>
    s.kind === 'app' ? s.app.current_resource_usage : s.svc.current_resource_usage,
  );
  const totalCpu = usages.reduce((sum, u) => sum + (u?.cpu_millicores ?? 0), 0);
  const totalMem = usages.reduce((sum, u) => sum + (u?.memory_bytes ?? 0), 0);
  const totalEphemeralStorage = usages.reduce(
    (sum, u) => sum + (u?.ephemeral_storage_bytes ?? 0),
    0,
  );
  const hasPersistentStorageUsed = usages.some(
    (u) => u?.persistent_storage_used_bytes != null,
  );
  const hasPersistentStorageCapacity = usages.some(
    (u) => u?.persistent_storage_capacity_bytes != null,
  );
  const totalPersistentStorageUsed = usages.reduce(
    (sum, u) => sum + (u?.persistent_storage_used_bytes ?? 0),
    0,
  );
  const totalPersistentStorageCapacity = usages.reduce(
    (sum, u) => sum + (u?.persistent_storage_capacity_bytes ?? 0),
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

        <div className="pstat">
          <div className="pstat-item">
            <span className="pstat-k">应用数</span>
            <span className="pstat-v">{apps.length}</span>
          </div>
          <div className="pstat-item">
            <span className="pstat-k">CPU 用量</span>
            <span className="pstat-v">{fmtMillicores(totalCpu)}</span>
          </div>
          <div className="pstat-item">
            <span className="pstat-k">内存用量</span>
            <span className="pstat-v">{fmtBytes(totalMem)}</span>
          </div>
          <div className="pstat-item">
            <span className="pstat-k">持久盘用量</span>
            <span className="pstat-v">
              {fmtStorageUsage(
                hasPersistentStorageUsed ? totalPersistentStorageUsed : undefined,
                hasPersistentStorageCapacity
                  ? totalPersistentStorageCapacity
                  : undefined,
              )}
            </span>
          </div>
          <div className="pstat-item">
            <span className="pstat-k">临时盘用量</span>
            <span className="pstat-v">{fmtBytes(totalEphemeralStorage)}</span>
          </div>
          <div className="pstat-item">
            <span className="pstat-k">镜像占用</span>
            <span className="pstat-v">{fmtBytes(imageBytes)}</span>
          </div>
          <div className="pstat-item">
            <span className="pstat-k">更新于</span>
            <span className="pstat-v">{fmtDate(detail.project?.updated_at)}</span>
          </div>
        </div>

        <ProjectWorkbench
          services={services}
          projectId={detail.project_id}
          projectName={detail.project?.name || projectName}
          projectDescription={detail.project?.description || ''}
          initialServiceId={initialServiceId}
          initialTab={initialTab}
        />
      </div>
    </AppLayout>
  );
}
