import "server-only";

import { getAppUserByEmail } from "@/lib/app-users/store";
import { getCurrentSession } from "@/lib/auth/session";

export async function readAuthenticatedAppPath() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  try {
    const user = await getAppUserByEmail(session.email);

    if (user && user.status !== "active") {
      return null;
    }

    return "/app";
  } catch {
    return null;
  }
}
