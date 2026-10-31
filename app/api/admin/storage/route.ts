import { NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin/route';
import { getAdminStorageOverview } from '@/lib/fugue/console';
import { jsonError, readErrorStatus } from '@/lib/fugue/product-route';

export const dynamic = 'force-dynamic';

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Vary', 'Cookie');
  return response;
}

export async function GET() {
  const access = await requireAdminRoute();
  if (access.response) return noStore(access.response);
  try {
    return noStore(NextResponse.json({ result: await getAdminStorageOverview() }));
  } catch (error) {
    // Do not forward provider credentials or upstream response bodies.
    return noStore(jsonError(readErrorStatus(error), 'Storage inventory unavailable.'));
  }
}
