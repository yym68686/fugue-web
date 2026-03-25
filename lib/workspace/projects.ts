import "server-only";

import {
  getFugueProjects,
  type FugueProject,
} from "@/lib/fugue/api";

export function slugifyProjectName(value: string) {
  const normalized = value.trim().toLowerCase();
  let output = "";
  let lastDash = false;

  for (const char of normalized) {
    const isLetter = char >= "a" && char <= "z";
    const isDigit = char >= "0" && char <= "9";

    if (isLetter || isDigit) {
      output += char;
      lastDash = false;
      continue;
    }

    if (!lastDash && output.length > 0) {
      output += "-";
      lastDash = true;
    }
  }

  const trimmed = output.replace(/^-+|-+$/g, "");
  return trimmed || "item";
}

export function findProjectByName(projects: FugueProject[], requestedName: string) {
  const requestedSlug = slugifyProjectName(requestedName);

  return (
    projects.find((project) => {
      const projectSlug = slugifyProjectName(project.slug ?? project.name);
      return projectSlug === requestedSlug;
    }) ?? null
  );
}

export async function findWorkspaceProjectByName(
  accessToken: string,
  requestedName: string,
  tenantId?: string,
) {
  const projects = await getFugueProjects(accessToken, tenantId);
  return findProjectByName(projects, requestedName);
}
