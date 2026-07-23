import PageSkeleton from '@/components/PageSkeleton';
import { getRequestI18n } from '@/lib/i18n/server';

export default async function Loading() {
  const { t } = await getRequestI18n();
  return <PageSkeleton eyebrow="Platform · Users" title={t('Users')} variant="list" />;
}
