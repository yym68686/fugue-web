export type ProjectNameLike = {
  name?: string | null;
  slug?: string | null;
};

export const DUPLICATE_PROJECT_NAME_MESSAGE =
  "Project name already exists. Choose a different name or select the existing project.";

function readProjectLookupValue(project: ProjectNameLike) {
  if (typeof project.slug === "string" && project.slug.trim()) {
    return project.slug;
  }

  if (typeof project.name === "string" && project.name.trim()) {
    return project.name;
  }

  return "";
}

function readProjectSequenceIndex(project: ProjectNameLike) {
  const candidates = [project.name, project.slug];
  let highestIndex = 0;

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }

    const match = /^project(?:\s+|-)(\d+)$/i.exec(candidate.trim());

    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);

    if (Number.isInteger(parsed) && parsed > highestIndex) {
      highestIndex = parsed;
    }
  }

  return highestIndex;
}

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

export function findProjectByName<T extends ProjectNameLike>(
  projects: readonly T[],
  requestedName: string,
) {
  if (!requestedName.trim()) {
    return null;
  }

  const requestedSlug = slugifyProjectName(requestedName);

  return (
    projects.find((project) => {
      const lookupValue = readProjectLookupValue(project);
      return lookupValue
        ? slugifyProjectName(lookupValue) === requestedSlug
        : false;
    }) ?? null
  );
}

export function buildSuggestedProjectName<T extends ProjectNameLike>(
  projects: readonly T[],
) {
  let candidateIndex =
    projects.reduce(
      (highestIndex, project) =>
        Math.max(highestIndex, readProjectSequenceIndex(project)),
      0,
    ) + 1;

  while (findProjectByName(projects, `Project ${candidateIndex}`)) {
    candidateIndex += 1;
  }

  return `Project ${candidateIndex}`;
}
