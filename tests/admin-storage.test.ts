import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { measuredStorageBytes, storageBytes } from '@/lib/admin/storage';
import type { components } from '@/lib/fugue/openapi.generated';

test('unmeasured storage is unknown, while measured zero is zero', () => {
  const row: components['schemas']['AdminStorageNamespace'] = { kind: 'project-store', resource_id: 'store-one', name: 'example', bucket: 'example', prefix: '', tenant_id: '', project_id: '', status: 'active', used_bytes: 0 };
  assert.equal(measuredStorageBytes(row), null);
  assert.equal(storageBytes(measuredStorageBytes(row)), '—');
  row.measured_at = '2026-10-31T00:00:00Z';
  assert.equal(storageBytes(measuredStorageBytes(row)), '0 B');
  assert.equal(storageBytes(1024 ** 3), '1 GiB');
});

test('platform storage is guarded before bootstrap access and exposes no mutations', async () => {
  const page = await readFile('app/admin/storage/page.tsx', 'utf8');
  const route = await readFile('app/api/admin/storage/route.ts', 'utf8');
  assert.ok(page.indexOf('await requireActiveAdminPageSession()') < page.indexOf('await getAdminStorageOverview()'));
  assert.ok(route.indexOf('await requireAdminRoute()') < route.indexOf('await getAdminStorageOverview()'));
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(route, /export async function (POST|DELETE|PUT|PATCH)/);
});
