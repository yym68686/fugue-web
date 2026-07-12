import "server-only";

import { randomUUID } from "node:crypto";

import { normalizeEmail } from "@/lib/auth/validation";
import { ensureDbSchema, withDbSchemaRetry } from "@/lib/db/schema";
import { queryDb, requireQueryRow } from "@/lib/db/pool";
import { getGitHubConnectionByEmail } from "@/lib/github/connection-store";
import { normalizeGitHubRepositoryName } from "@/lib/github/app-image-links";

export const GITHUB_APP_INSTALL_STATE_COOKIE_NAME = "fg_github_app_install_state";

type GitHubAppInstallationRow = {
  github_account_login: string;
  github_installation_id: string;
  github_repo: string;
  github_repository_selection: string;
  id: string;
  installed_at: Date | string;
  updated_at: Date | string;
  user_email: string;
  verified: boolean;
};

export type GitHubAppInstallationRecord = {
  accountLogin: string | null;
  createdAt: string;
  githubInstallationId: string;
  githubRepo: string;
  githubRepositorySelection: string | null;
  id: string;
  installedAt: string;
  updatedAt: string;
  userEmail: string;
  verified: boolean;
};

export type GitHubAppInstallationStatus = {
  accountLogin: string | null;
  checkedAt: string | null;
  githubInstallationId: string | null;
  githubRepo: string;
  installed: boolean;
  repositorySelection: string | null;
  source:
    | "cached"
    | "connection-missing"
    | "error"
    | "live"
    | "missing"
    | "public-repo";
  verified: boolean;
};

type GitHubUserInstallation = {
  account?: {
    login?: string;
  };
  app_id?: number | string;
  app_slug?: string;
  id?: number | string;
  repository_selection?: string;
};

type GitHubUserInstallationListResponse = {
  installations?: GitHubUserInstallation[];
};

type GitHubInstallationRepository = {
  full_name?: string;
};

type GitHubInstallationRepositoryListResponse = {
  repositories?: GitHubInstallationRepository[];
};

type GitHubRepositoryResponse = {
  full_name?: unknown;
  owner?: {
    login?: unknown;
  };
  private?: unknown;
};

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readTimestamp(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function readOptionalNumberString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return readOptionalString(value);
}

function readGitHubAppSlug() {
  return process.env.GITHUB_APP_SLUG?.trim() || "fugue";
}

function resolveGitHubAppInstallUrl() {
  const explicit = process.env.GITHUB_APP_INSTALL_URL?.trim();

  if (explicit) {
    return explicit;
  }

  return `https://github.com/apps/${readGitHubAppSlug()}/installations/new`;
}

function buildGitHubApiHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token.trim()}`,
    "User-Agent": "fugue-web",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function readGitHubAppInstallationFromRow(
  row: GitHubAppInstallationRow,
): GitHubAppInstallationRecord {
  return {
    accountLogin: readOptionalString(row.github_account_login),
    createdAt: readTimestamp(row.installed_at),
    githubInstallationId: row.github_installation_id,
    githubRepo: row.github_repo,
    githubRepositorySelection: readOptionalString(row.github_repository_selection),
    id: row.id,
    installedAt: readTimestamp(row.installed_at),
    updatedAt: readTimestamp(row.updated_at),
    userEmail: normalizeEmail(row.user_email),
    verified: Boolean(row.verified),
  };
}

function readGitHubLinkHeaderNextUrl(linkHeader: string | null) {
  if (!linkHeader) {
    return null;
  }

  const entries = linkHeader.split(",").map((entry) => entry.trim());

  for (const entry of entries) {
    const match = /^<([^>]+)>;\s*rel="next"$/.exec(entry);

    if (match) {
      return match[1] ?? null;
    }
  }

  return null;
}

async function fetchAllGitHubUserInstallations(token: string) {
  const installations: GitHubUserInstallation[] = [];
  let nextUrl: string | null = "https://api.github.com/user/installations?per_page=100";

  for (let page = 0; page < 10 && nextUrl; page += 1) {
    const response = await fetch(nextUrl, {
      cache: "no-store",
      headers: buildGitHubApiHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`GitHub request failed: ${response.status}.`);
    }

    const payload = (await response.json()) as GitHubUserInstallationListResponse;
    installations.push(
      ...(Array.isArray(payload.installations) ? payload.installations : []),
    );
    nextUrl = readGitHubLinkHeaderNextUrl(response.headers.get("link"));
  }

  return installations;
}

async function fetchGitHubInstallationRepositories(
  installationId: string,
  token: string,
) {
  const repositories: GitHubInstallationRepository[] = [];
  let nextUrl: string | null =
    `https://api.github.com/user/installations/${encodeURIComponent(installationId)}/repositories?per_page=100`;

  for (let page = 0; page < 10 && nextUrl; page += 1) {
    const response = await fetch(nextUrl, {
      cache: "no-store",
      headers: buildGitHubApiHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`GitHub request failed: ${response.status}.`);
    }

    const payload = (await response.json()) as GitHubInstallationRepositoryListResponse;
    repositories.push(
      ...(Array.isArray(payload.repositories) ? payload.repositories : []),
    );
    nextUrl = readGitHubLinkHeaderNextUrl(response.headers.get("link"));
  }

  return repositories;
}

