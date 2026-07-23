import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { NodeKey } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';

export const dynamic = 'force-dynamic';

async function getNodes(userEmail: string): Promise<NodeKey[]> {
  const result = await queryDb<NodeKey>(
    `
    SELECT fugue_node_key_id, user_email, tenant_id, label, prefix,
           status, source, last_used_at, revoked_at, created_at, updated_at
    FROM app_node_keys
    WHERE user_email = $1
    ORDER BY created_at DESC
  `,
    [userEmail],
  );
  return result.rows;
}

function sourceLabel(t: TranslateFn, source: string): string {
  switch (source) {
    case 'managed':
      return t('Managed');
    case 'external':
      return t('Self-hosted');
    default:
      return source;
  }
}

function relTime(t: TranslateFn, d: Date | null): string {
  if (!d) return t('Never reported');
  const diff = Date.now() - new Date(d).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return t('{count}s ago', { count: secs });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t('{count}m ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('{count}h ago', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('{count}d ago', { count: days });
}

function isOnline(d: Date | null): boolean {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() < 5 * 60 * 1000;
}

export default async function ServersPage() {
  const { session } = await requireActivePageSession();
  const { t } = await getRequestI18n();
  const nodes = await getNodes(session.email);
  const active = nodes.filter((n) => n.status === 'active');
  const online = active.filter((n) => isOnline(n.last_used_at)).length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Servers</div>
            <h1>{t("Server nodes")}</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span>{' '}
                {t("{count} online", { count: online })}
              </span>
              <span>{t("{count} active nodes", { count: active.length })}</span>
            </div>
          </div>
          <div className="actions">
            <button className="btn primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("Connect node")}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t("Node keys")}</h3>
            <div className="tail eyebrow">{t("{count} total", { count: nodes.length })}</div>
          </div>
          <div className="list">
            {nodes.length === 0 && <div className="empty">{t("No connected nodes yet")}</div>}
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
                        {sourceLabel(t, n.source)}
                      </span>
                    </div>
                    <div className="id">{n.fugue_node_key_id}</div>
                    <div className="sub">
                      {n.user_email} · {t("heartbeat")} {relTime(t, n.last_used_at)}
                    </div>
                  </div>
                  <div className="stats">
                    <span className={`chip ${revoked ? 'err' : 'ok'}`}>
                      {revoked ? t('Revoked') : t('Active')}
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
