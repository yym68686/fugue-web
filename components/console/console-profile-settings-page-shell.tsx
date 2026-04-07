"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import { ConsoleLoadingState } from "@/components/console/console-page-skeleton";
import { StatusBadge } from "@/components/console/status-badge";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import {
  readAuthMethodLabel,
  readProviderLabel,
  readSessionLabel,
  readSessionMonogram,
  readVerificationLabel,
} from "@/lib/auth/presenters";
import { sanitizeDisplayName } from "@/lib/auth/validation";
import {
  CONSOLE_PROFILE_SETTINGS_PAGE_SNAPSHOT_URL,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { ConsoleProfileSettingsPageSnapshot } from "@/lib/console/page-snapshot-types";
import { requestJson } from "@/lib/ui/request-json";

type ProfileMethodKey = ConsoleProfileSettingsPageSnapshot["methods"][number]["method"];

const PASSWORD_HINT = "Use at least 10 characters. Spaces are allowed.";
const PROFILE_AUTH_FLASH_TOASTS = {
  "github-link-conflict": {
    message: "That GitHub account is already linked to another Fugue account.",
    variant: "error" as const,
  },
  "github-link-failed": {
    message: "GitHub could not be linked right now. Try again.",
    variant: "error" as const,
  },
  "github-linked": {
    message: "GitHub sign-in linked.",
    variant: "success" as const,
  },
  "github-unavailable": {
    message: "GitHub sign-in is not configured in this environment.",
    variant: "info" as const,
  },
  "google-link-conflict": {
    message: "That Google account is already linked to another Fugue account.",
    variant: "error" as const,
  },
  "google-link-failed": {
    message: "Google could not be linked right now. Try again.",
    variant: "error" as const,
  },
  "google-linked": {
    message: "Google sign-in linked.",
    variant: "success" as const,
  },
  "google-unavailable": {
    message: "Google sign-in is not configured in this environment.",
    variant: "info" as const,
  },
} satisfies Record<
  string,
  {
    message: string;
    variant: "error" | "info" | "success";
  }
>;

function readMethodSlug(method: ProfileMethodKey) {
  switch (method) {
    case "email_link":
      return "email-link";
    case "password":
      return "password";
    case "google":
      return "google";
    case "github":
      return "github";
    default:
      return method;
  }
}

function readMethodDescription(method: Exclude<ProfileMethodKey, "password">) {
  switch (method) {
    case "google":
      return "Use a linked Google or Gmail identity to reopen the console.";
    case "github":
      return "Use GitHub for sign-in. Repository authorization still lives in Workspace settings.";
    case "email_link":
      return "Send a one-time verification link to the account email on the sign-in page.";
    default:
      return "";
  }
}

function readMethodDetail(
  method: Exclude<ProfileMethodKey, "password">,
  record: ConsoleProfileSettingsPageSnapshot["methods"][number] | undefined,
  email: string,
) {
  if (method === "email_link") {
    return record ? email : "Disabled on this account.";
  }

  if (!record) {
    return "Not linked yet.";
  }

  return record.providerLabel ?? "Linked";
}

function readTimestampLabel(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function ProfileIdentityPanel({
  onUpdated,
  session,
  user,
}: {
  onUpdated: () => Promise<void>;
  session: ConsoleProfileSettingsPageSnapshot["session"];
  user: ConsoleProfileSettingsPageSnapshot["user"];
}) {
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user.name ?? "");
  }, [user.name]);

  const normalizedDraft = sanitizeDisplayName(displayName);
  const isDirty = normalizedDraft !== (user.name ?? "");
  const sessionLabel = readSessionLabel(user);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isDirty || saving) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: normalizedDraft,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        user?: {
          name?: string | null;
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update your profile.");
      }

      setDisplayName(payload.user?.name ?? normalizedDraft);
      await onUpdated();
      showToast({
        message: "Profile updated.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not update your profile.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">Profile</p>
        <PanelTitle>Personal details</PanelTitle>
        <PanelCopy>
          Update the name shown in the console while keeping the current account email fixed.
        </PanelCopy>
      </PanelSection>

      <PanelSection className="fg-profile-identity">
        <span className="fg-console-profile__avatar fg-profile-identity__avatar" aria-hidden="true">
          {readSessionMonogram(sessionLabel)}
        </span>

        <div className="fg-profile-identity__copy">
          <strong>{sessionLabel}</strong>
          <span>{user.email}</span>

          <div className="fg-console-inline-status">
            <StatusBadge tone="neutral">
              {readAuthMethodLabel(session.authMethod, session.provider)}
            </StatusBadge>
            <StatusBadge tone="neutral">{readProviderLabel(session.provider)}</StatusBadge>
            <StatusBadge tone={session.verified ? "positive" : "warning"}>
              {readVerificationLabel(session.verified)}
            </StatusBadge>
          </div>
        </div>
      </PanelSection>

      <PanelSection>
        <form className="fg-settings-form fg-profile-form" onSubmit={(event) => void handleSubmit(event)}>
          <FormField
            hint="Shown in the console header and account surfaces."
            htmlFor="profile-display-name"
            label="Display name"
            optionalLabel="Optional"
          >
            <input
              className="fg-input"
              id="profile-display-name"
              maxLength={80}
              name="displayName"
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              placeholder="How Fugue should address you"
              type="text"
              value={displayName}
            />
          </FormField>

          <div className="fg-settings-form__actions">
            <Button
              disabled={!isDirty}
              loading={saving}
              loadingLabel="Saving"
              type="submit"
              variant="primary"
            >
              Save profile
            </Button>
          </div>
        </form>

        <dl className="fg-settings-meta fg-profile-meta">
          <div>
            <dt>Account email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{readTimestampLabel(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Last sign-in</dt>
            <dd>{readTimestampLabel(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt>Current provider</dt>
            <dd>{readProviderLabel(session.provider)}</dd>
          </div>
        </dl>
      </PanelSection>
    </Panel>
  );
}

function SignInMethodsPanel({
  data,
  onUpdated,
}: {
  data: ConsoleProfileSettingsPageSnapshot;
  onUpdated: () => Promise<void>;
}) {
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const [busyMethod, setBusyMethod] = useState<Exclude<ProfileMethodKey, "password"> | null>(null);
  const methodCount = data.methods.length;
  const methodMap = new Map(data.methods.map((method) => [method.method, method]));
  const items = [
    {
      actionHref: data.availableMethods.google
        ? `/api/auth/google/link/start?returnTo=${encodeURIComponent("/app/settings/profile")}`
        : null,
      available: data.availableMethods.google,
      key: "google" as const,
      title: "Google",
    },
    {
      actionHref: data.availableMethods.github
        ? `/api/auth/github/link/start?returnTo=${encodeURIComponent("/app/settings/profile")}`
        : null,
      available: data.availableMethods.github,
      key: "github" as const,
      title: "GitHub",
    },
    {
      actionHref: null,
      available: true,
      key: "email_link" as const,
      title: "Email link",
    },
  ];

  async function refreshAfterAction(successMessage: string) {
    await onUpdated();
    showToast({
      message: successMessage,
      variant: "success",
    });
  }

  async function handleEnableEmailLink() {
    if (busyMethod) {
      return;
    }

    setBusyMethod("email_link");

    try {
      await requestJson(`/api/auth/methods/${readMethodSlug("email_link")}`, {
        method: "POST",
      });
      await refreshAfterAction("Email link sign-in enabled.");
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not enable email link sign-in.",
        variant: "error",
      });
    } finally {
      setBusyMethod(null);
    }
  }

  async function handleDisableMethod(method: Exclude<ProfileMethodKey, "password">) {
    if (busyMethod) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel:
        method === "email_link" ? "Disable email link" : `Disconnect ${readAuthMethodLabel(method)}`,
      description:
        data.session.authMethod === method
          ? "The current browser session stays open, but future sign-ins will need another linked method."
          : "Keep another sign-in method linked before removing this one.",
      title:
        method === "email_link"
          ? "Disable email link sign-in?"
          : `Disconnect ${readAuthMethodLabel(method)} sign-in?`,
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    setBusyMethod(method);

    try {
      await requestJson(`/api/auth/methods/${readMethodSlug(method)}`, {
        method: "DELETE",
      });
      await refreshAfterAction(
        method === "email_link"
          ? "Email link sign-in disabled."
          : `${readAuthMethodLabel(method)} sign-in disconnected.`,
      );
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not update the sign-in method.",
        variant: "error",
      });
    } finally {
      setBusyMethod(null);
    }
  }

  return (
    <Panel>
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">Sign-in methods</p>
        <PanelTitle>Linked providers</PanelTitle>
        <PanelCopy>
          Keep at least one sign-in method active so the account never gets locked out.
        </PanelCopy>
      </PanelSection>

      <PanelSection>
        {methodCount <= 1 ? (
          <>
            <InlineAlert variant="warning">
              This account currently has one sign-in method left. Connect another method before removing it.
            </InlineAlert>
            <div style={{ height: "0.9rem" }} aria-hidden="true" />
          </>
        ) : null}

        <ul className="fg-profile-method-list">
          {items.map((item) => {
            const record = methodMap.get(item.key);
            const linked = Boolean(record);
            const isCurrentSession = data.session.authMethod === item.key;
            const canDisconnect = linked && methodCount > 1;

            return (
              <li className="fg-profile-method" key={item.key}>
                <div className="fg-profile-method__row">
                  <div className="fg-profile-method__copy">
                    <div className="fg-profile-method__heading">
                      <strong>{item.title}</strong>

                      <div className="fg-console-inline-status">
                        <StatusBadge tone={linked ? "positive" : item.available ? "neutral" : "warning"}>
                          {linked ? "Connected" : item.available ? "Available" : "Unavailable"}
                        </StatusBadge>
                        {isCurrentSession ? (
                          <StatusBadge tone="info">Current session</StatusBadge>
                        ) : null}
                      </div>
                    </div>

                    <p className="fg-profile-method__description">
                      {readMethodDescription(item.key)}
                    </p>
                    <p className="fg-profile-method__meta">
                      {readMethodDetail(item.key, record, data.user.email)}
                    </p>
                  </div>

                  <div className="fg-profile-method__actions">
                    {item.key === "email_link" ? (
                      linked ? (
                        <Button
                          disabled={!canDisconnect}
                          loading={busyMethod === item.key}
                          loadingLabel="Updating"
                          onClick={() => {
                            void handleDisableMethod(item.key);
                          }}
                          type="button"
                          variant="danger"
                        >
                          Disable email link
                        </Button>
                      ) : (
                        <Button
                          loading={busyMethod === item.key}
                          loadingLabel="Enabling"
                          onClick={() => {
                            void handleEnableEmailLink();
                          }}
                          type="button"
                          variant="secondary"
                        >
                          Enable email link
                        </Button>
                      )
                    ) : linked ? (
                      <Button
                        disabled={!canDisconnect}
                        loading={busyMethod === item.key}
                        loadingLabel="Disconnecting"
                        onClick={() => {
                          void handleDisableMethod(item.key);
                        }}
                        type="button"
                        variant="danger"
                      >
                        Disconnect
                      </Button>
                    ) : item.available && item.actionHref ? (
                      <ButtonAnchor href={item.actionHref} variant="primary">
                        Connect {item.title}
                      </ButtonAnchor>
                    ) : null}
                  </div>
                </div>

                {linked && !canDisconnect ? (
                  <p className="fg-profile-method__hint">
                    Keep at least one sign-in method available before disconnecting this one.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </PanelSection>
    </Panel>
  );
}

function PasswordSettingsPanel({
  data,
  onUpdated,
}: {
  data: ConsoleProfileSettingsPageSnapshot;
  onUpdated: () => Promise<void>;
}) {
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const hasPassword = data.methods.some((method) => method.method === "password");
  const canRemovePassword = hasPassword && data.methods.length > 1;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    confirmPassword?: string;
    currentPassword?: string;
    newPassword?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const nextErrors: {
      confirmPassword?: string;
      currentPassword?: string;
      newPassword?: string;
    } = {};

    if (newPassword !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/methods/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        fieldErrors?: {
          confirmPassword?: string;
          currentPassword?: string;
          newPassword?: string;
        };
        message?: string;
      };

      if (!response.ok) {
        setFieldErrors(payload.fieldErrors ?? {});
        throw new Error(payload.error ?? "Could not save the password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await onUpdated();
      showToast({
        message: payload.message ?? (hasPassword ? "Password updated." : "Password added."),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not save the password.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemovePassword() {
    if (removing) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Remove password",
      description:
        data.session.authMethod === "password"
          ? "The current browser session stays open, but the next sign-in will need another linked method."
          : "Keep another sign-in method linked before removing the stored password.",
      title: "Remove password sign-in?",
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    setRemoving(true);

    try {
      await requestJson("/api/auth/methods/password", {
        method: "DELETE",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await onUpdated();
      showToast({
        message: "Password removed.",
        variant: "success",
      });
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not remove the password.",
        variant: "error",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Panel>
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">Security</p>
        <PanelTitle>{hasPassword ? "Change password" : "Add a password"}</PanelTitle>
        <PanelCopy>
          Registration still uses a verification link. Password sign-in is only for returning access.
        </PanelCopy>
      </PanelSection>

      <PanelSection>
        {data.session.authMethod === "password" ? (
          <>
            <InlineAlert variant="info">
              This session was opened with a password. Changing or removing it will not close the current browser session.
            </InlineAlert>
            <div style={{ height: "0.9rem" }} aria-hidden="true" />
          </>
        ) : null}

        {hasPassword && !canRemovePassword ? (
          <>
            <InlineAlert variant="warning">
              Add or reconnect another sign-in method before removing the password from this account.
            </InlineAlert>
            <div style={{ height: "0.9rem" }} aria-hidden="true" />
          </>
        ) : null}

        <form className="fg-settings-form fg-profile-password-form" onSubmit={(event) => void handleSubmit(event)}>
          {hasPassword ? (
            <FormField
              error={fieldErrors.currentPassword}
              hint="Required before the password can be changed."
              htmlFor="profile-current-password"
              label="Current password"
            >
              <input
                autoComplete="current-password"
                className="fg-input"
                id="profile-current-password"
                name="currentPassword"
                onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
              />
            </FormField>
          ) : null}

          <FormField
            error={fieldErrors.newPassword}
            hint={PASSWORD_HINT}
            htmlFor="profile-new-password"
            label={hasPassword ? "New password" : "Password"}
          >
            <input
              autoComplete={hasPassword ? "new-password" : "current-password"}
              className="fg-input"
              id="profile-new-password"
              name="newPassword"
              onChange={(event) => setNewPassword(event.currentTarget.value)}
              type={showPasswords ? "text" : "password"}
              value={newPassword}
            />
          </FormField>

          <FormField
            error={fieldErrors.confirmPassword}
            hint="Repeat the password once to confirm it."
            htmlFor="profile-confirm-password"
            label="Confirm password"
          >
            <input
              autoComplete="new-password"
              className="fg-input"
              id="profile-confirm-password"
              name="confirmPassword"
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
            />
          </FormField>

          <label className="fg-password-toggle">
            <input
              checked={showPasswords}
              onChange={(event) => setShowPasswords(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>Show passwords</span>
          </label>

          <div className="fg-settings-form__actions">
            <Button
              loading={submitting}
              loadingLabel="Saving"
              type="submit"
              variant="primary"
            >
              {hasPassword ? "Update password" : "Add password"}
            </Button>

            {hasPassword ? (
              <Button
                disabled={!canRemovePassword}
                loading={removing}
                loadingLabel="Removing"
                onClick={() => {
                  void handleRemovePassword();
                }}
                type="button"
                variant="danger"
              >
                Remove password
              </Button>
            ) : null}
          </div>
        </form>
      </PanelSection>
    </Panel>
  );
}

export function ConsoleProfileSettingsPageShell() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleProfileSettingsPageSnapshot>(
      CONSOLE_PROFILE_SETTINGS_PAGE_SNAPSHOT_URL,
    );

  useEffect(() => {
    const profileAuth = searchParams.get("profileAuth");

    if (!profileAuth) {
      return;
    }

    const toast =
      profileAuth in PROFILE_AUTH_FLASH_TOASTS
        ? PROFILE_AUTH_FLASH_TOASTS[
            profileAuth as keyof typeof PROFILE_AUTH_FLASH_TOASTS
          ]
        : null;

    if (toast) {
      showToast(toast);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("profileAuth");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, showToast]);

  async function handleRefresh() {
    await refresh({
      force: true,
    });
  }

  if (loading && !data) {
    return (
      <ConsoleLoadingState label="Loading profile settings">
        <div className="fg-console-page">
          <ConsolePageIntro
            actions={[
              { href: "/app", label: "Back to projects" },
              { href: "/app/settings/workspace", label: "Workspace access" },
            ]}
            description="Loading your profile, current session, and sign-in methods."
            eyebrow="Account"
            title="Profile and security"
          />

          <section className="fg-console-two-up">
            <Panel>
              <PanelSection>
                <PanelTitle>Loading profile…</PanelTitle>
                <PanelCopy>Reading the account identity and saved sign-in methods.</PanelCopy>
              </PanelSection>
            </Panel>

            <Panel>
              <PanelSection>
                <PanelTitle>Loading current session…</PanelTitle>
                <PanelCopy>Checking how this browser session was opened.</PanelCopy>
              </PanelSection>
            </Panel>
          </section>
        </div>
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsolePageIntro
          actions={[
            { href: "/app", label: "Back to projects" },
            { href: "/app/settings/workspace", label: "Workspace access" },
          ]}
          description="Display name, current session state, and every sign-in path linked to this account."
          eyebrow="Account"
          title="Profile and security"
        />

        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={error ?? "Fugue could not load the profile settings right now."}
              title="Profile settings unavailable"
            />
          </PanelSection>
        </Panel>
      </div>
    );
  }

  return (
    <div className="fg-console-page">
      <ConsolePageIntro
        actions={[
          { href: "/app", label: "Back to projects" },
          { href: "/app/settings/workspace", label: "Workspace access" },
        ]}
        description="Display name, current session state, and every sign-in path linked to this account."
        eyebrow="Account"
        title="Profile and security"
      />

      <section className="fg-console-two-up">
        <ProfileIdentityPanel
          onUpdated={handleRefresh}
          session={data.session}
          user={data.user}
        />

        <Panel>
          <PanelSection>
            <p className="fg-label fg-panel__eyebrow">Current session</p>
            <PanelTitle>This browser session</PanelTitle>
            <PanelCopy>
              See how the current browser session was opened before you change a provider or password.
            </PanelCopy>
          </PanelSection>

          <PanelSection>
            <div className="fg-console-inline-status">
              <StatusBadge tone="info">Current session</StatusBadge>
              <StatusBadge tone="neutral">
                {readAuthMethodLabel(data.session.authMethod, data.session.provider)}
              </StatusBadge>
              <StatusBadge tone={data.session.verified ? "positive" : "warning"}>
                {readVerificationLabel(data.session.verified)}
              </StatusBadge>
            </div>

            <dl className="fg-settings-meta fg-profile-meta">
              <div>
                <dt>Account</dt>
                <dd>{readSessionLabel(data.session)}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{data.session.email}</dd>
              </div>
              <div>
                <dt>Sign-in method</dt>
                <dd>{readAuthMethodLabel(data.session.authMethod, data.session.provider)}</dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{readProviderLabel(data.session.provider)}</dd>
              </div>
              <div>
                <dt>Verified</dt>
                <dd>{readVerificationLabel(data.session.verified)}</dd>
              </div>
              <div>
                <dt>Last sign-in</dt>
                <dd>{readTimestampLabel(data.user.lastLoginAt)}</dd>
              </div>
            </dl>
          </PanelSection>
        </Panel>
      </section>

      <SignInMethodsPanel data={data} onUpdated={handleRefresh} />
      <PasswordSettingsPanel data={data} onUpdated={handleRefresh} />
    </div>
  );
}
