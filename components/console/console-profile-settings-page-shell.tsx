"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsoleEmptyState } from "@/components/console/console-empty-state";
import { ConsolePageIntro } from "@/components/console/console-page-intro";
import {
  ConsoleLoadingState,
  ConsoleProfileSettingsPageSkeleton,
} from "@/components/console/console-page-skeleton";
import { useI18n } from "@/components/providers/i18n-provider";
import { StatusBadge } from "@/components/console/status-badge";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { HintTooltip } from "@/components/ui/hint-tooltip";
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
import { useTransitionPresence } from "@/lib/ui/transition-presence";

type ProfileMethodKey = ConsoleProfileSettingsPageSnapshot["methods"][number]["method"];
type ProfileMethodRecord = ConsoleProfileSettingsPageSnapshot["methods"][number];
type Translator = (key: string, values?: Record<string, number | string>) => string;

const PASSWORD_HINT = "Use at least 10 characters. Spaces are allowed.";
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function readProfileAuthFlashToast(
  value: string,
  t: Translator,
): { message: string; variant: "error" | "info" | "success" } | null {
  switch (value) {
    case "github-link-conflict":
      return {
        message: t("That GitHub account is already linked to another Fugue account."),
        variant: "error",
      };
    case "github-link-failed":
      return {
        message: t("GitHub could not be linked right now. Try again."),
        variant: "error",
      };
    case "github-linked":
      return {
        message: t("GitHub sign-in linked."),
        variant: "success",
      };
    case "github-unavailable":
      return {
        message: t("GitHub sign-in is not configured in this environment."),
        variant: "info",
      };
    case "google-link-conflict":
      return {
        message: t("That Google account is already linked to another Fugue account."),
        variant: "error",
      };
    case "google-link-failed":
      return {
        message: t("Google could not be linked right now. Try again."),
        variant: "error",
      };
    case "google-linked":
      return {
        message: t("Google sign-in linked."),
        variant: "success",
      };
    case "google-unavailable":
      return {
        message: t("Google sign-in is not configured in this environment."),
        variant: "info",
      };
    default:
      return null;
  }
}

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

function readMethodDescription(
  method: Exclude<ProfileMethodKey, "password">,
  t: Translator,
) {
  switch (method) {
    case "google":
      return t("Use a linked Google or Gmail identity to reopen the console.");
    case "github":
      return t("Use GitHub as another return path into the console.");
    case "email_link":
      return t(
        "Send a one-time verification link to the account email on the sign-in page.",
      );
    default:
      return "";
  }
}

function readMethodDetail(
  method: Exclude<ProfileMethodKey, "password">,
  record: ProfileMethodRecord | undefined,
  email: string,
  t: Translator,
) {
  if (method === "email_link") {
    return record ? email : t("Disabled on this account.");
  }

  if (!record) {
    return t("Not linked yet.");
  }

  return record.providerLabel ?? t("Linked");
}

