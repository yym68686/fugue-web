import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin/route';
import { createStorageMaintenanceJob, getStorageMaintenanceJobs, type StorageMaintenanceJob } from '@/lib/fugue/console';
import { jsonError, readErrorStatus } from '@/lib/fugue/product-route';
import { readRequestOrigin } from '@/lib/auth/origin';

export const dynamic = 'force-dynamic';
function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie');
  return response;
}
export async function GET() {
  const access = await requireAdminRoute();
  if (access.response) return noStore(access.response);
  try { return noStore(NextResponse.json(await getStorageMaintenanceJobs())); }
  catch (error) { return noStore(jsonError(readErrorStatus(error), 'Storage maintenance unavailable.')); }
}
export async function POST(request: Request) {
  const access = await requireAdminRoute();
  if (access.response) return noStore(access.response);
  try {
    if (request.headers.get('origin') !== readRequestOrigin(request)) {
      return noStore(jsonError(403, 'Same-origin request required.'));
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object') return noStore(jsonError(400, 'Invalid maintenance request.'));
    const input = body as Record<string, unknown>;
    const kinds = ['retention', 'longhorn-reconcile', 'backup-cleanup', 'data-gc', 'transfer-expiry'];
    if (typeof input.kind !== 'string' || !kinds.includes(input.kind) || typeof input.execute !== 'boolean' || (input.scope_id !== undefined && typeof input.scope_id !== 'string')) {
      return noStore(jsonError(400, 'Invalid maintenance request.'));
    }
    const job = await createStorageMaintenanceJob({ kind: input.kind as StorageMaintenanceJob['kind'], scope_id: input.scope_id as string | undefined, execute: input.execute });
    return noStore(NextResponse.json(job, { status: 202 }));
  } catch (error) { return noStore(jsonError(readErrorStatus(error), 'Storage maintenance unavailable.')); }
}
