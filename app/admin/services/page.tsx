import { queryDb } from '@/lib/db/pool';
import AppLayout from '@/components/AppLayout';
import { PlatformOverview, AuditEvent } from '@/lib/types';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import { getRequestI18n } from '@/lib/i18n/server';
import type { TranslateFn } from '@/lib/i18n/translate';

export const dynamic = 'force-dynamic';

async function getOverview(): Promise<PlatformOverview | null> {
  const result = await queryDb<{ payload: PlatformOverview }>(
    `SELECT payload FROM app_admin_snapshots WHERE key = 'platform_overview'`
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].payload as PlatformOverview;
}

async function getAuditEvents(): Promise<AuditEvent[]> {
  const result = await queryDb<AuditEvent>(`
    SELECT id, action, actor_email, target_email, metadata, created_at
    FROM app_security_audit_events
    ORDER BY created_at DESC
    LIMIT 20
  `);
  return result.rows;
}

function fmtMoney(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    cents / 100
  );
}

function relTime(d: Date, t: TranslateFn): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{mins} min ago', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('{hrs} hr ago', { hrs });
  const days = Math.floor(hrs / 24);
  return t('{days} days ago', { days });
}

// Backend audit-action types → English label key + chip tone. Labels are
// resolved through t() at render time.
const actionMeta: Record<string, { label: string; kind: string }> = {
  'user.login': { label: 'User sign-in', kind: 'deploy' },
  'apikey.create': { label: 'Key created', kind: 'deploy' },
  'apikey.revoke': { label: 'Key revoked', kind: 'incident' },
  'node.attach': { label: 'Node attached', kind: 'deploy' },
  'billing.topup': { label: 'Account top-up', kind: 'restart' },
};

export default async function AdminServicesPage() {
  await requireActiveAdminPageSession();
  const { t } = await getRequestI18n();
  const overview = await getOverview();
  const events = await getAuditEvents();

  return (
    <AppLayout>
      <div className="page">
        <div className="phead">
          <div>
            <div className="eyebrow">Platform · Services</div>
            <h1>{t('Services & operations')}</h1>
            <div className="meta">
              <span>
                <span className="dot ok"></span> {t('Control plane running')}
              </span>
              <span>{t('Platform snapshot · live')}</span>
            </div>
          </div>
        </div>

        <div className="kpi-row">
          <div className="kpi">
            <div className="k">{t('Users')}</div>
            <div className="v">{overview?.totals.users ?? '—'}</div>
            <div className="d">{t('Total registered')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Workspaces')}</div>
            <div className="v">{overview?.totals.workspaces ?? '—'}</div>
            <div className="d">{t('Tenants')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('API keys')}</div>
            <div className="v">{overview?.totals.apiKeys ?? '—'}</div>
            <div className="d">{t('Issued')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Active nodes')}</div>
            <div className="v">
              {overview?.totals.activeNodes ?? '—'}
              <small> / {overview?.totals.nodeKeys ?? '—'}</small>
            </div>
            <div className="d up">{t('Online')}</div>
          </div>
          <div className="kpi">
            <div className="k">{t('Revenue (last 30d)')}</div>
            <div className="v">
              {overview ? fmtMoney(overview.revenue.last30dCents, overview.revenue.currency) : '—'}
            </div>
            <div className="d up">{t('All-time {amount}', { amount: overview ? fmtMoney(overview.revenue.allTimeCents, overview.revenue.currency) : '—' })}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>{t('Security audit stream')}</h3>
            <span className="eyebrow" style={{ letterSpacing: '.1em' }}>
              {t('Platform-wide · recent events')}
            </span>
            <div className="tail">
              <span className="chip run">
                <span className="dot run"></span>{t('Live')}
              </span>
            </div>
          </div>
          <div className="feed">
            {events.length === 0 && <div className="empty">{t('No audit events')}</div>}
            {events.map((ev) => {
              const meta = actionMeta[ev.action] || {
                label: ev.action,
                kind: 'deploy',
              };
              return (
                <div key={ev.id} className={`ev ${meta.kind}`}>
                  <span className="ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3l9 16H3z" />
                      <path d="M12 10v4M12 17v.01" />
                    </svg>
                  </span>
                  <div className="body">
                    <div className="hd">
                      <span className="svc">{t(meta.label)}</span>
                      <span className="act mono">{ev.action}</span>
                    </div>
                    <div className="sub">
                      {ev.actor_email || t('System')}
                      {ev.target_email && ev.target_email !== ev.actor_email
                        ? ` → ${ev.target_email}`
                        : ''}
                    </div>
                  </div>
                  <span className="when">{relTime(ev.created_at, t)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
