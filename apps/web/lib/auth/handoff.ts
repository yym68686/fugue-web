import "server-only";

import { getCurrentSession } from "@/lib/auth/session";
import { sanitizeReturnTo } from "@/lib/auth/validation";

export async function readAuthenticatedAppPath(returnTo?: string | null) {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return sanitizeReturnTo(returnTo);
}
