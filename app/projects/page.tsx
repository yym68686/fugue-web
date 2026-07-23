import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import TechLogo from '@/components/TechLogo';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getCachedWorkspaceAccessByEmail } from '@/lib/server/session-state-cache';
import {
  listConsoleGallery,
  listAppsWithUsage,
  listProjectImageUsage,
  rollupProjectResources,
  type ConsoleProjectSummary,
  type ProjectResourceRollup,
} from '@/lib/fugue/console';
import { fmtBytes, fmtMillicores } from '@/lib/format';

export const dynamic = 'force-dynamic';

type ProjectsData = {
  hasWorkspace: boolean;
  projects: ConsoleProjectSummary[];
  resources: Map<string, ProjectResourceRollup>;
  loadError: boolean;
};

async function getProjectsData(email: string): Promise<ProjectsData> {
  const workspace = await getCachedWorkspaceAccessByEmail(email);
  if (!workspace) {
    return { hasWorkspace: false, projects: [], resources: new Map(), loadError: false };
  }

  const key = workspace.adminKeySecret;
  try {
    const [projects, apps, imageUsage] = await Promise.all([
      listConsoleGallery(key),
      listAppsWithUsage(key).catch(() => []),
      listProjectImageUsage(key).catch(() => []),
    ]);
    const resources = rollupProjectResources(apps, imageUsage);
    return { hasWorkspace: true, projects, resources, loadError: false };
  } catch {
    return { hasWorkspace: true, projects: [], resources: new Map(), loadError: true };
  }
}

// Map the backend lifecycle tone to a chip/dot color class.
function toneClass(tone: string | undefined, live: boolean | undefined): string {
  switch ((tone || '').toLowerCase()) {
    case 'positive':
      return live ? 'run' : 'ok';
    case 'warning':
      return 'warn';
    case 'danger':
      return 'err';
    case 'info':
      return 'run';
    default:
      return 'idle';
  }
}

export default async function ProjectsPage() {
  const { session } = await requireActivePageSession();
  const { hasWorkspace, projects, resources, loadError } = await getProjectsData(
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
            <Link href="/projects/new" className="btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建项目
            </Link>
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
            {projects.map((p) => {
              const res = resources.get(p.id);
              const tone = toneClass(p.lifecycle?.tone, p.lifecycle?.live);
              return (
                <Link
                  key={p.id}
                  href={`/projects/${encodeURIComponent(p.id)}`}
                  className="proj-card"
                >
                  <div className="proj-card-h">
                    <span className={`dot ${tone}`}></span>
                    <div className="proj-card-title">
                      <div className="nm">{p.name}</div>
                      <div className="id">{p.id}</div>
                    </div>
                    {p.lifecycle?.label && (
                      <span className={`chip ${tone}`}>{p.lifecycle.label}</span>
                    )}
                  </div>
                  <div className="proj-card-stats">
                    <div className="stat">
                      <div className="stat-v">{fmtMillicores(res?.cpu_millicores)}</div>
                      <div className="stat-k">CPU</div>
                    </div>
                    <div className="stat">
                      <div className="stat-v">{fmtBytes(res?.memory_bytes)}</div>
                      <div className="stat-k">内存</div>
                    </div>
                    <div className="stat">
                      <div className="stat-v">
                        {fmtBytes(res?.ephemeral_storage_bytes)}
                      </div>
                      <div className="stat-k">磁盘</div>
                    </div>
                    <div className="stat">
                      <div className="stat-v">{fmtBytes(res?.image_total_bytes)}</div>
                      <div className="stat-k">镜像</div>
                    </div>
                  </div>
                  <div className="proj-card-foot">
                    <div className="proj-card-counts">
                      <span>{p.app_count} 应用</span>
                      <span>·</span>
                      <span>{p.service_count} 服务</span>
                    </div>
                    {p.service_badges?.length > 0 && (
                      <div className="proj-card-logos">
                        {p.service_badges.slice(0, 5).map((b, i) => (
                          <TechLogo key={`${b.kind}-${i}`} kind={b.kind} label={b.label} />
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
