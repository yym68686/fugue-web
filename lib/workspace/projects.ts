import "server-only";

import {
  getFugueProjects,
  type FugueProject,
} from "@/lib/fugue/api";
import {
  findProjectByName,
  slugifyProjectName,
} from "@/lib/project-names";

export { findProjectByName, slugifyProjectName } from "@/lib/project-names";

export function findProjectById(projects: FugueProject[], requestedId: string) {
  return projects.find((project) => project.id === requestedId) ?? null;
}

export async function findWorkspaceProjectByName(
  accessToken: string,
  requestedName: string,
  tenantId?: string,
) {
  const projects = await getFugueProjects(accessToken, tenantId);
  return findProjectByName(projects, requestedName);
}

export async function findWorkspaceProjectById(
  accessToken: string,
  requestedId: string,
  tenantId?: string,
) {
  const projects = await getFugueProjects(accessToken, tenantId);
  return findProjectById(projects, requestedId);
}
