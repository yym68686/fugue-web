import PageSkeleton from '@/components/PageSkeleton';
import { getRequestI18n } from '@/lib/i18n/server';

export default async function Loading() {
  const { t } = await getRequestI18n();
  return <PageSkeleton eyebrow="Billing" title={t('Billing')} variant="list" />;
}
