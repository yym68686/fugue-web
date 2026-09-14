import { withWorkspaceKey } from '@/lib/console/route-helpers';
import { jsonError, readJsonBody } from '@/lib/fugue/product-route';
import { getObjectStorageChoices, listObjectStores, listObjectStoreCredentials, mutateObjectStore } from '@/lib/fugue/console';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  return withWorkspaceKey(async (key) => {
    if (id) return listObjectStoreCredentials(key, id);
    const [storage, choices] = await Promise.all([listObjectStores(key), getObjectStorageChoices(key)]);
    return {stores: storage.stores, ...choices};
  });
}
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body || typeof body !== 'object' || !['create','update','measure','bind','revoke'].includes(body.action)) return jsonError(400, 'Invalid storage action');
  return withWorkspaceKey(key => mutateObjectStore(key, body.action, body));
}
