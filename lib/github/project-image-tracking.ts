import "server-only";

import type { FugueApp, FugueAppSource } from "@/lib/fugue/api";
import {
  normalizeGitHubRepositoryName,
  type GitHubAppImageLink,
} from "@/lib/github/app-image-links";
import type { GitHubProjectImageLink } from "@/lib/github/project-image-links";

type GitHubRepoParts = {
  owner: string;
  repo: string;
};

type GitHubWorkflowFile = {
  name: string;
  path: string;
  text: string;
};

type GitHubWorkflowCandidate = {
  buildContextDir: string | null;
  dockerfilePath: string | null;
  imageRef: string;
  label: string;
  source: "convention" | "workflow";
  workflowPath: string | null;
};

type ProjectImageTrackingMatch = {
  app: FugueApp;
  candidate: GitHubWorkflowCandidate;
  reason: string;
  score: number;
};

export type ProjectImageTrackingServiceSourceView = {
  buildContextDir: string | null;
  composeService: string | null;
  detectedStack: string | null;
  dockerfilePath: string | null;
  imageNameSuffix: string | null;
};

export type ProjectImageTrackingServiceView = {
  appId: string;
  appName: string;
  enabled: boolean;
  githubRepo: string | null;
  imageRef: string | null;
  linked: boolean;
  matchReason: string | null;
  source: ProjectImageTrackingServiceSourceView;
  updatedAt: string | null;
};

export type ProjectImageTrackingResponseView = {
  binding: GitHubProjectImageLink | null;
  linkedCount: number;
  projectId: string;
  services: ProjectImageTrackingServiceView[];
};

export type InferProjectImageBindingsInput = {
  apps: FugueApp[];
  githubRepo: string;
  githubToken?: string | null;
};

export type InferProjectImageBindingsResult = {
  defaultBranch: string;
  matches: ProjectImageTrackingMatch[];
};

type GitHubRepositoryApiResponse = {
  default_branch?: unknown;
};

type GitHubContentApiItem = {
  download_url?: unknown;
  name?: unknown;
  path?: unknown;
  type?: unknown;
};

type WorkflowStep = {
  id: string | null;
  name: string | null;
  order: number;
  text: string;
  uses: string | null;
};

type MetadataStep = {
  id: string | null;
  images: string[];
  name: string | null;
  order: number;
};

const DEFAULT_BRANCH = "main";
const DOCKER_METADATA_ACTION = "docker/metadata-action";
const DOCKER_BUILD_PUSH_ACTION = "docker/build-push-action";
const DOCKER_HUB_REGISTRY_PREFIX = "docker.io/";
const GITHUB_EXPR_PATTERN = /\$\{\{\s*([^}]+?)\s*\}\}/g;

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePath(value?: string | null) {
  const normalized = value
    ?.trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "") ?? "";

  return normalized || ".";
}

function normalizeToken(value?: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ?? "";
}

