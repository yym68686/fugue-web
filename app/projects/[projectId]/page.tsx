import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getCachedWorkspaceAccessByEmail } from '@/lib/server/session-state-cache';
import {
  getConsoleProject,
  isFugueNotFound,
  type ConsoleApp,
  type ConsoleProjectDetail,
} from '@/lib/fugue/console';

export const dynamic = 'force-dynamic';

function fmtBytes(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return '0';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function fmtMillicores(m: number | undefined): string {
  if (!m || m <= 0) return '0';
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} vCPU`;
  return `${m}m`;
}

function fmtDate(value: string | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PHASE_TONE: Record<string, string> = {
  running: 'ok',
  ready: 'ok',
  deployed: 'ok',
  deploying: 'idle',
  pending: 'idle',
  building: 'idle',
  failed: 'err',
  error: 'err',
  stopped: 'idle',
};

function phaseChipClass(phase: string | undefined): string {
  if (!phase) return 'idle';
  return PHASE_TONE[phase.toLowerCase()] ?? 'idle';
}

function appRouteUrl(app: ConsoleApp): string | null {
  const route = app.route;
  if (!route) return null;
  if (route.url) return route.url;
  if (route.host) return `https://${route.host}${route.path ?? ''}`;
  return null;
}

async function loadProject(
  email: string,
  projectId: string,
): Promise<ConsoleProjectDetail | null> {
  const workspace = await getCachedWorkspaceAccessByEmail(email);
  if (!workspace) return null;

  try {
    return await getConsoleProject(workspace.adminKeySecret, projectId);
  } catch (error) {
    if (isFugueNotFound(error)) return null;
    throw error;
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { session } = await requireActivePageSession();
  const { projectId: rawProjectId } = await params;
  const projectId = decodeURIComponent(rawProjectId);

  const detail = await loadProject(session.email, projectId);
  if (!detail) {
    notFound();
  }

  const projectName = detail.project_name || detail.project?.name || projectId;
  const apps = detail.apps;
  const totalCpu = apps.reduce(
    (sum, a) => sum + (a.current_resource_usage?.cpu_millicores ?? 0),
    0,
  );
  const totalMem = apps.reduce(
    (sum, a) => sum + (a.current_resource_usage?.memory_bytes ?? 0),
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

        {detail.project?.description && (
          <div className="panel">
            <div className="panel-b">{detail.project.description}</div>
          </div>
        )}

        <div className="kv-grid">
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
            <div className="kv-k">更新于</div>
            <div className="kv-v">{fmtDate(detail.project?.updated_at)}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>应用</h3>
            <div className="tail eyebrow">{apps.length} total</div>
          </div>
          <div className="list">
            {apps.length === 0 && <div className="empty">该项目还没有应用</div>}
            {apps.map((app) => {
              const url = appRouteUrl(app);
              return (
                <div key={app.id} className="row-item">
                  <span
                    className={`dot ${phaseChipClass(app.status?.phase)} dot-lead`}
                  ></span>
                  <div className="main-col">
                    <div className="nm">{app.name}</div>
                    <div className="id">{app.id}</div>
                    {url && (
                      <div className="sub">
                        <a href={url} target="_blank" rel="noreferrer">
                          {url.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {app.status?.last_message && (
                      <div className="sub">{app.status.last_message}</div>
                    )}
                  </div>
                  <div className="stats">
                    {typeof app.status?.current_replicas === 'number' && (
                      <span className="chip idle">
                        {app.status.current_replicas} 副本
                      </span>
                    )}
                    {app.status?.phase && (
                      <span className={`chip ${phaseChipClass(app.status.phase)}`}>
                        {app.status.phase}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