async function readPublicGitHubRepository(githubRepo: string) {
  const normalizedRepo = normalizeGitHubRepositoryName(githubRepo);
  const [owner, repo] = normalizedRepo.split("/");

  if (!owner || !repo) {
    return null;
  }

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "fugue-web",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 120 },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as GitHubRepositoryResponse;
  const fullName = readOptionalString(payload.full_name);

  if (
    payload.private === true ||
    !fullName ||
    normalizeGitHubRepositoryName(fullName) !== normalizedRepo
  ) {
    return null;
  }

  return {
    accountLogin: readOptionalString(payload.owner?.login),
    githubRepo: normalizedRepo,
  };
}

function normalizeGitHubRepoRepositorySelection(value: unknown) {
  const normalized = readOptionalString(value)?.toLowerCase();

  return normalized === "all" || normalized === "selected" ? normalized : null;
}

function isMatchingInstallation(item: GitHubUserInstallation) {
  const configuredSlug = readGitHubAppSlug().toLowerCase();
  const installationSlug = readOptionalString(item.app_slug)?.toLowerCase();

  if (installationSlug && installationSlug !== configuredSlug) {
    return false;
  }

  const itemAppId = readOptionalNumberString(item.app_id);
  const configuredAppId = process.env.GITHUB_APP_ID?.trim();

  if (configuredAppId && itemAppId && configuredAppId !== itemAppId) {
    return false;
  }

  return true;
}

function buildStatusFromRecord(
  record: GitHubAppInstallationRecord | null,
  source: GitHubAppInstallationStatus["source"],
  githubRepo = "",
): GitHubAppInstallationStatus {
  return {
    accountLogin: record?.accountLogin ?? null,
    checkedAt: record?.updatedAt ?? null,
    githubInstallationId: record?.githubInstallationId ?? null,
    githubRepo: record?.githubRepo ?? githubRepo,
    installed: Boolean(record),
    repositorySelection: record?.githubRepositorySelection ?? null,
    source,
    verified: Boolean(record?.verified),
  };
}

export function buildGitHubAppInstallStartHref(githubRepo: string, returnTo: string) {
  const url = new URL("/api/github/app/install/start", "http://localhost");
  url.searchParams.set("githubRepo", normalizeGitHubRepositoryName(githubRepo));
  if (returnTo.trim()) {
    url.searchParams.set("returnTo", returnTo.trim());
  }
  return `${url.pathname}${url.search}`;
}

export function readGitHubAppInstallUrl() {
  return resolveGitHubAppInstallUrl();
}

export async function getGitHubAppInstallationByRepo(
  userEmail: string,
  githubRepo: string,
) {
  await ensureDbSchema();

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubAppInstallationRow>(
      `
        SELECT
          id,
          user_email,
          github_repo,
          github_installation_id,
          github_account_login,
          github_repository_selection,
          verified,
          installed_at,
          updated_at
        FROM app_github_repo_installations
        WHERE user_email = $1
          AND github_repo = $2
        LIMIT 1
      `,
      [normalizeEmail(userEmail), normalizeGitHubRepositoryName(githubRepo)],
    ),
  );

  return result.rows[0] ? readGitHubAppInstallationFromRow(result.rows[0]) : null;
}

export async function upsertGitHubAppInstallation(input: {
  accountLogin?: string | null;
  githubInstallationId: string;
  githubRepo: string;
  githubRepositorySelection?: string | null;
  userEmail: string;
  verified?: boolean;
}) {
  await ensureDbSchema();

  const userEmail = normalizeEmail(input.userEmail);
  const githubRepo = normalizeGitHubRepositoryName(input.githubRepo);
  const githubInstallationId = input.githubInstallationId.trim();

  if (!githubInstallationId) {
    throw new Error("400 githubInstallationId is required.");
  }

  const result = await withDbSchemaRetry(() =>
    queryDb<GitHubAppInstallationRow>(
      `
        INSERT INTO app_github_repo_installations (
          id,
          user_email,
          github_repo,
          github_installation_id,
          github_account_login,
          github_repository_selection,
          verified,
          installed_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (user_email, github_repo)
        DO UPDATE SET
          github_installation_id = EXCLUDED.github_installation_id,
          github_account_login = EXCLUDED.github_account_login,
          github_repository_selection = EXCLUDED.github_repository_selection,
          verified = EXCLUDED.verified,
          updated_at = NOW()
        RETURNING
          id,
          user_email,
          github_repo,
          github_installation_id,
          github_account_login,
          github_repository_selection,
          verified,
          installed_at,
          updated_at
      `,
      [
        randomUUID(),
        userEmail,
        githubRepo,
        githubInstallationId,
        input.accountLogin?.trim() ?? "",
        input.githubRepositorySelection?.trim() ?? "",
        input.verified ?? true,
      ],
    ),
  );

  return readGitHubAppInstallationFromRow(
    requireQueryRow(result.rows[0], "Saving a GitHub App installation"),
  );
}

