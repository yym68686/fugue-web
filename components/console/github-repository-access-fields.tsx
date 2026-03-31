import { FormField } from "@/components/ui/form-field";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import type { GitHubRepoVisibility } from "@/lib/github/repository";

const REPOSITORY_ACCESS_OPTIONS: readonly SegmentedControlOption<GitHubRepoVisibility>[] = [
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

export function GitHubRepositoryAccessFields({
  token,
  tokenFieldId,
  tokenHint = "Use a GitHub token with repository read access. Fugue stores it server-side for later rebuilds and syncs.",
  tokenLabel = "GitHub token",
  tokenRequired = false,
  visibility,
  visibilityHint = "Choose whether Fugue reads this repository anonymously or with a stored token.",
  visibilityLabel = "Repository access",
  onTokenChange,
  onVisibilityChange,
}: {
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
        <FormField
          hint={tokenHint}
          htmlFor={tokenFieldId}
          label={tokenLabel}
          optionalLabel={tokenRequired ? undefined : "Optional"}
        >
          <input
            autoCapitalize="none"
            autoComplete="new-password"
            className="fg-input"
            id={tokenFieldId}
            name="repoAuthToken"
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="github_pat_..."
            required={tokenRequired}
            spellCheck={false}
            type="password"
            value={token}
          />
        </FormField>
      ) : null}
    </>
  );
}
