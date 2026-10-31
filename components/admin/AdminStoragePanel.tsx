'use client';

import { useState } from 'react';
import type { AdminStorageOverview } from '@/lib/fugue/console';
import { measuredStorageBytes, storageBytes } from '@/lib/admin/storage';
import { useI18n } from '@/lib/i18n/client';
import './admin-storage.css';

export default function AdminStoragePanel({ initial }: { initial: AdminStorageOverview | null }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial ? '' : 'Storage inventory unavailable.');
  const [bucket, setBucket] = useState('');
  const [state, setState] = useState('');
  const date = (value?: string) => value ? new Date(value).toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', { timeZone: 'Asia/Shanghai' }) : '—';

  async function refresh() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/storage', { cache: 'no-store' });
      if (!response.ok) throw new Error('Storage inventory unavailable.');
      const body: { result: AdminStorageOverview } = await response.json();
      setData(body.result);
    } catch { setError('Storage inventory unavailable.'); }
    finally { setBusy(false); }
  }

  const namespaces = data?.namespaces.filter(row => !bucket || row.bucket === bucket) ?? [];
  const entries = data?.longhorn.filter(row => !state || row.cleanup_state === state) ?? [];
  const states = [...new Set(data?.longhorn.map(row => row.cleanup_state) ?? [])].sort();

  return <div className="page admin-storage-page">
    <div className="phead"><div><div className="eyebrow">PLATFORM · R2 / S3</div><h1>{t('Platform object storage')}</h1><p className="muted">{t('Read-only account inventory, namespace ownership and engine cleanup reconciliation.')}</p></div><button className="btn" disabled={busy} onClick={() => void refresh()}>{t(busy ? 'Loading…' : 'Refresh inventory')}</button></div>
    {error && <div className="panel storage-warning" role="alert">{t(error)}</div>}
    {data && <>
      <p className="muted">{t('Observed at')} {date(data.observed_at)} (UTC+8) · {t('Account')} {data.account_id || '—'}</p>
      <div className="admin-storage-summary">
        <div className="panel"><span>{t('Provider buckets')}</span><strong>{data.buckets.length}</strong><small>{t(data.buckets_complete ? 'Complete inventory' : 'Partial inventory')}</small></div>
        <div className="panel"><span>{t('Configured namespaces')}</span><strong>{data.namespaces.length}</strong><small>{t('Configuration is not measured usage.')}</small></div>
        <div className="panel"><span>{t('Longhorn reconciliation')}</span><strong>{data.longhorn.filter(row => row.cleanup_state === 'confirmed').length} / {data.longhorn.length}</strong><small>{t('Confirmed removed / inspected records')} · {t(data.longhorn_complete ? 'Complete inventory' : 'Partial inventory')}</small></div>
      </div>
      <section className="panel admin-storage-section"><h2>{t('Costs and measurement boundaries')}</h2><p>{t('No live invoice or request-cost integration. Unknown costs are not zero. Refresh does not scan all objects.')}</p><p className="muted">{t('Metrics')}: {data.metrics_status}<br />{t('Billing')}: {data.billing_status}</p><p className="muted">{t('Longhorn snapshots share blocks; snapshot sizes must not be added to estimate R2 bytes.')}</p></section>
      {data.backup_usage && <section className="panel admin-storage-section"><h2>{t('Cached backup namespace usage')}</h2><p className="muted">{t('Backup namespaces only, not the account total. Measurements can predate cleanup.')}</p><div className="admin-storage-summary"><div><span>{t('Physical object bytes')}</span><strong>{storageBytes(data.backup_usage.physical_bytes ?? null)}</strong><small>{data.backup_usage.physical_object_count?.toLocaleString() ?? '—'} {t('objects')}</small></div><div><span>{t('Engine-managed shared repositories')}</span><strong>{storageBytes(data.backup_usage.reconciliation?.repository_managed_bytes ?? null)}</strong><small>{data.backup_usage.reconciliation?.status || '—'}</small></div><div><span>{t('Last successful scan')}</span><strong className="storage-scan-time">{date(data.backup_usage.reconciliation?.last_success_at)}</strong><small>{data.backup_usage.reconciliation?.stale ? t('Stale measurement') : t('Observed at')} · {date(data.backup_usage.reconciliation?.observed_at)}</small></div></div></section>}
      {data.warnings.length > 0 && <section className="panel storage-warning"><h2>{t('Source warnings')}</h2><ul>{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section>}
      <section className="panel admin-storage-section"><div className="admin-storage-heading"><h2>{t('Buckets and namespace ownership')}</h2><label>{t('Bucket')}<select value={bucket} onChange={event => setBucket(event.target.value)}><option value="">{t('All buckets')}</option>{data.buckets.map(row => <option key={row.name}>{row.name}</option>)}</select></label></div>
        <details><summary>{t('Provider bucket inventory')}</summary><ul>{data.buckets.map(row => <li key={row.name}><code>{row.name}</code> · {t(row.source === 'provider' ? 'Provider observed' : 'Configuration only')}</li>)}</ul></details>
        <div className="admin-storage-table"><table><thead><tr>{['Kind / name', 'Bucket / prefix', 'Tenant / project', 'Status', 'Measured usage', 'Measured at'].map(label => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>{namespaces.map(row => <tr key={`${row.kind}/${row.resource_id}`}><td><strong>{row.name}</strong><small>{row.kind} · {row.resource_id}</small></td><td><code>{row.bucket}</code><small>{row.prefix || '/'}</small></td><td>{row.tenant_id || t('Platform')}<small>{row.project_id || '—'}</small></td><td>{row.status}</td><td>{storageBytes(measuredStorageBytes(row))}<small>{row.measured_at && row.object_count !== undefined ? `${row.object_count.toLocaleString()} ${t('objects')}` : t('Not measured')}</small></td><td>{date(row.measured_at)}{row.stale && row.measured_at && <small className="storage-stale">{t('Stale measurement')}</small>}</td></tr>)}</tbody></table></div>
        {namespaces.length === 0 && <p className="muted">{t('No matching namespaces.')}</p>}
      </section>
      <section className="panel admin-storage-section"><div className="admin-storage-heading"><h2>{t('Longhorn retention and historical receipts')}</h2><label>{t('Cleanup state')}<select value={state} onChange={event => setState(event.target.value)}><option value="">{t('All states')}</option>{states.map(value => <option key={value} value={value}>{t(`cleanup.${value}`)}</option>)}</select></label></div>
        <p className="muted">{t('Only expired or deleted, unprotected artifacts are collected after the grace period. Longhorn owns remote deletion and shared-block reclamation. Untracked backups are never automatically removed.')}</p>
        <div className="admin-storage-table"><table><thead><tr>{['Remote backup / volume', 'Artifact / run', 'Logical status', 'Cleanup state', 'Engine / last attempt'].map(label => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>{entries.map((row, index) => <tr key={`${row.artifact_id}/${row.backup_name}/${index}`}><td><code>{row.backup_name || '—'}</code><small>{row.volume_name} · {row.target_name}</small></td><td>{row.artifact_id || t('Untracked')}<small>{row.run_id || '—'}</small></td><td>{row.status}{row.protected && <small>{t('Protected')}</small>}</td><td><span className={`storage-state storage-state-${row.cleanup_state}`}>{t(`cleanup.${row.cleanup_state}`)}</span>{row.physical_deleted_at && <small>{t('Receipt')}: {date(row.physical_deleted_at)}</small>}</td><td>{row.remote_state || '—'}<small>{date(row.attempted_at)}</small>{row.error && <small className="storage-stale">{row.error}</small>}</td></tr>)}</tbody></table></div>
        {entries.length === 0 && <p className="muted">{t('No matching records.')}</p>}
      </section>
    </>}
  </div>;
}
