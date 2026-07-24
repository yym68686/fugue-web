import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import ConnectNodeButton from '@/components/servers/ConnectNodeButton';
import NodeKeyRowActions from '@/components/servers/NodeKeyRowActions';
import { NodeKey } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';
import { getWorkspaceAccessByEmail } from '@/lib/workspace/store';
import { listRuntimes, type FugueRuntimeNode } from '@/lib/fugue/console';

export const dynamic = 'force-dynamic';

// The tenant's own enrolled VPS show up as runtimes of these two types; the rest
// (managed-shared) are fugue's pooled runtimes, not the user's servers.
const OWNED_RUNTIME_TYPES = new Set(['external-owned', 'managed-owned']);

async function getNodeKeys(userEmail: string): Promise<NodeKey[]> {
  // COALESCE(label_override, label): a local rename (label_override) wins over
  // the synced backend label.
  const result = await queryDb<NodeKey>(
    `
    SELECT fugue_node_key_id, user_email, tenant_id,
           COALESCE(label_override, label) AS label, prefix,
           status, source, last_used_at, revoked_at, created_at, updated_at
    FROM app_node_keys
    WHERE user_email = $1
    ORDER BY created_at DESC
  `,
    [userEmail],
  );
  return result.rows;
}

// Fetch the tenant's runtime nodes live from the control plane. Wrapped so a
// backend hiccup degrades to an empty list + inline notice rather than crashing
// the page (which must keep working for node-key management).
async function getNodes(
  userEmail: string,
): Promise<{ nodes: FugueRuntimeNode[]; error: string | null }> {
  try {
    const workspace = await getWorkspaceAccessByEmail(userEmail);
    if (!workspace?.adminKeySecret) return { nodes: [], error: null };
    const { runtimes } = await listRuntimes(workspace.adminKeySecret);
    const nodes = (runtimes ?? []).filter((r) => OWNED_RUNTIME_TYPES.has(r.type));
    return { nodes, error: null };
  } catch (err) {
    return {
      nodes: [],
      error: err instanceof Error ? err.message : 'Failed to load nodes.',
    };
  }
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

function runtimeTypeLabel(t: TranslateFn, type: string): string {
  switch (type) {
    case 'managed-owned':
      return t('Managed');
    case 'external-owned':
      return t('Self-hosted');
    default:
      return type;
  }
}

function relTime(t: TranslateFn, value: Date | string | null): string {
  if (!value) return t('Never reported');
  const diff = Date.now() - new Date(value).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return t('{count}s ago', { count: secs });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t('{count}m ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('{count}h ago', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('{count}d ago', { count: days });
}

function isOnline(value: Date | string | null): boolean {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < 5 * 60 * 1000;
}

export default async function ServersPage() {
  const { session } = await requireActivePageSession();
  const { t } = await getRequestI18n();
  const [keys, { nodes, error: nodesError }] = await Promise.all([
    getNodeKeys(session.email),
    getNodes(session.email),
  ]);
  const onlineNodes = nodes.filter((n) =>
    isOnline(n.last_heartbeat_at ?? n.last_seen_at ?? null),
  ).length;
  const activeKeys = keys.filter((k) => k.status === 'active').length;

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
                {t("{count} online", { count: onlineNodes })}
              </span>
              <span>{t("{count} nodes", { count: nodes.length })}</span>
            </div>
          </div>
          <div className="actions">
            <ConnectNodeButton />
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t("Nodes")}</h3>
            <div className="tail eyebrow">{t("{count} total", { count: nodes.length })}</div>
          </div>
          <div className="list">
            {nodesError && (
              <div className="wb-alert err" style={{ margin: 14 }}>
                {nodesError}
              </div>
            )}
            {!nodesError && nodes.length === 0 && (
              <div className="empty">{t("No nodes connected yet")}</div>
            )}
            {nodes.map((n) => {
              const seen = n.last_heartbeat_at ?? n.last_seen_at ?? null;
              const dotClass = isOnline(seen) ? 'ok' : 'idle';
              const ready = n.status === 'ready' || n.status === 'active';
              return (
                <div key={n.id} className="row-item">
                  <span className={`dot ${dotClass} dot-lead`}></span>
                  <div className="main-col">
                    <div className="nm">
                      {n.name || n.machine_name || n.id}
                      <span className="chip idle">
                        {runtimeTypeLabel(t, n.type)}
                      </span>
                    </div>
                    <div className="id">{n.cluster_node_name || n.id}</div>
                    <div className="sub">
                      {n.status} · {t("heartbeat")} {relTime(t, seen)}
                    </div>
                  </div>
                  <div className="stats">
                    <span className={`chip ${ready ? 'ok' : 'idle'}`}>{n.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t("Node keys")}</h3>
            <div className="tail eyebrow">
              {t("{count} active", { count: activeKeys })}
            </div>
          </div>
          <div className="list">
            {keys.length === 0 && (
              <div className="empty">{t("No node keys yet")}</div>
            )}
            {keys.map((n) => {
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
                    <NodeKeyRowActions
                      keyId={n.fugue_node_key_id}
                      label={n.label}
                      status={revoked ? 'revoked' : 'active'}
                    />
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
