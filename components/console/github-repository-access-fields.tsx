import { ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import type { GitHubRepoVisibility } from "@/lib/github/repository";
import type { GitHubConnectionView } from "@/lib/github/types";

const REPOSITORY_ACCESS_OPTIONS: readonly SegmentedControlOption<GitHubRepoVisibility>[] = [
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

export function GitHubRepositoryAccessFields({
  githubConnectHref = null,
  githubConnection = null,
  githubConnectionError = null,
  githubConnectionLoading = false,
  token,
  tokenFieldId,
  tokenHint = "Paste a GitHub token with repository read access. If GitHub web authorization is available, Fugue can use that instead and store the resolved secret server-side for later rebuilds and syncs.",
  tokenLabel = "GitHub token",
  tokenRequired = false,
  visibility,
  visibilityHint = "Choose whether Fugue reads this repository anonymously or through saved private access.",
  visibilityLabel = "Repository access",
  onTokenChange,
  onVisibilityChange,
}: {
  githubConnectHref?: string | null;
  githubConnection?: GitHubConnectionView | null;
  githubConnectionError?: string | null;
  githubConnectionLoading?: boolean;
  token: string;
  tokenFieldId: string;
  tokenHint?: string;
  tokenLabel?: string;
  tokenRequired?: boolean;
  visibility: GitHubRepoVisibility;
  visibilityHint?: string;
  visibilityLabel?: string;
  onTokenChange: (value: string) => void;
  onVisibilityChange: (value: GitHubRepoVisibility) => void;
}) {
  const hasSavedGitHubAccess = Boolean(githubConnection?.connected);
  const canReconnectGitHub =
    Boolean(githubConnectHref) && Boolean(githubConnection?.authEnabled);
  const resolvedTokenRequired =
    tokenRequired &&
    visibility === "private" &&
    !hasSavedGitHubAccess &&
    !githubConnectionLoading;
  const resolvedTokenHint =
    visibility === "private" && hasSavedGitHubAccess
      ? githubConnection?.login
        ? `Saved GitHub access is ready as @${githubConnection.login}. Paste a token only to override it for this import.`
        : "Saved GitHub access is ready. Paste a token only to override it for this import."
      : visibility === "private" &&
          githubConnection?.authEnabled &&
          !githubConnectionError
        ? "Authorize GitHub in the browser, or paste a GitHub token. Fugue stores the resolved secret server-side for later rebuilds and syncs."
        : tokenHint;

  return (
    <>
      <div className="fg-field-stack">
        <div className="fg-field-label">
          <span>{visibilityLabel}</span>
        </div>
        <div className="fg-field-control">
          <SegmentedControl
            ariaLabel={visibilityLabel}
            onChange={onVisibilityChange}
            options={REPOSITORY_ACCESS_OPTIONS}
            value={visibility}
          />
        </div>
        <span className="fg-field-hint">{visibilityHint}</span>
      </div>

      {visibility === "private" ? (
        <>
          {githubConnectionLoading ? (
            <InlineAlert>Checking saved GitHub access…</InlineAlert>
          ) : githubConnectionError ? (
            <InlineAlert variant="warning">
              {githubConnectionError}
              {canReconnectGitHub ? (
                <>
                  {" "}
                  <ButtonAnchor href={githubConnectHref!} size="compact" variant="secondary">
                    Reconnect GitHub
                  </ButtonAnchor>
                </>
              ) : null}
            </InlineAlert>
          ) : hasSavedGitHubAccess ? (
            <InlineAlert variant="success">
              {githubConnection?.login
                ? `Authorized as @${githubConnection.login}.`
                : "Saved GitHub access is available."}
              {canReconnectGitHub ? (
                <>
                  {" "}
                  <ButtonAnchor href={githubConnectHref!} size="compact" variant="secondary">
                    Reconnect GitHub
                  </ButtonAnchor>
                </>
              ) : null}
            </InlineAlert>
          ) : githubConnection?.authEnabled && githubConnectHref ? (
            <InlineAlert>
              Authorize GitHub in the browser, or paste a token below.
              {" "}
              <ButtonAnchor href={githubConnectHref} size="compact" variant="secondary">
                Connect GitHub
              </ButtonAnchor>
            </InlineAlert>
          ) : null}

          <FormField
            hint={resolvedTokenHint}
            htmlFor={tokenFieldId}
            label={tokenLabel}
            optionalLabel={resolvedTokenRequired ? undefined : "Optional"}
          >
            <input
              autoCapitalize="none"
              autoComplete="new-password"
              className="fg-input"
              id={tokenFieldId}
              name="repoAuthToken"
              onChange={(event) => onTokenChange(event.target.value)}
              placeholder={
                hasSavedGitHubAccess
                  ? "Paste a token to override saved GitHub access"
                  : "github_pat_..."
              }
              required={resolvedTokenRequired}
              spellCheck={false}
              type="password"
              value={token}
            />
          </FormField>
        </>
      ) : null}
    </>
  );
}
