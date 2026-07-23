import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import NewKeyButton from '@/components/keys/NewKeyButton';
import { ApiKey } from '@/lib/types';
import { requireActivePageSession } from '@/lib/auth/page-access';
import { getAuthContext } from '@/lib/fugue/console';
import { sortFugueScopes, WORKSPACE_ADMIN_SCOPES } from '@/lib/fugue/scopes';
import { getWorkspaceAccessByEmail } from '@/lib/workspace/store';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';

export const dynamic = 'force-dynamic';

// Scopes the "New key" modal may offer. A minted key can only carry scopes the
// workspace admin key itself holds — the backend rejects the rest with "cannot
// mint scopes you do not hold". Workspaces provisioned before WORKSPACE_ADMIN_SCOPES
// grew have admin keys with a subset (e.g. 8-11 of 18), so offering the full
// constant made the all-selected default fail. Ask the backend what this key
// actually holds and offer only that (∩ the supported set). Falls back to the
// full constant if the workspace/backend can't be reached, preserving prior
// behavior rather than blocking key creation.
async function resolveGrantableScopes(email: string): Promise<string[]> {
  const supported = sortFugueScopes(WORKSPACE_ADMIN_SCOPES);
  try {
    const workspace = await getWorkspaceAccessByEmail(email);
    if (!workspace?.adminKeySecret) return supported;

    const ctx = await getAuthContext(workspace.adminKeySecret);
    // Platform-admin principals bypass the subset check entirely.
    if (ctx.platformAdmin) return supported;

    const held = new Set(ctx.scopes);
    const grantable = supported.filter((scope) => held.has(scope));
    return grantable.length > 0 ? grantable : supported;
  } catch {
    return supported;
  }
}

async function getKeys(userEmail: string): Promise<ApiKey[]> {
  const result = await queryDb<ApiKey>(
    `
    SELECT fugue_key_id, user_email, tenant_id, label, prefix, scopes,
           status, source, is_workspace_admin, last_used_at,
           disabled_at, deleted_at, created_at, updated_at
    FROM app_api_keys
    WHERE status != 'deleted'
      AND user_email = $1
    ORDER BY created_at DESC
  `,
    [userEmail],
  );
  return result.rows;
}

const statusChip: Record<string, string> = {
  active: 'ok',
  disabled: 'idle',
  deleted: 'err',
};

function statusLabel(t: TranslateFn, status: string): string {
  switch (status) {
    case 'active':
      return t('Enabled');
    case 'disabled':
      return t('Disabled');
    case 'deleted':
      return t('Deleted');
    default:
      return status;
  }
}

function sourceLabel(t: TranslateFn, source: string): string {
  switch (source) {
    case 'workspace-admin':
      return t('Workspace admin');
    case 'managed':
      return t('Managed');
    case 'external':
      return t('External');
    default:
      return source;
  }
}

function relTime(t: TranslateFn, d: Date | null): string {
  if (!d) return t('Never used');
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('Just now');
  if (mins < 60) return t('{count}m ago', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('{count}h ago', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('{count}d ago', { count: days });
}

export default async function KeysPage() {
  const { session } = await requireActivePageSession();
  const { t } = await getRequestI18n();
  const keys = await getKeys(session.email);
  const grantableScopes = await resolveGrantableScopes(session.email);
  const activeCount = keys.filter((k) => k.status === 'active').length;

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Access Keys</div>
            <h1>{t("Access keys")}</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span>{' '}
                {t("{count} enabled", { count: activeCount })}
              </span>
              <span>{t("{count} keys", { count: keys.length })}</span>
            </div>
          </div>
          <div className="actions">
            <NewKeyButton availableScopes={grantableScopes} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t("API keys")}</h3>
            <div className="tail eyebrow">{t("{count} total", { count: keys.length })}</div>
          </div>
          <div className="list">
            {keys.length === 0 && <div className="empty">{t("No keys yet")}</div>}
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
                    {k.user_email} · {sourceLabel(t, k.source)} ·{' '}
                    {relTime(t, k.last_used_at)}
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
                    {statusLabel(t, k.status)}
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
