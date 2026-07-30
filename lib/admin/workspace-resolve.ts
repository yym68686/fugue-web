import type { WorkspaceSnapshot } from "@/lib/workspace/store";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation";

type ResolvableWorkspace = Pick<
  WorkspaceSnapshot,
  | "defaultProjectId"
  | "defaultProjectName"
  | "firstAppId"
  | "tenantId"
  | "tenantName"
>;

export function readWorkspaceResolveEmail(requestUrl: string) {
  let url: URL;

  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }

  const values = url.searchParams.getAll("email");
  if (values.length !== 1) {
    return null;
  }

  const email = normalizeEmail(values[0] ?? "");
  return isValidEmail(email) ? email : null;
}

export function buildWorkspaceResolvePayload(
  email: string,
  workspace: ResolvableWorkspace,
) {
  return {
    email: normalizeEmail(email),
    workspace: {
      defaultProjectId: workspace.defaultProjectId,
      defaultProjectName: workspace.defaultProjectName,
      firstAppId: workspace.firstAppId,
      tenantId: workspace.tenantId,
      tenantName: workspace.tenantName,
    },
  };
}
