import "server-only";

import { getCurrentSession } from "@/lib/auth/session";
import { ensureAppUserRecord } from "@/lib/app-users/store";

export async function getCurrentAppUser() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  const user = await ensureAppUserRecord(session);

  return {
    session,
    user,
  };
}
