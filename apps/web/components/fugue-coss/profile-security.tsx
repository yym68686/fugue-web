"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Button } from "@fugue/ui/components/button";
import { CardContent, CardFrame } from "@fugue/ui/components/card";
import { Field, FieldError, FieldLabel } from "@fugue/ui/components/field";
import { Input } from "@fugue/ui/components/input";
import { Skeleton } from "@fugue/ui/components/skeleton";
import { toastManager } from "@fugue/ui/components/toast";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ConsoleLoadError,
  ConsoleLoadingState,
} from "@/components/console/async-state";
import { ConsoleCardHeader } from "@/components/console/card-header";
import { ConsoleDrawer } from "@/components/console/overlays";
import { useClientUiMessages } from "@/components/i18n/locale-select";
import {
  CONSOLE_PROFILE_SETTINGS_PAGE_SNAPSHOT_URL,
  useConsolePageSnapshot,
} from "@/lib/console/page-snapshot-client";
import type { ConsoleProfileSettingsPageSnapshot } from "@/lib/console/page-snapshot-types";
import type { ProfileFormMessages } from "@/lib/i18n/ui-messages";
import { readRequestError, requestJson } from "@/lib/ui/request-json";

function useToast() {
  return {
    notify(value: string) {
      toastManager.add({ title: value });
    },
  };
}

type ProfileAuthMethod = ConsoleProfileSettingsPageSnapshot["methods"][number];
type ProfileAuthMethodKind = ProfileAuthMethod["method"];

const PROFILE_AUTH_METHODS: ProfileAuthMethodKind[] = [
  "google",
  "github",
  "email_link",
  "password",
];

function profileMethodLabel(method: ProfileAuthMethodKind) {
  switch (method) {
    case "google":
      return "Google";
    case "github":
      return "GitHub";
    case "email_link":
      return "Email link";
    case "password":
      return "Password";
  }
}

function profileMethodSlug(method: ProfileAuthMethodKind) {
  return method === "email_link" ? "email-link" : method;
}

function displayNameFromProfile(snapshot: ConsoleProfileSettingsPageSnapshot | null) {
  return (
    snapshot?.user.name?.trim() ||
    snapshot?.session.name?.trim() ||
    snapshot?.session.email?.split("@")[0] ||
    ""
  );
}

