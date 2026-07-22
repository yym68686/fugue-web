import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { ApiKey } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';

export const dynamic = 'force-dynamic';

async function getKeys(): Promise<ApiKey[]> {
  const result = await queryDb<ApiKey>(`
    SELECT fugue_key_id, user_email, tenant_id, label, prefix, scopes,
           status, source, is_workspace_admin, last_used_at,
           disabled_at, deleted_at, created_at, updated_at
    FROM app_api_keys
    WHERE status != 'deleted'
    ORDER BY created_at DESC
  `);
  return result.rows;
}

const statusChip: Record<string, string> = {
  active: 'ok',
  disabled: 'idle',
  deleted: 'err',
};

const statusLabel: Record<string, string> = {
  active: '启用',
  disabled: '已停用',
  deleted: '已删除',
};

const sourceLabel: Record<string, string> = {
  'workspace-admin': '工作空间管理',
  managed: '托管',
  external: '外部',
};

function relTime(d: Date | null): string {
  if (!d) return '从未使用';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

export default async function KeysPage() {
  await requireActivePageSession();
  const keys = await getKeys();
  const activeCount = keys.filter((k) => k.status === 'active').length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Access Keys</div>
            <h1>访问密钥</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> {activeCount} 个启用
              </span>
              <span>{keys.length} 个密钥</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              新建密钥
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>API 密钥</h3>
            <div className="tail eyebrow">{keys.length} total</div>
          </div>
          <div className="list">
            {keys.length === 0 && <div className="empty">暂无密钥</div>}
            {keys.map((k) => (
              <div key={k.fugue_key_id} className="row-item">
                <span
                  className={`dot ${k.status === 'active' ? 'ok' : 'idle'} dot-lead`}
                ></span>
                <div className="main-col">
                  <div className="nm">
                    {k.label}
                    {k.is_workspace_admin && (
                      <span className="chip run">admin</span>
                    )}
                  </div>
                  <div className="id">
                    {k.prefix ? `${k.prefix}••••••••` : k.fugue_key_id}
                  </div>
                  <div className="sub">
                    {k.user_email} · {sourceLabel[k.source] || k.source} ·{' '}
                    {relTime(k.last_used_at)}
                  </div>
                  {k.scopes && k.scopes.length > 0 && (
                    <div className="scopes">
                      {k.scopes.map((s) => (
                        <span key={s} className="scope-tag">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="stats">
                  <span className={`chip ${statusChip[k.status] || 'idle'}`}>
                    {statusLabel[k.status] || k.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
