import "server-only";

import type { SessionUser } from "@/lib/auth/session";
import { getAppUserByEmail } from "@/lib/app-users/store";
import { getFugueApp } from "@/lib/fugue/api";
import { getFugueEnv } from "@/lib/fugue/env";
import type { WorkspaceAccess } from "@/lib/workspace/store";

function normalizeHostname(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.replace(/^\.+/, "").replace(/\.+$/, "") || null;
}

function readRouteBaseDomain(app: Awaited<ReturnType<typeof getFugueApp>>) {
  const explicit = normalizeHostname(app?.route.baseDomain);

  if (explicit) {
    return explicit;
  }

  const routeHostname = normalizeHostname(app?.route.hostname);

  if (routeHostname) {
    const labels = routeHostname.split(".").filter(Boolean);

    if (labels.length >= 2) {
      return labels.slice(1).join(".");
    }
  }

  const publicUrl = app?.route.publicUrl?.trim();

  if (!publicUrl) {
    return null;
  }

  try {
    return normalizeHostname(new URL(publicUrl).hostname)?.split(".").slice(1).join(".") ?? null;
  } catch {
    return null;
  }
}

// Site admins may broker platform-root domain actions, but only when the
// requested hostname is the exact app route base domain and the app is already
// visible through the current workspace admin key.
export async function readFugueDomainAccessToken(
  session: SessionUser,
  workspace: WorkspaceAccess,
  appId: string,
  hostname?: string | null,
) {
  const user = await getAppUserByEmail(session.email);

  if (!user?.isAdmin) {
    return workspace.adminKeySecret;
  }

  const app = await getFugueApp(workspace.adminKeySecret, appId);
  const requestedHostname = normalizeHostname(hostname);
  const routeBaseDomain = readRouteBaseDomain(app);

  if (!requestedHostname || !routeBaseDomain || requestedHostname !== routeBaseDomain) {
    return workspace.adminKeySecret;
  }

  return getFugueEnv().bootstrapKey;
}
