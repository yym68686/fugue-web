import { ButtonAnchor } from "@/components/ui/button";
import {
  ConsolePillSwitch,
  type ConsolePillSwitchOption,
} from "@/components/console/console-pill-switch";
import { useI18n } from "@/components/providers/i18n-provider";
import { FormField } from "@/components/ui/form-field";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { InlineAlert } from "@/components/ui/inline-alert";
import type { GitHubRepoVisibility } from "@/lib/github/repository";
import type { GitHubConnectionView } from "@/lib/github/types";

export function GitHubRepositoryAccessFields({
  githubConnectHref = null,
  githubConnection = null,
  githubConnectionError = null,
  githubConnectionLoading = false,
  token,
  tokenFieldId,
  tokenHint,
  tokenLabel,
  tokenRequired = false,
  visibility,
  visibilityHint,
  visibilityLabel,
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
  const { t } = useI18n();
  const repositoryAccessOptions: readonly ConsolePillSwitchOption<GitHubRepoVisibility>[] =
    [
      { label: t("Public"), value: "public" },
      { label: t("Private"), value: "private" },
    ];
  const hasSavedGitHubAccess = Boolean(githubConnection?.connected);
  const canReconnectGitHub =
    Boolean(githubConnectHref) && Boolean(githubConnection?.authEnabled);
  const resolvedTokenLabel = tokenLabel ?? t("GitHub token");
  const resolvedVisibilityLabel = visibilityLabel ?? t("Repository access");
  const resolvedVisibilityHint =
    visibilityHint ??
    t(
      "Choose whether Fugue reads this repository anonymously or through saved private access.",
    );
  const defaultTokenHint =
    tokenHint ??
    t(
      "Paste a GitHub token with repository read access. If GitHub web authorization is available, Fugue can use that instead and store the resolved secret server-side for later rebuilds and syncs.",
    );
  const resolvedTokenRequired =
    tokenRequired &&
    visibility === "private" &&
    !hasSavedGitHubAccess &&
    !githubConnectionLoading;
  const resolvedTokenHint =
    visibility === "private" && hasSavedGitHubAccess
      ? githubConnection?.login
        ? t(
            "Saved GitHub access is ready as @{login}. Paste a token only to override it for this import.",
            { login: githubConnection.login },
          )
        : t(
            "Saved GitHub access is ready. Paste a token only to override it for this import.",
          )
      : visibility === "private" &&
          githubConnection?.authEnabled &&
          !githubConnectionError
        ? t(
            "Authorize GitHub in the browser, or paste a GitHub token. Fugue stores the resolved secret server-side for later rebuilds and syncs.",
          )
        : defaultTokenHint;

  return (
    <>
      <div className="fg-field-stack">
        <div className="fg-field-label">
          <span className="fg-field-label__main">
            <span className="fg-field-label__text">{resolvedVisibilityLabel}</span>
            {resolvedVisibilityHint ? (
              <HintTooltip ariaLabel={resolvedVisibilityLabel}>{resolvedVisibilityHint}</HintTooltip>
            ) : null}
          </span>
        </div>
        <div className="fg-field-control">
          <ConsolePillSwitch
            ariaLabel={resolvedVisibilityLabel}
            onChange={onVisibilityChange}
            options={repositoryAccessOptions}
            value={visibility}
          />
        </div>
      </div>

      {visibility === "private" ? (
        <>
          {githubConnectionLoading ? (
            <InlineAlert>{t("Checking saved GitHub access…")}</InlineAlert>
          ) : githubConnectionError ? (
            <InlineAlert variant="warning">
              {githubConnectionError}
              {canReconnectGitHub ? (
                <>
                  {" "}
                  <ButtonAnchor href={githubConnectHref!} size="compact" variant="secondary">
                    {t("Reconnect GitHub")}
                  </ButtonAnchor>
                </>
              ) : null}
            </InlineAlert>
          ) : hasSavedGitHubAccess ? (
            <InlineAlert variant="success">
              {githubConnection?.login
                ? t("Authorized as @{login}.", {
                    login: githubConnection.login,
                  })
                : t("Saved GitHub access is available.")}
              {canReconnectGitHub ? (
                <>
                  {" "}
                  <ButtonAnchor href={githubConnectHref!} size="compact" variant="secondary">
                    {t("Reconnect GitHub")}
                  </ButtonAnchor>
                </>
              ) : null}
            </InlineAlert>
          ) : githubConnection?.authEnabled && githubConnectHref ? (
            <InlineAlert>
              {t("Authorize GitHub in the browser, or paste a token below.")}
              {" "}
              <ButtonAnchor href={githubConnectHref} size="compact" variant="secondary">
                {t("Connect GitHub")}
              </ButtonAnchor>
            </InlineAlert>
          ) : null}

          <FormField
            hint={resolvedTokenHint}
            htmlFor={tokenFieldId}
            label={resolvedTokenLabel}
            optionalLabel={resolvedTokenRequired ? undefined : t("Optional")}
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
                  ? t("Paste a token to override saved GitHub access")
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
