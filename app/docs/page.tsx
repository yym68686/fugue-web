import type { Metadata } from 'next';

import Docs from '@/components/landing/docs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Docs — Fugue',
  description: 'Install the Fugue CLI, create an API key, and deploy from your terminal.',
};

// Public docs — readable signed in or out. Linked resources (Access keys,
// Servers) sit behind auth and will bounce to sign-in when tapped by a guest.
export default function DocsPage() {
  return <Docs />;
}
