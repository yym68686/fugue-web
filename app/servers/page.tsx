import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { NodeKey } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';

export const dynamic = 'force-dynamic';

async function getNodes(): Promise<NodeKey[]> {
  const result = await queryDb<NodeKey>(`
    SELECT fugue_node_key_id, user_email, tenant_id, label, prefix,
           status, source, last_used_at, revoked_at, created_at, updated_at
    FROM app_node_keys
    ORDER BY created_at DESC
  `);
  return result.rows;
}

const sourceLabel: Record<string, string> = {
  managed: '托管',
  external: '自带',
};

function relTime(d: Date | null): string {
  if (!d) return '未上报';
  const diff = Date.now() - new Date(d).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs} 秒前`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

function isOnline(d: Date | null): boolean {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() < 5 * 60 * 1000;
}

export default async function ServersPage() {
  await requireActivePageSession();
  const nodes = await getNodes();
  const active = nodes.filter((n) => n.status === 'active');
  const online = active.filter((n) => isOnline(n.last_used_at)).length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Servers</div>
            <h1>服务器节点</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> {online} 在线
              </span>
              <span>{active.length} 个活跃节点</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              接入节点
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>节点密钥</h3>
            <div className="tail eyebrow">{nodes.length} total</div>
          </div>
          <div className="list">
            {nodes.length === 0 && <div className="empty">暂无接入节点</div>}
            {nodes.map((n) => {
              const revoked = n.status === 'revoked';
              const dotClass = revoked
                ? 'err'
                : isOnline(n.last_used_at)
                  ? 'ok'
                  : 'idle';
              return (
                <div key={n.fugue_node_key_id} className="row-item">
                  <span className={`dot ${dotClass} dot-lead`}></span>
                  <div className="main-col">
                    <div className="nm">
                      {n.label}
                      <span
                        className={`chip ${n.source === 'managed' ? 'run' : 'idle'}`}
                      >
                        {sourceLabel[n.source] || n.source}
                      </span>
                    </div>
                    <div className="id">{n.fugue_node_key_id}</div>
                    <div className="sub">
                      {n.user_email} · 心跳 {relTime(n.last_used_at)}
                    </div>
                  </div>
                  <div className="stats">
                    <span className={`chip ${revoked ? 'err' : 'ok'}`}>
                      {revoked ? '已吊销' : '活跃'}
                    </span>
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
