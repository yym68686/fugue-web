import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getCachedWorkspaceAccessByEmail } from '@/lib/server/session-state-cache';
import {
  listConsoleGallery,
  type ConsoleProjectSummary,
} from '@/lib/fugue/console';

export const dynamic = 'force-dynamic';

type ProjectsData = {
  hasWorkspace: boolean;
  projects: ConsoleProjectSummary[];
  loadError: boolean;
};

async function getProjectsData(email: string): Promise<ProjectsData> {
  const workspace = await getCachedWorkspaceAccessByEmail(email);
  if (!workspace) {
    return { hasWorkspace: false, projects: [], loadError: false };
  }

  try {
    const projects = await listConsoleGallery(workspace.adminKeySecret);
    return { hasWorkspace: true, projects, loadError: false };
  } catch {
    return { hasWorkspace: true, projects: [], loadError: true };
  }
}

function fmtMillicores(m: number | undefined): string {
  if (!m || m <= 0) return '0';
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} vCPU`;
  return `${m}m`;
}

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

export default async function ProjectsPage() {
  const { session } = await requireActivePageSession();
  const { hasWorkspace, projects, loadError } = await getProjectsData(
    session.email,
  );

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Projects</div>
            <h1>项目</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> {projects.length} 个项目
              </span>
            </div>
          </div>
          <div className="actions">
            <button className="btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建项目
            </button>
          </div>
        </div>

        {!hasWorkspace && (
          <div className="panel">
            <div className="empty">尚未创建工作空间</div>
          </div>
        )}

        {hasWorkspace && loadError && (
          <div className="panel">
            <div className="empty">暂时无法加载项目，请稍后重试</div>
          </div>
        )}

        {hasWorkspace && !loadError && (
          <div className="proj-grid">
            {projects.length === 0 && (
              <div className="panel">
                <div className="empty">还没有项目，点击「新建项目」开始</div>
              </div>
            )}
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${encodeURIComponent(p.id)}`}
                className="proj-card"
              >
                <div className="proj-card-h">
                  <span
                    className={`dot ${p.lifecycle?.live ? 'ok' : 'idle'}`}
                  ></span>
                  <div className="proj-card-title">
                    <div className="nm">{p.name}</div>
                    <div className="id">{p.id}</div>
                  </div>
                  {p.lifecycle?.label && (
                    <span
                      className={`chip ${p.lifecycle.live ? 'ok' : 'idle'}`}
                    >
                      {p.lifecycle.label}
                    </span>
                  )}
                </div>
                <div className="proj-card-stats">
                  <div className="stat">
                    <div className="stat-v">{p.app_count}</div>
                    <div className="stat-k">应用</div>
                  </div>
                  <div className="stat">
                    <div className="stat-v">{p.service_count}</div>
                    <div className="stat-k">服务</div>
                  </div>
                  <div className="stat">
                    <div className="stat-v">
                      {fmtMillicores(p.resource_usage_snapshot?.cpu_millicores)}
                    </div>
                    <div className="stat-k">CPU</div>
                  </div>
                  <div className="stat">
                    <div className="stat-v">
                      {fmtBytes(p.resource_usage_snapshot?.memory_bytes)}
                    </div>
                    <div className="stat-k">内存</div>
                  </div>
                </div>
                {p.service_badges?.length > 0 && (
                  <div className="proj-card-badges">
                    {p.service_badges.slice(0, 4).map((b, i) => (
                      <span key={`${b.kind}-${i}`} className="chip idle">
                        {b.label}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
