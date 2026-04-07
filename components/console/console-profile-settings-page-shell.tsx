"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import {
  ConsoleLoadingState,
  ConsoleProfileSettingsPageSkeleton,
} from "@/components/console/console-page-skeleton";
import { StatusBadge } from "@/components/console/status-badge";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Panel, PanelCopy, PanelSection, PanelTitle } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import {
  readAuthMethodLabel,
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
import { cx } from "@/lib/ui/cx";

type ProfileMethodKey = ConsoleProfileSettingsPageSnapshot["methods"][number]["method"];
type ProfileMethodRecord = ConsoleProfileSettingsPageSnapshot["methods"][number];

const PASSWORD_HINT = "Use at least 10 characters. Spaces are allowed.";
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");
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

function readFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      const style = window.getComputedStyle(element);

      return style.display !== "none" && style.visibility !== "hidden";
    },
  );
}

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
      return "Use GitHub as another return path into the console.";
    case "email_link":
      return "Send a one-time verification link to the account email on the sign-in page.";
    default:
      return "";
  }
}

function readMethodDetail(
  method: Exclude<ProfileMethodKey, "password">,
  record: ProfileMethodRecord | undefined,
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

function countConnectedProviders(methodMap: Map<ProfileMethodKey, ProfileMethodRecord>) {
  let count = 0;

  if (methodMap.has("google")) {
    count += 1;
  }

  if (methodMap.has("github")) {
    count += 1;
  }

  if (methodMap.has("email_link") || methodMap.has("password")) {
    count += 1;
  }

  return count;
}

function readProviderMark(provider: "email" | "github" | "google") {
  switch (provider) {
    case "google":
      return "G";
    case "github":
      return "GH";
    case "email":
      return "@";
    default:
      return "?";
  }
}

function readProviderIdleDetail(
  provider: "github" | "google",
  available: boolean,
) {
  if (!available) {
    return "Not configured in this environment.";
  }

  switch (provider) {
    case "google":
      return "Ready to connect when you want a Google-based return path.";
    case "github":
      return "Ready to connect when you want GitHub-based sign-in.";
    default:
      return "Ready to connect.";
  }
}

function ProviderMark({
  provider,
}: {
  provider: "email" | "github" | "google";
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("fg-profile-auth-provider__mark", `is-${provider}`)}
    >
      {readProviderMark(provider)}
    </span>
  );
}

function ProviderSummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="fg-profile-auth-summary__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ExternalProviderSurface({
  actionHref,
  available,
  busy,
  detail,
  description,
  isCurrentSession,
  linked,
  onDisconnect,
  provider,
  title,
}: {
  actionHref: string | null;
  available: boolean;
  busy: boolean;
  detail: string;
  description: string;
  isCurrentSession: boolean;
  linked: boolean;
  onDisconnect: () => void;
  provider: "github" | "google";
  title: string;
}) {
  const statusTone = linked ? "positive" : available ? "neutral" : "warning";
  const statusLabel = linked ? "Connected" : available ? "Available" : "Unavailable";

  return (
    <section
      className={cx(
        "fg-profile-auth-provider",
        linked && "is-connected",
        !available && !linked && "is-muted",
      )}
    >
      <div className="fg-profile-auth-provider__header">
        <div className="fg-profile-auth-provider__identity">
          <ProviderMark provider={provider} />

          <div className="fg-profile-auth-provider__copy">
            <div className="fg-profile-auth-provider__headline">
              <strong>{title}</strong>

              <div className="fg-console-inline-status">
                <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
                {isCurrentSession ? <StatusBadge tone="info">In use</StatusBadge> : null}
              </div>
            </div>

            <p className="fg-profile-auth-provider__description">{description}</p>
          </div>
        </div>
      </div>

      <div className="fg-profile-auth-provider__footer">
        <p className="fg-profile-auth-provider__detail">{detail}</p>

        {linked ? (
          <Button
            className="fg-button--full-width"
            loading={busy}
            loadingLabel="Disconnecting"
            onClick={onDisconnect}
            size="compact"
            type="button"
            variant="danger"
          >
            Disconnect
          </Button>
        ) : available && actionHref ? (
          <ButtonAnchor
            className="fg-button--full-width"
            href={actionHref}
            icon={
              <span
                aria-hidden="true"
                className={cx("fg-profile-auth-provider__button-mark", `is-${provider}`)}
              >
                {readProviderMark(provider)}
              </span>
            }
            iconPlacement="leading"
            iconStyle="plain"
            size="compact"
            variant="secondary"
          >
            Connect {title}
          </ButtonAnchor>
        ) : (
          <div className="fg-profile-auth-provider__availability">
            Connect is disabled here until the provider is configured.
          </div>
        )}
      </div>
    </section>
  );
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
    <Panel className="fg-profile-panel">
      <PanelSection className="fg-profile-panel__body">
        <div className="fg-profile-panel__head">
          <p className="fg-label fg-panel__eyebrow">Identity</p>
          <PanelTitle>Profile</PanelTitle>
          <PanelCopy className="fg-profile-panel__copy">
            Edit the name shown across the console. Email and sign-in methods are managed below.
          </PanelCopy>
        </div>

        <div className="fg-profile-identity">
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
              <StatusBadge tone={session.verified ? "positive" : "warning"}>
                {readVerificationLabel(session.verified)}
              </StatusBadge>
            </div>
          </div>

          <div className="fg-profile-identity__meta">
            <span>Last sign-in</span>
            <strong>{readTimestampLabel(user.lastLoginAt)}</strong>
          </div>
        </div>

        <form className="fg-settings-form fg-profile-editor" onSubmit={(event) => void handleSubmit(event)}>
          <label className="fg-profile-editor__label" htmlFor="profile-display-name">
            Display name
          </label>

          <div className="fg-profile-editor__field">
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
          </div>

          <div className="fg-profile-editor__actions">
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

          <p className="fg-profile-editor__hint">
            Optional. Shown in the console header and account surfaces.
          </p>
        </form>
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
  const [busyMethod, setBusyMethod] =
    useState<Exclude<ProfileMethodKey, "email_link" | "password"> | null>(null);
  const methodCount = data.methods.length;
  const methodMap = new Map(data.methods.map((method) => [method.method, method] as const));
  const connectedProviderCount = countConnectedProviders(methodMap);
  const availableProviderCount =
    1 + Number(data.availableMethods.google) + Number(data.availableMethods.github);
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
  ];

  async function refreshAfterAction(successMessage: string) {
    await onUpdated();
    showToast({
      message: successMessage,
      variant: "success",
    });
  }

  async function handleDisableMethod(method: Exclude<ProfileMethodKey, "email_link" | "password">) {
    if (busyMethod) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: `Disconnect ${readAuthMethodLabel(method)}`,
      description:
        data.session.authMethod === method
          ? "The current browser session stays open, but future sign-ins will need another linked method."
          : "Keep another sign-in method linked before removing this one.",
      title: `Disconnect ${readAuthMethodLabel(method)} sign-in?`,
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
      await refreshAfterAction(`${readAuthMethodLabel(method)} sign-in disconnected.`);
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
    <Panel className="fg-profile-auth-panel">
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">Sign-in methods</p>
        <PanelTitle>Linked providers</PanelTitle>
        <PanelCopy>
          Manage how this account gets back into Fugue. Email stays the recovery anchor while GitHub
          and Google remain optional return paths.
        </PanelCopy>
      </PanelSection>

      <PanelSection className="fg-profile-auth-panel__body">
        {methodCount <= 1 ? (
          <>
            <InlineAlert variant="warning">
              This account currently has one sign-in method left. Connect another method before removing it.
            </InlineAlert>
            <div style={{ height: "0.9rem" }} aria-hidden="true" />
          </>
        ) : null}

        <div className="fg-profile-auth-summary">
          <div className="fg-profile-auth-summary__metrics">
            <ProviderSummaryMetric
              label="Connected providers"
              value={`${connectedProviderCount}/${availableProviderCount}`}
            />
            <ProviderSummaryMetric
              label="Active methods"
              value={String(methodCount)}
            />
            <ProviderSummaryMetric
              label="Recovery anchor"
              value={data.user.email}
            />
          </div>

          <div className="fg-console-inline-status fg-profile-auth-summary__status">
            <StatusBadge tone="info">
              {readAuthMethodLabel(data.session.authMethod, data.session.provider)} in use
            </StatusBadge>
            <StatusBadge tone="neutral">Keep one method live</StatusBadge>
          </div>
        </div>

        <div className="fg-profile-auth-workbench">
          <div className="fg-profile-auth-rail">
            {items.map((item) => {
              const record = methodMap.get(item.key);
              const linked = Boolean(record);

              return (
                <ExternalProviderSurface
                  actionHref={item.actionHref}
                  available={item.available}
                  busy={busyMethod === item.key}
                  description={readMethodDescription(item.key)}
                  detail={
                    linked
                      ? readMethodDetail(item.key, record, data.user.email)
                      : readProviderIdleDetail(item.key, item.available)
                  }
                  isCurrentSession={data.session.authMethod === item.key}
                  key={item.key}
                  linked={linked}
                  onDisconnect={() => {
                    void handleDisableMethod(item.key);
                  }}
                  provider={item.key}
                  title={item.title}
                />
              );
            })}
          </div>

          <EmailMethodItem
            data={data}
            emailLinkRecord={methodMap.get("email_link")}
            methodCount={methodCount}
            onUpdated={onUpdated}
            passwordRecord={methodMap.get("password")}
          />
        </div>
      </PanelSection>
    </Panel>
  );
}