export function ProfileSecurity({ messages }: { messages: ProfileFormMessages }) {
  const clientMessages = useClientUiMessages();
  const { data, error, loading, refresh } =
    useConsolePageSnapshot<ConsoleProfileSettingsPageSnapshot>(
      CONSOLE_PROFILE_SETTINGS_PAGE_SNAPSHOT_URL,
    );
  const toast = useToast();
  const [name, setName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [methodAction, setMethodAction] = useState<ProfileAuthMethodKind | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [passwordDrawer, setPasswordDrawer] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!data || dirty) {
      return;
    }

    setName(displayNameFromProfile(data));
  }, [data, dirty]);

  const activeMethods = data?.methods ?? [];
  const activeMethodSet = useMemo(
    () => new Set(activeMethods.map((method) => method.method)),
    [activeMethods],
  );
  const hasPassword = activeMethods.some(
    (method) => method.method === "password" && method.hasSecret,
  );
  const email = data?.session.email ?? "";
  const initialProfileLoading = loading && !data;
  const displayNameInvalid = name.length > 80;
  const newPasswordInvalid = newPassword.length > 0 && newPassword.length < 10;

  async function saveProfile() {
    setSavingProfile(true);
    setProfileError(null);

    try {
      await requestJson<{
        ok: boolean;
        user: ConsoleProfileSettingsPageSnapshot["user"];
      }>("/api/auth/profile", {
        body: JSON.stringify({ name }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      setDirty(false);
      await refresh({ force: true });
      toast.notify("Profile saved.");
    } catch (nextError) {
      setProfileError(readRequestError(nextError));
    } finally {
      setSavingProfile(false);
    }
  }

  async function disconnectMethod(method: ProfileAuthMethodKind) {
    setMethodAction(method);
    setMethodError(null);

    try {
      await requestJson<{ ok: boolean; methods: ProfileAuthMethod[] }>(
        `/api/auth/methods/${profileMethodSlug(method)}`,
        {
          cache: "no-store",
          method: "DELETE",
        },
      );
      await refresh({ force: true });
      toast.notify(`${profileMethodLabel(method)} disconnected.`);
    } catch (nextError) {
      setMethodError(readRequestError(nextError));
    } finally {
      setMethodAction(null);
    }
  }

  async function enableEmailLink() {
    setMethodAction("email_link");
    setMethodError(null);

    try {
      await requestJson<{ ok: boolean; methods: ProfileAuthMethod[] }>(
        "/api/auth/methods/email-link",
        {
          cache: "no-store",
          method: "POST",
        },
      );
      await refresh({ force: true });
      toast.notify("Email link enabled.");
    } catch (nextError) {
      setMethodError(readRequestError(nextError));
    } finally {
      setMethodAction(null);
    }
  }

  async function savePassword() {
    setMethodAction("password");
    setPasswordError(null);

    try {
      await requestJson<{ ok: boolean; methods: ProfileAuthMethod[] }>(
        "/api/auth/methods/password",
        {
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      setCurrentPassword("");
      setNewPassword("");
      setPasswordDrawer(false);
      await refresh({ force: true });
      toast.notify(hasPassword ? "Password updated." : "Password added.");
    } catch (nextError) {
      setPasswordError(readRequestError(nextError));
    } finally {
      setMethodAction(null);
    }
  }

  function connectMethod(method: ProfileAuthMethodKind) {
    if (method === "google" || method === "github") {
      window.location.href = `/api/auth/${method}/link/start?returnTo=${encodeURIComponent("/app/settings/profile")}`;
      return;
    }

    if (method === "email_link") {
      void enableEmailLink();
      return;
    }

    setPasswordDrawer(true);
  }

  return (
    <>
      <div className="coss-split">
        <CardFrame>
          <ConsoleCardHeader
            title="Profile"
            description="Display name, account email, and active session."
          />
          <CardContent className="coss-form">
            {error ? (
              <ConsoleLoadError
                description={error}
                onRetry={() => refresh({ force: true })}
                retryLabel={clientMessages.retry}
                title={messages.loadProfileFailed}
              />
            ) : null}
            {profileError ? (
              <Alert variant="error" role="alert">
                <AlertTitle>{messages.profileUpdateFailed}</AlertTitle>
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            ) : null}
            {initialProfileLoading ? (
              <ConsoleLoadingState
                className="coss-stack-sm"
                label="Loading profile settings"
              >
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
                <Skeleton
                  style={{
                    height: 42,
                  }}
                />
              </ConsoleLoadingState>
            ) : data ? (
              <>
                <Field data-invalid={displayNameInvalid || undefined}>
                  <FieldLabel htmlFor="profile-display-name">Display name</FieldLabel>
                  <Input
                    aria-describedby={
                      displayNameInvalid ? "profile-display-name-error" : undefined
                    }
                    aria-invalid={displayNameInvalid || undefined}
                    autoComplete="name"
                    id="profile-display-name"
                    maxLength={80}
                    name="displayName"
                    value={name}
                    onChange={(event) => {
                      setDirty(true);
                      setName(event.target.value);
                    }}
                    placeholder={email ? email.split("@")[0] : "Display name"}
                  />
                  {displayNameInvalid ? (
                    <FieldError id="profile-display-name-error" role="alert">
                      {messages.displayNameTooLong}
                    </FieldError>
                  ) : null}
                </Field>
                <Field data-disabled>
                  <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                  <Input
                    autoComplete="email"
                    disabled
                    id="profile-email"
                    name="email"
                    value={email}
                  />
                </Field>
                <Button
                  disabled={!data || displayNameInvalid}
                  loading={savingProfile}
                  onClick={saveProfile}
                >
                  {savingProfile ? null : <Save aria-hidden="true" />}
                  Save profile
                </Button>
              </>
            ) : null}
          </CardContent>
        </CardFrame>
        <CardFrame>
          <ConsoleCardHeader
            title="Sign-in methods"
            description="At least one method must remain active."
          />
          <CardContent className="coss-stack">
            {methodError ? (
              <Alert variant="error" role="alert">
                <AlertTitle>{messages.signInMethodsUpdateFailed}</AlertTitle>
                <AlertDescription>{methodError}</AlertDescription>
              </Alert>
            ) : null}
            {initialProfileLoading ? (
              <ConsoleLoadingState
                className="coss-stack-sm"
                label="Loading sign-in methods"
              >
                <Skeleton
                  style={{
                    height: 38,
                  }}
                />
                <Skeleton
                  style={{
                    height: 38,
                  }}
                />
                <Skeleton
                  style={{
                    height: 38,
                  }}
                />
              </ConsoleLoadingState>
            ) : data && activeMethods.length ? (
              activeMethods.map((method) => (
                <div key={method.method} className="coss-row coss-row--between">
                  <span>{profileMethodLabel(method.method)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeMethods.length === 1}
                    loading={methodAction === method.method}
                    onClick={() => disconnectMethod(method.method)}
                  >
                    Disconnect
                  </Button>
                </div>
              ))
            ) : data ? (
              <Alert variant="warning" role="status">
                <AlertTitle>{messages.noSignInMethod}</AlertTitle>
                <AlertDescription>
                  {messages.noSignInMethodDescription}
                </AlertDescription>
              </Alert>
            ) : null}
            {data ? (
              <div className="coss-grid-2">
                {PROFILE_AUTH_METHODS.filter(
                  (method) => !activeMethodSet.has(method),
                ).map((method) => (
                  <Button
                    key={method}
                    variant="outline"
                    disabled={
                      (method === "google" && !data.availableMethods.google) ||
                      (method === "github" && !data.availableMethods.github)
                    }
                    loading={methodAction === method}
                    onClick={() => connectMethod(method)}
                  >
                    Connect / enable {profileMethodLabel(method)}
                  </Button>
                ))}
                {activeMethodSet.has("password") ? (
                  <Button variant="outline" onClick={() => setPasswordDrawer(true)}>
                    Update password
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </CardFrame>
      </div>
      <ConsoleDrawer
        title={hasPassword ? "Update password" : "Add password"}
        description="Password access is stored on this account and protected by the active session."
        open={passwordDrawer}
        onClose={() => setPasswordDrawer(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setPasswordDrawer(false)}>
              Cancel
            </Button>
            <Button
              loading={methodAction === "password"}
              disabled={!newPassword || newPasswordInvalid}
              onClick={savePassword}
            >
              {hasPassword ? "Update password" : "Add password"}
            </Button>
          </>
        }
      >
        <div className="coss-form">
          {passwordError ? (
            <Alert variant="error" role="alert">
              <AlertTitle>{messages.passwordSaveFailed}</AlertTitle>
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          ) : null}
          {hasPassword ? (
            <Field>
              <FieldLabel htmlFor="profile-current-password">
                Current password
              </FieldLabel>
              <Input
                autoComplete="current-password"
                id="profile-current-password"
                maxLength={256}
                name="currentPassword"
                required
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
          ) : null}
          <Field data-invalid={newPasswordInvalid || undefined}>
            <FieldLabel htmlFor="profile-new-password">New password</FieldLabel>
            <Input
              aria-describedby={
                newPasswordInvalid ? "profile-new-password-error" : undefined
              }
              aria-invalid={newPasswordInvalid || undefined}
              autoComplete="new-password"
              id="profile-new-password"
              maxLength={256}
              minLength={10}
              name="newPassword"
              required
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            {newPasswordInvalid ? (
              <FieldError id="profile-new-password-error" role="alert">
                {messages.passwordMinimum}
              </FieldError>
            ) : null}
          </Field>
        </div>
      </ConsoleDrawer>
    </>
  );
}
