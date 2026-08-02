/** Shared display formatters for resource usage and timestamps. */

import type { components as FugueAPIComponents } from '@/lib/fugue/openapi.generated';

export type ImageMeasurementStatus = 'complete' | 'partial' | 'unavailable';
export type ImageMeasurementReason =
  FugueAPIComponents['schemas']['ImageMeasurementReason'];

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

/**
 * Format an image measurement without turning missing evidence into a number.
 * Partial measurements are lower bounds because the backend may only have a
 * subset of the referenced blob graph.
 */
export function fmtImageUsage(
  bytes: number | undefined | null,
  status: ImageMeasurementStatus | undefined,
): string {
  if (status === 'complete') return fmtBytes(bytes ?? 0);
  if (status === 'partial' && bytes != null && bytes > 0) {
    return `≥ ${fmtBytes(bytes)}`;
  }
  return '—';
}

export function imageMeasurementMessageKey(
  status: ImageMeasurementStatus | undefined,
): string {
  switch (status) {
    case 'complete':
      return 'Image usage is based on complete storage evidence';
    case 'partial':
      return 'Only a lower-bound image measurement is available';
    default:
      return 'Image usage is unavailable because no fresh storage evidence was returned';
  }
}

export function fmtImageMeasurementTitle(
  status: ImageMeasurementStatus | undefined,
  reasons: readonly ImageMeasurementReason[] | undefined,
  note: string | undefined | null,
  translate: (key: string) => string,
): string {
  const base = translate(imageMeasurementMessageKey(status));
  const details =
    status === 'complete'
      ? []
      : [...new Set(reasons ?? [])].map((reason) =>
          translate(imageMeasurementReasonMessageKey(reason)),
        );
  return [base, details.length > 0 ? details.join('; ') : '', note || '']
    .filter(Boolean)
    .join(': ');
}

export function imageMeasurementReasonMessageKey(
  reason: ImageMeasurementReason,
): string {
  switch (reason) {
    case 'digest_conflict':
      return 'Different cache nodes reported different image digests';
    case 'size_conflict':
      return 'Cache nodes reported inconsistent sizes for the same image';
    case 'stale_inventory':
      return 'Image cache inventory is stale';
    case 'missing_manifest_evidence':
      return 'No fresh image manifest evidence was returned';
    case 'missing_size_evidence':
      return 'Image size evidence is missing';
    case 'missing_manifest_size_evidence':
      return 'Image manifest size evidence is missing';
    case 'missing_blob_size_evidence':
      return 'Referenced blob size evidence is incomplete';
    case 'missing_child_manifest':
      return 'A child image manifest is missing';
    case 'missing_blob':
      return 'A referenced image blob is missing';
    case 'no_storage_evidence':
      return 'No physical image storage evidence was returned';
    case 'registry_not_configured':
      return 'The registry is not configured for image measurement';
  }
}

export function fmtStorageUsage(
  usedBytes: number | undefined | null,
  capacityBytes: number | undefined | null,
): string {
  if (usedBytes == null && capacityBytes == null) return '—';
  const used = usedBytes == null ? '—' : fmtBytes(usedBytes);
  return capacityBytes == null ? used : `${used} / ${fmtBytes(capacityBytes)}`;
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