function normalizeImageForMatch(value: string) {
  return value.trim().toLowerCase().replace(/^docker\.io\//, "");
}

function appendTagIfMissing(imageRef: string, tag: string) {
  const normalized = imageRef.trim();

  if (!normalized || normalized.includes("@")) {
    return normalized;
  }

  const lastSegment = normalized.split("/").at(-1) ?? normalized;
  return lastSegment.includes(":") ? normalized : `${normalized}:${tag}`;
}

function readGitHubRepoParts(githubRepo: string): GitHubRepoParts {
  const normalized = normalizeGitHubRepositoryName(githubRepo);
  const [owner = "", repo = ""] = normalized.split("/");

  return {
    owner,
    repo,
  };
}

export function normalizeGitHubRepositoryInput(value: string) {
  let normalized = value.trim();

  if (!normalized) {
    return "";
  }

  const sshMatch = /^git@github\.com:([^/\s]+)\/([^/\s]+)$/i.exec(normalized);

  if (sshMatch) {
    normalized = `${sshMatch[1]}/${sshMatch[2]}`;
  } else {
    const urlMatch =
      /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)(?:[/?#].*)?$/i.exec(
        normalized,
      );

    if (urlMatch) {
      normalized = `${urlMatch[1]}/${urlMatch[2]}`;
    }
  }

  return normalizeGitHubRepositoryName(normalized.replace(/\.git$/i, ""));
}

function readSource(app: FugueApp): FugueAppSource {
  return app.originSource ?? app.source;
}

function buildSourceView(
  source: FugueAppSource,
): ProjectImageTrackingServiceSourceView {
  return {
    buildContextDir: source.buildContextDir ?? null,
    composeService: source.composeService ?? null,
    detectedStack: source.detectedStack ?? null,
    dockerfilePath: source.dockerfilePath ?? null,
    imageNameSuffix: source.imageNameSuffix ?? null,
  };
}

function buildServiceView(
  app: FugueApp,
  link: GitHubAppImageLink | null,
): ProjectImageTrackingServiceView {
  return {
    appId: app.id,
    appName: app.name,
    enabled: link?.enabled ?? false,
    githubRepo: link?.githubRepo ?? null,
    imageRef: link?.imageRef ?? null,
    linked: Boolean(link?.enabled),
    matchReason: null,
    source: buildSourceView(readSource(app)),
    updatedAt: link?.updatedAt ?? null,
  };
}

export function buildProjectImageTrackingResponseView(input: {
  apps: FugueApp[];
  binding: GitHubProjectImageLink | null;
  links: GitHubAppImageLink[];
  projectId: string;
}): ProjectImageTrackingResponseView {
  const linksByAppId = new Map(
    input.links.map((link) => [link.fugueAppId, link]),
  );
  const services = input.apps.map((app) =>
    buildServiceView(app, linksByAppId.get(app.id) ?? null),
  );

  return {
    binding: input.binding,
    linkedCount: services.filter((service) => service.linked).length,
    projectId: input.projectId,
    services,
  };
}

export function buildProjectImageTrackingBoundResponseView(input: {
  binding: GitHubProjectImageLink;
  links: GitHubAppImageLink[];
  matches: ProjectImageTrackingMatch[];
  projectId: string;
}): ProjectImageTrackingResponseView {
  const linksByAppId = new Map(
    input.links.map((link) => [link.fugueAppId, link]),
  );
  const services = input.matches.map(({ app, candidate, reason }) => {
    const link = linksByAppId.get(app.id) ?? null;

    return {
      ...buildServiceView(app, link),
      imageRef: link?.imageRef ?? candidate.imageRef,
      linked: Boolean(link?.enabled),
      matchReason: reason,
    } satisfies ProjectImageTrackingServiceView;
  });

  return {
    binding: input.binding,
    linkedCount: services.filter((service) => service.linked).length,
    projectId: input.projectId,
    services,
  };
}

function buildGitHubHeaders(token?: string | null) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "fugue-web",
  };

  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return headers;
}

