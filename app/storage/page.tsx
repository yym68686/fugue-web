import AppLayout from '@/components/AppLayout';
import { requireActivePageSession } from '@/lib/auth/page-access';
import StorageManager from '@/components/storage/StorageManager';

export default async function StoragePage() {
  await requireActivePageSession();
  return <AppLayout><StorageManager /></AppLayout>;
}
