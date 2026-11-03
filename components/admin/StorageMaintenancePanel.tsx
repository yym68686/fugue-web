'use client';

import { useEffect, useState } from 'react';
import type { StorageMaintenanceJob } from '@/lib/fugue/console';
import { useI18n } from '@/lib/i18n/client';

export default function StorageMaintenancePanel() {
  const { t, locale } = useI18n();
  const [jobs, setJobs] = useState<StorageMaintenanceJob[]>([]);
  const [kind, setKind] = useState<StorageMaintenanceJob['kind']>('longhorn-reconcile');
  const [scope, setScope] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const kinds: StorageMaintenanceJob['kind'][] = ['longhorn-reconcile', 'retention', 'backup-cleanup', 'data-gc', 'transfer-expiry'];
  async function refresh() {
    try {
      const response = await fetch('/api/admin/storage/jobs', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const body: { jobs: StorageMaintenanceJob[] } = await response.json();
      setJobs(body.jobs);
    } catch { setError(t('Storage maintenance unavailable.')); }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
    // Locale changes should refresh the error translation too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  async function submit() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/storage/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, scope_id: scope.trim(), execute: confirm }) });
      if (!response.ok) throw new Error();
      const job: StorageMaintenanceJob = await response.json();
      setSelected(job.id); setConfirm(false); await refresh();
    } catch { setError(t('Storage maintenance unavailable.')); }
    finally { setBusy(false); }
  }
  return <section className="panel admin-storage-section">
    <h2>{t('Storage maintenance jobs')}</h2>
    <p className="muted">{t('Preview first. Execution checks current references again. Longhorn shared blocks are reclaimed only by its engine.')}</p>
    <div className="admin-storage-heading">
      <label>{t('Operation')}<select value={kind} onChange={event => { setKind(event.target.value as StorageMaintenanceJob['kind']); setScope(''); setConfirm(false); }}>{kinds.map(value => <option key={value} value={value}>{t(`maintenance.${value}`)}</option>)}</select></label>
      {(kind === 'retention' || kind === 'data-gc') && <label>{t(kind === 'retention' ? 'Policy ID (empty: enabled policies)' : 'Workspace ID')}<input value={scope} onChange={event => setScope(event.target.value)} /></label>}
      <label><input type="checkbox" checked={confirm} onChange={event => setConfirm(event.target.checked)} /> {t('Execute with safety checks')}</label>
      <button className="btn" disabled={busy || (kind === 'data-gc' && !scope.trim())} onClick={() => void submit()}>{t(confirm ? 'Queue execution' : 'Queue preview')}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <p className="muted">{t('Disabled policies keep history unless explicitly selected. Transfers retire after 30 idle days and expired authorization. A completed inventory check is not a database recovery test.')}</p>
    <div className="admin-storage-table"><table><thead><tr>{['Operation', 'Mode', 'Status', 'Last update', 'Details'].map(label => <th key={label}>{t(label)}</th>)}</tr></thead>
      <tbody>{jobs.map(job => <tr key={job.id}><td>{t(`maintenance.${job.kind}`)}<small>{job.scope_id || t('Platform')}</small></td><td>{t(job.execute ? 'Execution' : 'Preview')}</td><td>{t(`maintenance.${job.status}`)}<small>{t('Attempts')}: {job.attempts}</small></td><td>{new Date(job.updated_at).toLocaleString(locale)}{job.retry_at && <small>{t('Retry at')}: {new Date(job.retry_at).toLocaleString(locale)}</small>}</td><td><button className="btn" onClick={() => setSelected(selected === job.id ? '' : job.id)}>{t('Details')}</button>{selected === job.id && <pre style={{ maxWidth: 650, maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify({ id: job.id, error: job.error, result: job.result }, null, 2)}</pre>}</td></tr>)}</tbody></table></div>
  </section>;
}
