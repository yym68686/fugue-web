import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { Workspace } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';

export const dynamic = 'force-dynamic';

async function getWorkspaces(): Promise<Workspace[]> {
  const result = await queryDb<Workspace>(`
    SELECT
      user_email,
      tenant_id,
      tenant_name,
      default_project_id,
      default_project_name,
      first_app_id,
      admin_key_id,
      admin_key_label,
      admin_key_prefix,
      admin_key_scopes,
      created_at,
      updated_at
    FROM app_workspaces
    ORDER BY created_at DESC
  `);
  return result.rows;
}

export default async function ProjectsPage() {
  await requireActivePageSession();
  const workspaces = await getWorkspaces();

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Projects</div>
            <h1>工作空间</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> {workspaces.length} 个租户
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

        <div className="panel">
          <div className="panel-h">
            <h3>所有工作空间</h3>
            <div className="tail eyebrow">{workspaces.length} total</div>
          </div>
          <div className="list">
            {workspaces.length === 0 && (
              <div className="empty">暂无工作空间</div>
            )}
            {workspaces.map((ws) => (
              <div key={ws.tenant_id} className="row-item">
                <span className="dot ok dot-lead"></span>
                <div className="main-col">
                  <div className="nm">{ws.tenant_name}</div>
                  <div className="id">{ws.tenant_id}</div>
                  <div className="sub">
                    {ws.user_email} · 创建于{' '}
                    {new Date(ws.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <div className="stats">
                  {ws.default_project_name ? (
                    <span className="chip idle">{ws.default_project_name}</span>
                  ) : (
                    <span className="chip idle">未设默认项目</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