function EmailMethodItem({
  data,
  emailLinkRecord,
  methodCount,
  onUpdated,
  passwordRecord,
}: {
  data: ConsoleProfileSettingsPageSnapshot;
  emailLinkRecord: ProfileMethodRecord | undefined;
  methodCount: number;
  onUpdated: () => Promise<void>;
  passwordRecord: ProfileMethodRecord | undefined;
}) {
  const confirm = useConfirmDialog();
  const { showToast } = useToast();
  const passwordDialogIdBase = useId();
  const passwordDialogRef = useRef<HTMLDivElement | null>(null);
  const passwordDialogBackdropPressStartedRef = useRef(false);
  const passwordDialogReturnFocusRef = useRef<HTMLElement | null>(null);
  const currentPasswordInputRef = useRef<HTMLInputElement | null>(null);
  const newPasswordInputRef = useRef<HTMLInputElement | null>(null);
  const passwordFormId = `profile-password-form-${passwordDialogIdBase}`;
  const passwordDialogId = `profile-password-dialog-${passwordDialogIdBase}`;
  const passwordDialogTitleId = `profile-password-dialog-title-${passwordDialogIdBase}`;
  const passwordDialogDescriptionId = `profile-password-dialog-description-${passwordDialogIdBase}`;
  const currentPasswordFieldId = `profile-current-password-${passwordDialogIdBase}`;
  const newPasswordFieldId = `profile-new-password-${passwordDialogIdBase}`;
  const confirmPasswordFieldId = `profile-confirm-password-${passwordDialogIdBase}`;
  const hasPassword = Boolean(passwordRecord);
  const emailLinkEnabled = Boolean(emailLinkRecord);
  const emailGroupConnected = emailLinkEnabled || hasPassword;
  const canDisableEmailLink = emailLinkEnabled && methodCount > 1;
  const canRemovePassword = hasPassword && methodCount > 1;
  const isCurrentSession =
    data.session.authMethod === "email_link" || data.session.authMethod === "password";
  const currentSessionLabel = data.session.authMethod === "password" ? "Password" : "Email link";
  const [busyEmailLink, setBusyEmailLink] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
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
  const passwordDialogBusy = submitting || removing;

  useEffect(() => {
    if (!passwordDialogOpen) {
      return;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const frame = window.requestAnimationFrame(() => {
      const preferredInput = hasPassword
        ? currentPasswordInputRef.current
        : newPasswordInputRef.current;

      preferredInput?.focus({ preventScroll: true });
    });

    return () => {
      passwordDialogBackdropPressStartedRef.current = false;
      window.cancelAnimationFrame(frame);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [hasPassword, passwordDialogOpen]);

  function resetPasswordEditor() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswords(false);
    setFieldErrors({});
  }

  async function refreshAfterAction(successMessage: string) {
    await onUpdated();
    showToast({
      message: successMessage,
      variant: "success",
    });
  }

  function dismissPasswordDialog(restoreFocus: boolean) {
    setPasswordDialogOpen(false);
    resetPasswordEditor();

    const returnFocusTarget = passwordDialogReturnFocusRef.current;
    passwordDialogReturnFocusRef.current = null;

    if (!restoreFocus || !returnFocusTarget) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (returnFocusTarget.isConnected) {
        returnFocusTarget.focus();
      }
    });
  }

  function openPasswordDialog(target: HTMLElement | null) {
    if (busyEmailLink || passwordDialogBusy) {
      return;
    }

    passwordDialogReturnFocusRef.current = target;
    setPasswordDialogOpen(true);
  }

  async function handleEnableEmailLink() {
    if (busyEmailLink || submitting || removing) {
      return;
    }

    setBusyEmailLink(true);

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
      setBusyEmailLink(false);
    }
  }

  async function handleDisableEmailLink() {
    if (busyEmailLink || submitting || removing) {
      return;
    }

    const confirmed = await confirm({
      confirmLabel: "Disable email link",
      description:
        data.session.authMethod === "email_link"
          ? "The current browser session stays open, but the next sign-in will need another linked method."
          : "Keep another sign-in method linked before removing email link access.",
      title: "Disable email link sign-in?",
      variant: "danger",
    });

    if (!confirmed) {
      return;
    }

    setBusyEmailLink(true);

    try {
      await requestJson(`/api/auth/methods/${readMethodSlug("email_link")}`, {
        method: "DELETE",
      });
      await refreshAfterAction("Email link sign-in disabled.");
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Could not disable email link sign-in.",
        variant: "error",
      });
    } finally {
      setBusyEmailLink(false);
    }
  }

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

      dismissPasswordDialog(false);
      await refreshAfterAction(payload.message ?? (hasPassword ? "Password updated." : "Password added."));
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
      dismissPasswordDialog(false);
      await refreshAfterAction("Password removed.");
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

  function handlePasswordDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!passwordDialogOpen) {
      return;
    }

    if (event.key === "Escape") {
      if (passwordDialogBusy) {
        return;
      }

      event.preventDefault();
      dismissPasswordDialog(true);
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = readFocusableElements(passwordDialogRef.current);

    if (!focusableElements.length) {
      event.preventDefault();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeInsideDialog = activeElement
      ? passwordDialogRef.current?.contains(activeElement)
      : false;

    if (event.shiftKey) {
      if (!activeInsideDialog || activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      return;
    }

    if (!activeInsideDialog || activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  function handlePasswordDialogBackdropPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (passwordDialogBusy) {
      passwordDialogBackdropPressStartedRef.current = false;
      return;
    }

    passwordDialogBackdropPressStartedRef.current =
      event.target === event.currentTarget;
  }

  function handlePasswordDialogBackdropClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const shouldClose =
      !passwordDialogBusy &&
      passwordDialogBackdropPressStartedRef.current &&
      event.target === event.currentTarget;

    passwordDialogBackdropPressStartedRef.current = false;

    if (!shouldClose) {
      return;
    }

    dismissPasswordDialog(true);
  }

  return (
    <>
      <section
        className={cx(
          "fg-profile-auth-provider",
          "fg-profile-auth-provider--email",
          emailGroupConnected && "is-connected",
        )}
      >
        <div className="fg-profile-auth-provider__header">
          <div className="fg-profile-auth-provider__identity">
            <ProviderMark provider="email" />

            <div className="fg-profile-auth-provider__copy">
              <div className="fg-profile-auth-provider__headline">
                <strong>Email</strong>

                <div className="fg-console-inline-status">
                  <StatusBadge tone={emailGroupConnected ? "positive" : "neutral"}>
                    {emailGroupConnected ? "Connected" : "Not enabled"}
                  </StatusBadge>
                  {isCurrentSession ? (
                    <StatusBadge tone="info">{currentSessionLabel} in use</StatusBadge>
                  ) : null}
                </div>
              </div>

              <p className="fg-profile-auth-provider__description">
                Keep the account email as the recovery anchor. Email link remains the
                lowest-friction fallback; password is optional for faster return access.
              </p>
            </div>
          </div>

          <div className="fg-profile-auth-provider__aside">
            <span className="fg-profile-auth-provider__aside-label">Account email</span>
            <strong>{data.user.email}</strong>
          </div>
        </div>

        <div className="fg-profile-auth-capabilities">
          <section
            className={cx(
              "fg-profile-auth-capability",
              emailLinkEnabled && "is-active",
            )}
          >
            <div className="fg-profile-auth-capability__head">
              <div>
                <span className="fg-profile-auth-capability__label">Email link</span>
                <h3 className="fg-profile-auth-capability__title">
                  One-time verification path
                </h3>
              </div>

              <div className="fg-console-inline-status">
                <StatusBadge tone={emailLinkEnabled ? "positive" : "neutral"}>
                  {emailLinkEnabled ? "Connected" : "Off"}
                </StatusBadge>
                {data.session.authMethod === "email_link" ? (
                  <StatusBadge tone="info">In use</StatusBadge>
                ) : null}
              </div>
            </div>

            <p className="fg-profile-auth-capability__copy">
              Send a secure sign-in link to the account email without storing a password.
            </p>
            <p className="fg-profile-auth-capability__meta">{data.user.email}</p>

            <Button
              className="fg-button--full-width"
              disabled={(emailLinkEnabled && !canDisableEmailLink) || passwordDialogBusy}
              loading={busyEmailLink}
              loadingLabel={emailLinkEnabled ? "Updating" : "Enabling"}
              onClick={() => {
                if (emailLinkEnabled) {
                  void handleDisableEmailLink();
                  return;
                }

                void handleEnableEmailLink();
              }}
              size="compact"
              type="button"
              variant="secondary"
            >
              {emailLinkEnabled ? "Disable email link" : "Enable email link"}
            </Button>
          </section>

          <section className={cx("fg-profile-auth-capability", hasPassword && "is-active")}>
            <div className="fg-profile-auth-capability__head">
              <div>
                <span className="fg-profile-auth-capability__label">Password</span>
                <h3 className="fg-profile-auth-capability__title">
                  Direct returning access
                </h3>
              </div>

              <div className="fg-console-inline-status">
                <StatusBadge tone={hasPassword ? "positive" : "neutral"}>
                  {hasPassword ? "Added" : "Not added"}
                </StatusBadge>
                {data.session.authMethod === "password" ? (
                  <StatusBadge tone="info">In use</StatusBadge>
                ) : null}
              </div>
            </div>

            <p className="fg-profile-auth-capability__copy">
              Add a stored password only if you want faster sign-in after the account is
              already created.
            </p>
            <p className="fg-profile-auth-capability__meta">
              Registration still uses an email verification link.
            </p>

            <Button
              aria-controls={passwordDialogOpen ? passwordDialogId : undefined}
              aria-expanded={passwordDialogOpen}
              aria-haspopup="dialog"
              className="fg-button--full-width"
              disabled={busyEmailLink || passwordDialogBusy}
              onClick={(event) => {
                openPasswordDialog(event.currentTarget);
              }}
              size="compact"
              type="button"
              variant="secondary"
            >
              {hasPassword ? "Manage password" : "Add password"}
            </Button>
          </section>
        </div>

        {methodCount <= 1 ? (
          <p className="fg-profile-auth-provider__hint">
            Connect another sign-in method before turning off email link or removing the
            password.
          </p>
        ) : null}
      </section>

      {passwordDialogOpen ? (
        <div
          className="fg-console-dialog-backdrop"
          onClick={handlePasswordDialogBackdropClick}
          onPointerDown={handlePasswordDialogBackdropPointerDown}
        >
          <div
            aria-busy={passwordDialogBusy || undefined}
            aria-describedby={passwordDialogDescriptionId}
            aria-labelledby={passwordDialogTitleId}
            aria-modal="true"
            className="fg-console-dialog-shell fg-profile-password-dialog-shell"
            id={passwordDialogId}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handlePasswordDialogKeyDown}
            ref={passwordDialogRef}
            role="dialog"
          >
            <Panel className="fg-console-dialog-panel">
              <PanelSection>
                <div className="fg-profile-password-dialog__head">
                  <div className="fg-profile-password-dialog__copy">
                    <p className="fg-label fg-panel__eyebrow">Password access</p>
                    <PanelTitle
                      className="fg-console-dialog__title"
                      id={passwordDialogTitleId}
                    >
                      {hasPassword ? "Manage password" : "Add password"}
                    </PanelTitle>
                    <PanelCopy id={passwordDialogDescriptionId}>
                      {hasPassword
                        ? "Update or remove the stored password. Email link stays the recovery anchor for this account."
                        : "Add a stored password for faster return access. Registration still uses an email verification link."}
                    </PanelCopy>
                  </div>
                </div>
              </PanelSection>

              <PanelSection className="fg-console-dialog__body">
                <div className="fg-profile-password-dialog">
                  {data.session.authMethod === "password" ? (
                    <InlineAlert variant="info">
                      This session was opened with a password. Changing or removing it will
                      not close the current browser session.
                    </InlineAlert>
                  ) : null}

                  {hasPassword && !canRemovePassword ? (
                    <InlineAlert variant="warning">
                      Add or reconnect another sign-in method before removing the password
                      from this account.
                    </InlineAlert>
                  ) : null}

                  <form
                    className="fg-settings-form fg-profile-password-form"
                    id={passwordFormId}
                    onSubmit={(event) => void handleSubmit(event)}
                  >
                    <div
                      className={cx(
                        "fg-profile-auth-editor__fields",
                        hasPassword && "has-current-password",
                      )}
                    >
                      {hasPassword ? (
                        <FormField
                          error={fieldErrors.currentPassword}
                          hint="Required before the password can be changed."
                          htmlFor={currentPasswordFieldId}
                          label="Current password"
                        >
                          <input
                            autoComplete="current-password"
                            className="fg-input"
                            id={currentPasswordFieldId}
                            name="currentPassword"
                            onChange={(event) =>
                              setCurrentPassword(event.currentTarget.value)
                            }
                            ref={currentPasswordInputRef}
                            type={showPasswords ? "text" : "password"}
                            value={currentPassword}
                          />
                        </FormField>
                      ) : null}

                      <FormField
                        error={fieldErrors.newPassword}
                        hint={PASSWORD_HINT}
                        htmlFor={newPasswordFieldId}
                        label={hasPassword ? "New password" : "Password"}
                      >
                        <input
                          autoComplete="new-password"
                          className="fg-input"
                          id={newPasswordFieldId}
                          name="newPassword"
                          onChange={(event) => setNewPassword(event.currentTarget.value)}
                          ref={newPasswordInputRef}
                          type={showPasswords ? "text" : "password"}
                          value={newPassword}
                        />
                      </FormField>

                      <FormField
                        error={fieldErrors.confirmPassword}
                        hint="Repeat the password once to confirm it."
                        htmlFor={confirmPasswordFieldId}
                        label="Confirm password"
                      >
                        <input
                          autoComplete="new-password"
                          className="fg-input"
                          id={confirmPasswordFieldId}
                          name="confirmPassword"
                          onChange={(event) =>
                            setConfirmPassword(event.currentTarget.value)
                          }
                          type={showPasswords ? "text" : "password"}
                          value={confirmPassword}
                        />
                      </FormField>
                    </div>

                    <label className="fg-password-toggle">
                      <input
                        checked={showPasswords}
                        onChange={(event) =>
                          setShowPasswords(event.currentTarget.checked)
                        }
                        type="checkbox"
                      />
                      <span>Show passwords</span>
                    </label>
                  </form>
                </div>
              </PanelSection>

              <PanelSection className="fg-console-dialog__footer">
                <div className="fg-console-dialog__actions">
                  <Button
                    disabled={passwordDialogBusy}
                    onClick={() => {
                      dismissPasswordDialog(true);
                    }}
                    size="compact"
                    type="button"
                    variant="secondary"
                  >
                    Cancel
                  </Button>

                  {hasPassword ? (
                    <Button
                      disabled={!canRemovePassword || submitting}
                      loading={removing}
                      loadingLabel="Removing"
                      onClick={() => {
                        void handleRemovePassword();
                      }}
                      size="compact"
                      type="button"
                      variant="danger"
                    >
                      Remove password
                    </Button>
                  ) : null}

                  <Button
                    form={passwordFormId}
                    loading={submitting}
                    loadingLabel="Saving"
                    size="compact"
                    type="submit"
                    variant="primary"
                  >
                    {hasPassword ? "Update password" : "Add password"}
                  </Button>
                </div>
              </PanelSection>
            </Panel>
          </div>
        </div>
      ) : null}
    </>
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
        <ConsoleProfileSettingsPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsolePageIntro
          actions={[
            { href: "/app", label: "Back to projects" },
          ]}
          description="Display name and every sign-in path linked to this account."
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
        ]}
        description="Display name and every sign-in path linked to this account."
        eyebrow="Account"
        title="Profile and security"
      />

      <ProfileIdentityPanel
        onUpdated={handleRefresh}
        session={data.session}
        user={data.user}
      />

      <SignInMethodsPanel data={data} onUpdated={handleRefresh} />
    </div>
  );
}