async function readGitHubAppInstallationFromGitHub(token: string, githubRepo: string) {
  const installations = await fetchAllGitHubUserInstallations(token);
  const normalizedRepo = normalizeGitHubRepositoryName(githubRepo);
  const installationEntries = installations.filter(isMatchingInstallation);

  for (const installation of installationEntries) {
    const installationId = readOptionalNumberString(installation.id);

    if (!installationId) {
      continue;
    }

    const repositories = await fetchGitHubInstallationRepositories(
      installationId,
      token,
    );

    const matched = repositories.some((repository) => {
      const fullName = readOptionalString(repository.full_name);
      return fullName
        ? normalizeGitHubRepositoryName(fullName) === normalizedRepo
        : false;
    });

    if (matched) {
      return {
        accountLogin: readOptionalString(installation.account?.login),
        githubInstallationId: installationId,
        repositorySelection: normalizeGitHubRepoRepositorySelection(
          installation.repository_selection,
        ),
      };
    }
  }

  return null;
}

export async function readGitHubAppInstallationStatusForRepo(input: {
  githubRepo: string;
  userEmail: string;
}) {
  await ensureDbSchema();

  const githubRepo = normalizeGitHubRepositoryName(input.githubRepo);
  const cachedRecord = await getGitHubAppInstallationByRepo(
    input.userEmail,
    githubRepo,
  );
  const connection = await getGitHubConnectionByEmail(input.userEmail);
  const readPublicRepoStatus = async () => {
    const publicRepo = await readPublicGitHubRepository(githubRepo).catch(() => null);

    if (!publicRepo) {
      return null;
    }

    return {
      accountLogin: publicRepo.accountLogin,
      checkedAt: new Date().toISOString(),
      githubInstallationId: null,
      githubRepo,
      installed: false,
      repositorySelection: null,
      source: "public-repo" as const,
      verified: false,
    };
  };

  if (connection?.accessToken) {
    try {
      const liveRecord = await readGitHubAppInstallationFromGitHub(
        connection.accessToken,
        githubRepo,
      );

      if (liveRecord) {
        const record = await upsertGitHubAppInstallation({
          accountLogin: liveRecord.accountLogin,
          githubInstallationId: liveRecord.githubInstallationId,
          githubRepo,
          githubRepositorySelection: liveRecord.repositorySelection,
          userEmail: input.userEmail,
          verified: true,
        });

        return {
          cachedRecord,
          record,
          status: buildStatusFromRecord(record, "live", githubRepo),
        } as const;
      }

      const publicRepoStatus = cachedRecord ? null : await readPublicRepoStatus();

      if (publicRepoStatus) {
        return {
          cachedRecord,
          record: cachedRecord,
          status: publicRepoStatus,
        } as const;
      }

      return {
        cachedRecord,
        record: cachedRecord,
        status: {
          accountLogin: cachedRecord?.accountLogin ?? null,
          checkedAt: new Date().toISOString(),
          githubInstallationId: cachedRecord?.githubInstallationId ?? null,
          githubRepo,
          installed: false,
          repositorySelection: cachedRecord?.githubRepositorySelection ?? null,
          source: "missing",
          verified: false,
        } as const,
      } as const;
    } catch {
      if (cachedRecord) {
        return {
          cachedRecord,
          record: cachedRecord,
          status: buildStatusFromRecord(cachedRecord, "cached", githubRepo),
        } as const;
      }

      const publicRepoStatus = await readPublicRepoStatus();

      if (publicRepoStatus) {
        return {
          cachedRecord: null,
          record: null,
          status: publicRepoStatus,
        } as const;
      }

      return {
        cachedRecord: null,
        record: null,
        status: {
          accountLogin: null,
          checkedAt: null,
          githubInstallationId: null,
          githubRepo,
          installed: false,
          repositorySelection: null,
          source: "error",
          verified: false,
        } as const,
      } as const;
    }
  }

  if (cachedRecord) {
    return {
      cachedRecord,
      record: cachedRecord,
      status: buildStatusFromRecord(cachedRecord, "cached", githubRepo),
    } as const;
  }

  const publicRepoStatus = await readPublicRepoStatus();

  if (publicRepoStatus) {
    return {
      cachedRecord: null,
      record: null,
      status: publicRepoStatus,
    } as const;
  }

  return {
    cachedRecord: null,
    record: null,
    status: {
      accountLogin: null,
      checkedAt: null,
      githubInstallationId: null,
      githubRepo,
      installed: false,
      repositorySelection: null,
      source: connection ? "missing" : "connection-missing",
      verified: false,
    } as const,
  } as const;
}

export async function recordGitHubAppInstallationCallback(input: {
  accountLogin?: string | null;
  githubInstallationId: string;
  githubRepo: string;
  githubRepositorySelection?: string | null;
  userEmail: string;
}) {
  return upsertGitHubAppInstallation({
    accountLogin: input.accountLogin,
    githubInstallationId: input.githubInstallationId,
    githubRepo: input.githubRepo,
    githubRepositorySelection: input.githubRepositorySelection,
    userEmail: input.userEmail,
    verified: false,
  });
}