async function fetchJson<T>(url: string, token?: string | null) {
  const response = await fetch(url, {
    headers: buildGitHubHeaders(token),
    next: { revalidate: 120 },
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string, token?: string | null) {
  const response = await fetch(url, {
    headers: token?.trim() ? { Authorization: `Bearer ${token.trim()}` } : {},
    next: { revalidate: 120 },
  });

  if (!response.ok) {
    throw new Error(`GitHub file request failed: ${response.status}.`);
  }

  return response.text();
}

async function fetchGitHubWorkflowFiles(
  githubRepo: string,
  token?: string | null,
) {
  const { owner, repo } = readGitHubRepoParts(githubRepo);
  const repository = await fetchJson<GitHubRepositoryApiResponse>(
    `https://api.github.com/repos/${owner}/${repo}`,
    token,
  );
  const defaultBranch = readString(repository.default_branch) ?? DEFAULT_BRANCH;
  const contents = await fetchJson<GitHubContentApiItem[]>(
    `https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows?ref=${encodeURIComponent(defaultBranch)}`,
    token,
  ).catch(() => [] as GitHubContentApiItem[]);

  const workflowItems = contents.filter((item) => {
    const path = readString(item.path);
    const type = readString(item.type);

    return (
      type === "file" &&
      Boolean(path && /\.(ya?ml)$/i.test(path))
    );
  });
  const files = await Promise.all(
    workflowItems.map(async (item) => {
      const path = readString(item.path) ?? "";
      const rawUrl =
        readString(item.download_url) ??
        `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${path}`;

      return {
        name: readString(item.name) ?? path.split("/").at(-1) ?? path,
        path,
        text: await fetchText(rawUrl, token),
      } satisfies GitHubWorkflowFile;
    }),
  );

  return {
    defaultBranch,
    files,
  };
}

function readWorkflowEnv(
  text: string,
  repo: GitHubRepoParts,
  defaultBranch: string,
) {
  const env = new Map<string, string>();

  env.set("GITHUB_REPOSITORY", `${repo.owner}/${repo.repo}`);
  env.set("GITHUB_REPOSITORY_OWNER", repo.owner);
  env.set("GITHUB_REF_NAME", defaultBranch);

  for (const line of text.split(/\r?\n/)) {
    const match = /^\s{0,8}([A-Z][A-Z0-9_]*)\s*:\s*(.+?)\s*$/.exec(line);

    if (!match) {
      continue;
    }

    const value = match[2].trim();

    if (!value || value === "|" || value === ">") {
      continue;
    }

    env.set(match[1], value.replace(/^['"]|['"]$/g, ""));
  }

  return env;
}

function resolveWorkflowExpression(
  value: string,
  env: ReadonlyMap<string, string>,
  repo: GitHubRepoParts,
  defaultBranch: string,
) {
  let resolved = value.trim().replace(/^['"]|['"]$/g, "");

  for (let index = 0; index < 5; index += 1) {
    let changed = false;

    resolved = resolved.replace(GITHUB_EXPR_PATTERN, (_match, expression) => {
      const normalized = String(expression).trim().toLowerCase();
      const envMatch = /^env\.([a-z0-9_]+)$/.exec(normalized);

      if (envMatch) {
        const nextValue = env.get(envMatch[1].toUpperCase()) ?? "";
        changed = changed || Boolean(nextValue);
        return nextValue;
      }

      if (
        normalized === "github.repository_owner" ||
        normalized === "secrets.dockerhub_username" ||
        normalized === "vars.dockerhub_username"
      ) {
        changed = true;
        return repo.owner;
      }

      if (normalized === "github.repository") {
        changed = true;
        return `${repo.owner}/${repo.repo}`;
      }

      if (
        normalized === "github.ref_name" ||
        normalized === "github.event.repository.default_branch"
      ) {
        changed = true;
        return defaultBranch;
      }

      return "";
    });

    if (!changed || !resolved.includes("${{")) {
      break;
    }
  }

  return resolved.includes("${{") ? null : resolved.trim();
}

function splitWorkflowSteps(text: string) {
  const steps: WorkflowStep[] = [];
  let current: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    if (/^\s*-\s+(name|uses)\s*:/.test(line) && current.length > 0) {
      steps.push(readWorkflowStep(current.join("\n"), steps.length));
      current = [line];
      continue;
    }

    if (current.length > 0 || /^\s*-\s+(name|uses)\s*:/.test(line)) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    steps.push(readWorkflowStep(current.join("\n"), steps.length));
  }

  return steps;
}

function readWorkflowStep(text: string, order: number): WorkflowStep {
  return {
    id: readStepScalar(text, "id"),
    name: readStepScalar(text, "name"),
    order,
    text,
    uses: readStepScalar(text, "uses"),
  };
}

function readStepScalar(text: string, key: string) {
  const match = new RegExp(`^\\s*(?:-\\s*)?${key}\\s*:\\s*(.+?)\\s*$`, "m").exec(
    text,
  );
  const value = match?.[1]?.trim() ?? "";

  if (!value || value === "|" || value === ">") {
    return null;
  }

  return value.replace(/^['"]|['"]$/g, "");
}

function readStepBlockValues(text: string, key: string) {
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = new RegExp(`^(\\s*)${key}\\s*:\\s*(.*)$`).exec(line);

    if (!match) {
      continue;
    }

    const baseIndent = match[1].length;
    const rest = match[2].trim();

    if (rest && rest !== "|" && rest !== ">") {
      return [rest.replace(/^['"]|['"]$/g, "")];
    }

    const values: string[] = [];

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];

      if (!nextLine.trim()) {
        continue;
      }

      const nextIndent = /^\s*/.exec(nextLine)?.[0].length ?? 0;

      if (nextIndent <= baseIndent) {
        break;
      }

      const value = nextLine
        .trim()
        .replace(/^-\s*/, "")
        .replace(/^['"]|['"]$/g, "");

      if (value) {
        values.push(value);
      }
    }

    return values;
  }

  return [];
}

function parseWorkflowFileCandidates(
  file: GitHubWorkflowFile,
  githubRepo: string,
  defaultBranch: string,
) {
  const repo = readGitHubRepoParts(githubRepo);
  const env = readWorkflowEnv(file.text, repo, defaultBranch);
  const steps = splitWorkflowSteps(file.text);
  const metadataStepsById = new Map<string, MetadataStep>();
  const metadataSteps: MetadataStep[] = [];
  const candidates: GitHubWorkflowCandidate[] = [];

  for (const step of steps) {
    const uses = step.uses?.toLowerCase() ?? "";

    if (!uses.includes(DOCKER_METADATA_ACTION)) {
      continue;
    }

    const images = readStepBlockValues(step.text, "images")
      .map((value) => resolveWorkflowExpression(value, env, repo, defaultBranch))
      .filter((value): value is string => Boolean(value))
      .map((value) => appendTagIfMissing(value, defaultBranch));
    const metadata = {
      id: step.id,
      images,
      name: step.name,
      order: step.order,
    } satisfies MetadataStep;

    metadataSteps.push(metadata);

    if (step.id) {
      metadataStepsById.set(step.id, metadata);
    }
  }

  for (const step of steps) {
    const uses = step.uses?.toLowerCase() ?? "";

    if (!uses.includes(DOCKER_BUILD_PUSH_ACTION)) {
      continue;
    }

    const tagsValue = readStepScalar(step.text, "tags") ?? "";
    const metadataId = /\$\{\{\s*steps\.([a-zA-Z0-9_-]+)\.outputs\.tags\s*\}\}/.exec(
      tagsValue,
    )?.[1];
    const metadata =
      (metadataId ? metadataStepsById.get(metadataId) : null) ??
      [...metadataSteps]
        .reverse()
        .find((candidate) => candidate.order < step.order) ??
      null;
    const images = metadata?.images ?? [];

    for (const imageRef of images) {
      candidates.push({
        buildContextDir: readStepScalar(step.text, "context"),
        dockerfilePath: readStepScalar(step.text, "file"),
        imageRef,
        label: [metadata?.name, step.name].filter(Boolean).join(" / "),
        source: "workflow",
        workflowPath: file.path,
      });
    }
  }

  return candidates;
}

function readRoleTokens(source: FugueAppSource, app: FugueApp) {
  const stack = normalizeToken(source.detectedStack);
  const service = normalizeToken(source.composeService);
  const suffix = normalizeToken(source.imageNameSuffix);
  const appName = normalizeToken(app.name);

  if (
    stack === "nextjs" ||
    stack === "react" ||
    service === "web" ||
    suffix === "web" ||
    appName.endsWith("-web")
  ) {
    return ["frontend", "web"];
  }

  if (
    stack === "python" ||
    service === "api" ||
    suffix === "api" ||
    appName.endsWith("-api")
  ) {
    return ["backend", "api"];
  }

  return [suffix, service].filter(Boolean);
}

async function dockerHubTagExists(imageRef: string) {
  const normalized = imageRef
    .replace(/^docker\.io\//i, "")
    .replace(/:.+$/, "")
    .trim();
  const [namespace, repository] = normalized.split("/");

  if (!namespace || !repository || normalized.split("/").length !== 2) {
    return false;
  }

  const response = await fetch(
    `https://registry.hub.docker.com/v2/repositories/${namespace}/${repository}/tags/main`,
    {
      next: { revalidate: 120 },
    },
  ).catch(() => null);

  return response?.ok ?? false;
}

async function buildConventionCandidates(
  apps: FugueApp[],
  githubRepo: string,
  defaultBranch: string,
) {
  const { owner, repo } = readGitHubRepoParts(githubRepo);
  const repoToken = normalizeToken(repo);
  const repoAliases = new Set([repoToken]);

  if (repoToken.endsWith("-web")) {
    repoAliases.add(repoToken.slice(0, -"web".length - 1));
  }

  const candidates: GitHubWorkflowCandidate[] = [];
  const seen = new Set<string>();

  for (const app of apps) {
    const source = readSource(app);

    for (const repoAlias of repoAliases) {
      for (const role of readRoleTokens(source, app)) {
        const imageRef = appendTagIfMissing(
          `${owner}/${repoAlias}-${role}`,
          defaultBranch,
        );
        const key = normalizeImageForMatch(imageRef);

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);

        if (!(await dockerHubTagExists(imageRef))) {
          continue;
        }

        candidates.push({
          buildContextDir: null,
          dockerfilePath: null,
          imageRef,
          label: `Docker Hub ${role}`,
          source: "convention",
          workflowPath: null,
        });
      }
    }
  }

  return candidates;
}

function scoreCandidate(app: FugueApp, candidate: GitHubWorkflowCandidate) {
  const source = readSource(app);
  const sourceDockerfile = normalizePath(source.dockerfilePath);
  const sourceContext = normalizePath(source.buildContextDir ?? source.sourceDir);
  const candidateDockerfile = candidate.dockerfilePath
    ? normalizePath(candidate.dockerfilePath)
    : "";
  const candidateContext = candidate.buildContextDir
    ? normalizePath(candidate.buildContextDir)
    : "";
  const image = normalizeImageForMatch(candidate.imageRef);
  const label = normalizeToken(candidate.label);
  const service = normalizeToken(source.composeService);
  const suffix = normalizeToken(source.imageNameSuffix);
  const stack = normalizeToken(source.detectedStack);
  const appName = normalizeToken(app.name);
  const roleTokens = readRoleTokens(source, app);
  let score = 0;
  const reasons: string[] = [];

  if (candidateDockerfile && candidateDockerfile === sourceDockerfile) {
    score += 90;
    reasons.push("Dockerfile");
  }

  if (candidateContext && candidateContext === sourceContext) {
    score += 55;
    reasons.push("context");
  }

  for (const token of [service, suffix].filter(Boolean)) {
    if (label.includes(token) || image.includes(token)) {
      score += 28;
      reasons.push(token);
      break;
    }
  }

  for (const role of roleTokens) {
    if (label.includes(role) || image.includes(role)) {
      score += 34;
      reasons.push(role);
      break;
    }
  }

  if (appName && image.includes(appName)) {
    score += 18;
    reasons.push("app name");
  }

  if (stack && (label.includes(stack) || image.includes(stack))) {
    score += 12;
    reasons.push(stack);
  }

  return {
    reason: reasons.length ? reasons.join(" + ") : "heuristic match",
    score,
  };
}

function matchCandidates(apps: FugueApp[], candidates: GitHubWorkflowCandidate[]) {
  const usedCandidates = new Set<string>();
  const matches: ProjectImageTrackingMatch[] = [];

  for (const app of apps) {
    const ranked = candidates
      .map((candidate) => ({
        candidate,
        ...scoreCandidate(app, candidate),
      }))
      .filter((entry) => entry.score >= 34)
      .sort((left, right) => right.score - left.score);
    const selected = ranked.find(
      (entry) => !usedCandidates.has(normalizeImageForMatch(entry.candidate.imageRef)),
    );

    if (!selected) {
      continue;
    }

    usedCandidates.add(normalizeImageForMatch(selected.candidate.imageRef));
    matches.push({
      app,
      candidate: selected.candidate,
      reason: selected.reason,
      score: selected.score,
    });
  }

  return matches;
}

export async function inferProjectImageBindings(
  input: InferProjectImageBindingsInput,
): Promise<InferProjectImageBindingsResult> {
  const githubRepo = normalizeGitHubRepositoryName(input.githubRepo);
  const workflows = await fetchGitHubWorkflowFiles(githubRepo, input.githubToken);
  const workflowCandidates = workflows.files.flatMap((file) =>
    parseWorkflowFileCandidates(file, githubRepo, workflows.defaultBranch),
  );
  const conventionCandidates = await buildConventionCandidates(
    input.apps,
    githubRepo,
    workflows.defaultBranch,
  );
  const matches = matchCandidates(input.apps, [
    ...workflowCandidates,
    ...conventionCandidates,
  ]);

  return {
    defaultBranch: workflows.defaultBranch,
    matches,
  };
}
