import type { components } from '@/lib/fugue/openapi.generated';

type Namespace = components['schemas']['AdminStorageNamespace'];

export function measuredStorageBytes(row: Namespace): number | null {
  return row.measured_at && typeof row.used_bytes === 'number' ? row.used_bytes : null;
}

export function storageBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${units[index]}`;
}
