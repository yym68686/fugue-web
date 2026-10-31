import AppLayout from '@/components/AppLayout';
import AdminStoragePanel from '@/components/admin/AdminStoragePanel';
import { requireActiveAdminPageSession } from '@/lib/auth/page-access';
import { getAdminStorageOverview } from '@/lib/fugue/console';
import { withPageTiming } from '@/lib/server/with-page-timing';

export const dynamic = 'force-dynamic';

export default withPageTiming('/admin/storage', async function AdminStoragePage() {
  await requireActiveAdminPageSession();
  // A transient provider error must leave the page usable for a retry.
  const initial = await getAdminStorageOverview().catch(() => null);
  return <AppLayout><AdminStoragePanel initial={initial} /></AppLayout>;
});
