/** Shared display formatters for resource usage and timestamps. */

export function fmtBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return '0';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function fmtMillicores(m: number | undefined | null): string {
  if (!m || m <= 0) return '0';
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} vCPU`;
  return `${m}m`;
}

export function fmtDate(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtPercent(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}
