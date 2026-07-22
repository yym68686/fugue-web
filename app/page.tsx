import { redirect } from 'next/navigation';

import Landing from '@/components/landing/landing';
import { getRequestActiveSessionUser } from '@/lib/server/request-context';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const activeSession = await getRequestActiveSessionUser();
  if (activeSession) {
    redirect('/projects');
  }

  return <Landing />;
}