function readTimestampLabel(
  value: string | null | undefined,
  formatDateTime: ReturnType<typeof useI18n>["formatDateTime"],
  t: Translator,
) {
  if (!value) {
    return t("Not available");
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return formatDateTime(parsed, {
    emptyText: t("Not available"),
    formatOptions: {
      dateStyle: "medium",
      timeStyle: "short",
    },
  });
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
  t: Translator,
) {
  if (!available) {
    return t("Not configured in this environment.");
  }

  switch (provider) {
    case "google":
      return t("Not linked yet.");
    case "github":
      return t("Not linked yet.");
    default:
      return t("Not linked yet.");
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
  const { t } = useI18n();
  const statusTone = linked ? "positive" : available ? "neutral" : "warning";
  const statusLabel = linked
    ? t("Connected")
    : available
      ? t("Available")
      : t("Unavailable");

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
              <div className="fg-profile-auth-provider__title-row">
                <strong>{title}</strong>
                <HintTooltip
                  ariaLabel={t("{provider} sign-in details", {
                    provider: title,
                  })}
                >
                  {description}
                </HintTooltip>
              </div>

              <div className="fg-console-inline-status">
                <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
                {isCurrentSession ? (
                  <StatusBadge tone="info">{t("In use")}</StatusBadge>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fg-profile-auth-provider__footer">
        <p className="fg-profile-auth-provider__detail">{detail}</p>

        {linked ? (
          <Button
            className="fg-button--full-width"
            loading={busy}
            loadingLabel={t("Disconnecting")}
            onClick={onDisconnect}
            size="compact"
            type="button"
            variant="danger"
          >
            {t("Disconnect")}
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
            {t("Connect {provider}", { provider: title })}
          </ButtonAnchor>
        ) : (
          <div className="fg-profile-auth-provider__availability">
            {t("Connect is disabled here until the provider is configured.")}
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
  const { formatDateTime, locale, t } = useI18n();
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
        throw new Error(payload.error ?? t("Could not update your profile."));
      }

      setDisplayName(payload.user?.name ?? normalizedDraft);
      await onUpdated();
      showToast({
        message: t("Profile updated."),
        variant: "success",
      });
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : t("Could not update your profile."),
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
          <p className="fg-label fg-panel__eyebrow">{t("Identity")}</p>
          <PanelTitle>{t("Profile")}</PanelTitle>
          <PanelCopy className="fg-profile-panel__copy">
            {t(
              "Edit the name shown across the console. Email and sign-in methods are managed below.",
            )}
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
                {readAuthMethodLabel(session.authMethod, session.provider, locale)}
              </StatusBadge>
              <StatusBadge tone={session.verified ? "positive" : "warning"}>
                {readVerificationLabel(session.verified, locale)}
              </StatusBadge>
            </div>
          </div>

          <div className="fg-profile-identity__meta">
            <span>{t("Last sign-in")}</span>
            <strong>{readTimestampLabel(user.lastLoginAt, formatDateTime, t)}</strong>
          </div>
        </div>

        <form className="fg-settings-form fg-profile-editor" onSubmit={(event) => void handleSubmit(event)}>
          <div className="fg-profile-editor__label">
            <span className="fg-field-label__main">
              <label className="fg-field-label__text" htmlFor="profile-display-name">
                {t("Display name")}
              </label>
              <HintTooltip ariaLabel={t("Display name")}>
                {t("Optional. Shown in the console header and account surfaces.")}
              </HintTooltip>
            </span>
          </div>

          <div className="fg-profile-editor__field">
            <input
              className="fg-input"
              id="profile-display-name"
              maxLength={80}
              name="displayName"
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              placeholder={t("How Fugue should address you")}
              type="text"
              value={displayName}
            />
          </div>

          <div className="fg-profile-editor__actions">
            <Button
              disabled={!isDirty}
              loading={saving}
              loadingLabel={t("Saving")}
              type="submit"
              variant="primary"
            >
              {t("Save profile")}
            </Button>
          </div>
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
  const { locale, t } = useI18n();
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
      title: t("Google"),
    },
    {
      actionHref: data.availableMethods.github
        ? `/api/auth/github/link/start?returnTo=${encodeURIComponent("/app/settings/profile")}`
        : null,
      available: data.availableMethods.github,
      key: "github" as const,
      title: t("GitHub"),
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
      confirmLabel: t("Disconnect {method}", {
        method: readAuthMethodLabel(method, undefined, locale),
      }),
      description:
        data.session.authMethod === method
          ? t(
              "The current browser session stays open, but future sign-ins will need another linked method.",
            )
          : t("Keep another sign-in method linked before removing this one."),
      title: t("Disconnect {method} sign-in?", {
        method: readAuthMethodLabel(method, undefined, locale),
      }),
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
        t("{method} sign-in disconnected.", {
          method: readAuthMethodLabel(method, undefined, locale),
        }),
      );
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : t("Could not update the sign-in method."),
        variant: "error",
      });
    } finally {
      setBusyMethod(null);
    }
  }

  return (
    <Panel className="fg-profile-auth-panel">
      <PanelSection>
        <p className="fg-label fg-panel__eyebrow">{t("Sign-in methods")}</p>
        <PanelTitle>{t("Linked providers")}</PanelTitle>
        <PanelCopy>
          {t(
            "Manage how this account gets back into Fugue. Email stays the recovery anchor while GitHub and Google remain optional return paths.",
          )}
        </PanelCopy>
      </PanelSection>

      <PanelSection className="fg-profile-auth-panel__body">
        {methodCount <= 1 ? (
          <>
            <InlineAlert variant="warning">
              {t(
                "This account currently has one sign-in method left. Connect another method before removing it.",
              )}
            </InlineAlert>
            <div style={{ height: "0.9rem" }} aria-hidden="true" />
          </>
        ) : null}

        <div className="fg-profile-auth-summary">
          <div className="fg-profile-auth-summary__metrics">
            <ProviderSummaryMetric
              label={t("Connected providers")}
              value={`${connectedProviderCount}/${availableProviderCount}`}
            />
            <ProviderSummaryMetric
              label={t("Active methods")}
              value={String(methodCount)}
            />
            <ProviderSummaryMetric
              label={t("Recovery anchor")}
              value={data.user.email}
            />
          </div>

          <div className="fg-console-inline-status fg-profile-auth-summary__status">
            <StatusBadge tone="info">
              {t("{method} in use", {
                method: readAuthMethodLabel(
                  data.session.authMethod,
                  data.session.provider,
                  locale,
                ),
              })}
            </StatusBadge>
            <StatusBadge tone="neutral">{t("Keep one method live")}</StatusBadge>
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
                  description={readMethodDescription(item.key, t)}
                  detail={
                    linked
                      ? readMethodDetail(item.key, record, data.user.email, t)
                      : readProviderIdleDetail(item.key, item.available, t)
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
  const { locale, t } = useI18n();
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
  const currentSessionLabel =
    data.session.authMethod === "password"
      ? readAuthMethodLabel("password", undefined, locale)
      : readAuthMethodLabel("email_link", undefined, locale);
  const [busyEmailLink, setBusyEmailLink] = useState(false);
  const passwordDialog = useTransitionPresence({
    closePropertyName: "--modal-close-dur",
    fallbackCloseMs: 150,
  });
  const passwordDialogOpen = passwordDialog.open;
  const setPasswordDialogOpen = passwordDialog.setOpen;
  const passwordDialogCleanupPendingRef = useRef(false);
  const passwordDialogRestoreFocusAfterCloseRef = useRef(false);
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
    if (!passwordDialog.present) {
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

    return () => {
      passwordDialogBackdropPressStartedRef.current = false;
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [passwordDialog.present]);

  useEffect(() => {
    if (!passwordDialogOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const preferredInput = hasPassword
        ? currentPasswordInputRef.current
        : newPasswordInputRef.current;

      preferredInput?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [hasPassword, passwordDialogOpen]);

  useEffect(() => {
    if (passwordDialog.present || !passwordDialogCleanupPendingRef.current) {
      return;
    }

    passwordDialogCleanupPendingRef.current = false;
    resetPasswordEditor();

    const returnFocusTarget = passwordDialogReturnFocusRef.current;
    passwordDialogReturnFocusRef.current = null;

    if (!passwordDialogRestoreFocusAfterCloseRef.current || !returnFocusTarget) {
      passwordDialogRestoreFocusAfterCloseRef.current = false;
      return;
    }

    passwordDialogRestoreFocusAfterCloseRef.current = false;

    window.requestAnimationFrame(() => {
      if (returnFocusTarget.isConnected) {
        returnFocusTarget.focus();
      }
    });
  }, [passwordDialog.present]);

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
    passwordDialogCleanupPendingRef.current = true;
    passwordDialogRestoreFocusAfterCloseRef.current = restoreFocus;
    setPasswordDialogOpen(false);
  }

  function openPasswordDialog(target: HTMLElement | null) {
    if (busyEmailLink || passwordDialogBusy) {
      return;
    }

    passwordDialogReturnFocusRef.current = target;
    passwordDialogCleanupPendingRef.current = false;
    passwordDialogRestoreFocusAfterCloseRef.current = false;
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
      await refreshAfterAction(t("Email link sign-in enabled."));
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : t("Could not enable email link sign-in."),
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
      confirmLabel: t("Disable email link"),
      description:
        data.session.authMethod === "email_link"
          ? t(
              "The current browser session stays open, but the next sign-in will need another linked method.",
            )
          : t(
              "Keep another sign-in method linked before removing email link access.",
            ),
      title: t("Disable email link sign-in?"),
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
      await refreshAfterAction(t("Email link sign-in disabled."));
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : t("Could not disable email link sign-in."),
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
      nextErrors.confirmPassword = t("Passwords do not match.");
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
        throw new Error(payload.error ?? t("Could not save the password."));
      }

      dismissPasswordDialog(false);
      await refreshAfterAction(
        payload.message ??
          (hasPassword ? t("Password updated.") : t("Password added.")),
      );
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : t("Could not save the password."),
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
      confirmLabel: t("Remove password"),
      description:
        data.session.authMethod === "password"
          ? t(
              "The current browser session stays open, but the next sign-in will need another linked method.",
            )
          : t("Keep another sign-in method linked before removing the stored password."),
      title: t("Remove password sign-in?"),
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
      await refreshAfterAction(t("Password removed."));
    } catch (error) {
      showToast({
        message:
          error instanceof Error && error.message.trim()
            ? error.message
            : t("Could not remove the password."),
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
                <div className="fg-profile-auth-provider__title-row">
                  <strong>{t("Email")}</strong>
                  <HintTooltip ariaLabel={t("Email sign-in details")}>
                    {t(
                      "Keep the account email as the recovery anchor. Email link remains the lowest-friction fallback; password is optional for faster return access.",
                    )}
                  </HintTooltip>
                </div>

                <div className="fg-console-inline-status">
                  <StatusBadge tone={emailGroupConnected ? "positive" : "neutral"}>
                    {emailGroupConnected ? t("Connected") : t("Not enabled")}
                  </StatusBadge>
                  {isCurrentSession ? (
                    <StatusBadge tone="info">
                      {t("{method} in use", { method: currentSessionLabel })}
                    </StatusBadge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="fg-profile-auth-provider__aside">
            <span className="fg-profile-auth-provider__aside-label">
              {t("Account email")}
            </span>
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
                <span className="fg-profile-auth-capability__label">
                  {t("Email link")}
                </span>
                <div className="fg-profile-auth-capability__title-row">
                  <h3 className="fg-profile-auth-capability__title">
                    {t("One-time verification path")}
                  </h3>
                  <HintTooltip ariaLabel={t("Email link details")}>
                    {t(
                      "Send a secure sign-in link to the account email without storing a password.",
                    )}
                  </HintTooltip>
                </div>
              </div>

              <div className="fg-console-inline-status">
                <StatusBadge tone={emailLinkEnabled ? "positive" : "neutral"}>
                  {emailLinkEnabled ? t("Connected") : t("Off")}
                </StatusBadge>
                {data.session.authMethod === "email_link" ? (
                  <StatusBadge tone="info">{t("In use")}</StatusBadge>
                ) : null}
              </div>
            </div>
            <p className="fg-profile-auth-capability__meta">{data.user.email}</p>

            <Button
              className="fg-button--full-width"
              disabled={(emailLinkEnabled && !canDisableEmailLink) || passwordDialogBusy}
              loading={busyEmailLink}
              loadingLabel={emailLinkEnabled ? t("Updating") : t("Enabling")}
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
              {emailLinkEnabled ? t("Disable email link") : t("Enable email link")}
            </Button>
          </section>

          <section className={cx("fg-profile-auth-capability", hasPassword && "is-active")}>
            <div className="fg-profile-auth-capability__head">
              <div>
                <span className="fg-profile-auth-capability__label">
                  {t("Password")}
                </span>
                <div className="fg-profile-auth-capability__title-row">
                  <h3 className="fg-profile-auth-capability__title">
                    {t("Direct returning access")}
                  </h3>
                  <HintTooltip ariaLabel={t("Password details")}>
                    <span className="fg-hint-tooltip__stack">
                      <span>
                        {t(
                          "Add a stored password only if you want faster sign-in after the account is already created.",
                        )}
                      </span>
                      <span>
                        {t(
                          "Registration still uses an email verification link.",
                        )}
                      </span>
                    </span>
                  </HintTooltip>
                </div>
              </div>

              <div className="fg-console-inline-status">
                <StatusBadge tone={hasPassword ? "positive" : "neutral"}>
                  {hasPassword ? t("Added") : t("Not added")}
                </StatusBadge>
                {data.session.authMethod === "password" ? (
                  <StatusBadge tone="info">{t("In use")}</StatusBadge>
                ) : null}
              </div>
            </div>

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
              {hasPassword ? t("Manage password") : t("Add password")}
            </Button>
          </section>
        </div>

        {methodCount <= 1 ? (
          <div className="fg-profile-auth-provider__hint">
            <HintTooltip ariaLabel={t("Profile and security")}>
              {t(
                "Connect another sign-in method before turning off email link or removing the password.",
              )}
            </HintTooltip>
          </div>
        ) : null}
      </section>

      {passwordDialog.present ? (
        <div
          className="fg-console-dialog-backdrop"
          data-state={passwordDialog.closing ? "closing" : "open"}
          onClick={handlePasswordDialogBackdropClick}
          onPointerDown={handlePasswordDialogBackdropPointerDown}
        >
          <div
            aria-busy={passwordDialogBusy || undefined}
            aria-describedby={passwordDialogDescriptionId}
            aria-labelledby={passwordDialogTitleId}
            aria-modal="true"
            className={cx(
              "fg-console-dialog-shell fg-profile-password-dialog-shell",
              "t-modal",
              passwordDialogOpen && "is-open",
              passwordDialog.closing && "is-closing",
            )}
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
                    <p className="fg-label fg-panel__eyebrow">
                      {t("Password access")}
                    </p>
                    <PanelTitle
                      className="fg-console-dialog__title"
                      id={passwordDialogTitleId}
                    >
                      {hasPassword ? t("Manage password") : t("Add password")}
                    </PanelTitle>
                    <PanelCopy id={passwordDialogDescriptionId}>
                      {hasPassword
                        ? t(
                            "Update or remove the stored password. Email link stays the recovery anchor for this account.",
                          )
                        : t(
                            "Add a stored password for faster return access. Registration still uses an email verification link.",
                          )}
                    </PanelCopy>
                  </div>
                </div>
              </PanelSection>

              <PanelSection className="fg-console-dialog__body">
                <div className="fg-profile-password-dialog">
                  {data.session.authMethod === "password" ? (
                    <InlineAlert variant="info">
                      {t(
                        "This session was opened with a password. Changing or removing it will not close the current browser session.",
                      )}
                    </InlineAlert>
                  ) : null}

                  {hasPassword && !canRemovePassword ? (
                    <InlineAlert variant="warning">
                      {t(
                        "Add or reconnect another sign-in method before removing the password from this account.",
                      )}
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
                          hint={t("Required before the password can be changed.")}
                          htmlFor={currentPasswordFieldId}
                          label={t("Current password")}
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
                        hint={t(PASSWORD_HINT)}
                        htmlFor={newPasswordFieldId}
                        label={hasPassword ? t("New password") : t("Password")}
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
                        hint={t("Repeat the password once to confirm it.")}
                        htmlFor={confirmPasswordFieldId}
                        label={t("Confirm password")}
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
                      <span>{t("Show passwords")}</span>
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
                    {t("Cancel")}
                  </Button>

                  {hasPassword ? (
                    <Button
                      disabled={!canRemovePassword || submitting}
                      loading={removing}
                      loadingLabel={t("Removing")}
                      onClick={() => {
                        void handleRemovePassword();
                      }}
                      size="compact"
                      type="button"
                      variant="danger"
                    >
                      {t("Remove password")}
                    </Button>
                  ) : null}

                  <Button
                    form={passwordFormId}
                    loading={submitting}
                    loadingLabel={t("Saving")}
                    size="compact"
                    type="submit"
                    variant="primary"
                  >
                    {hasPassword ? t("Update password") : t("Add password")}
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
  const { t } = useI18n();
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

    const toast = readProfileAuthFlashToast(profileAuth, t);

    if (toast) {
      showToast(toast);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("profileAuth");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams, showToast, t]);

  async function handleRefresh() {
    await refresh({
      force: true,
    });
  }

  if (loading && !data) {
    return (
      <ConsoleLoadingState label={t("Loading profile settings")}>
        <ConsoleProfileSettingsPageSkeleton />
      </ConsoleLoadingState>
    );
  }

  if (!data) {
    return (
      <div className="fg-console-page">
        <ConsolePageIntro
          actions={[
            { href: "/app", label: t("Back to projects") },
          ]}
          description={t("Display name and every sign-in path linked to this account.")}
          eyebrow={t("Account")}
          title={t("Profile and security")}
        />

        <Panel>
          <PanelSection>
            <ConsoleEmptyState
              description={
                error ?? t("Fugue could not load the profile settings right now.")
              }
              title={t("Profile settings unavailable")}
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
          { href: "/app", label: t("Back to projects") },
        ]}
        description={t("Display name and every sign-in path linked to this account.")}
        eyebrow={t("Account")}
        title={t("Profile and security")}
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
