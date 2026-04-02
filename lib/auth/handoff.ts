import "server-only";

import { getAppUserByEmail } from "@/lib/app-users/store";
import { getCurrentSession } from "@/lib/auth/session";
import { sanitizeReturnTo } from "@/lib/auth/validation";

export async function readAuthenticatedAppPath(returnTo?: string | null) {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  try {
    const user = await getAppUserByEmail(session.email);

    if (user && user.status !== "active") {
      return null;
    }

    return sanitizeReturnTo(returnTo);
  } catch {
    return null;
  }
}
