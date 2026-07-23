"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useT } from "@/lib/i18n/client";

type AuthMethodKind = "email_link" | "password" | "google" | "github";

type AuthMethodRecord = {
  createdAt: string;
  hasSecret: boolean;
  method: AuthMethodKind;
  providerId: string | null;
  providerLabel: string | null;
  updatedAt: string;
};

type ProfileStatus = {
  user: { email: string; name: string | null; pictureUrl: string | null };
  methods: AuthMethodRecord[];
  providers: {
    google: { authEnabled: boolean };
    github: {
      authEnabled: boolean;
      connected: boolean;
      login: string | null;
      scopes: string[];
      updatedAt: string | null;
    };
  };
};

type Props = {
  initialName: string;
  email: string;
  pictureUrl: string | null;
};

function hasMethod(methods: AuthMethodRecord[], kind: AuthMethodKind) {
  return methods.some((m) => m.method === kind);
}

export default function ProfileSecurity({ initialName, email, pictureUrl }: Props) {
  const t = useT();
  const router = useRouter();

  const [status, setStatus] = useState<ProfileStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/profile/status", {
        cache: "no-store",
      });
      if (!res.ok) {
        setLoadError(t("Could not load your profile. Refresh to try again."));
        return;
      }
      setStatus((await res.json()) as ProfileStatus);
      setLoadError(null);
    } catch {
      setLoadError(t("Could not load your profile. Refresh to try again."));
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const methods = status?.methods ?? [];
  const github = status?.providers.github;
  const googleEnabled = status?.providers.google.authEnabled ?? false;
  const methodCount = methods.length;

  return (
    <div className="prof">
      {loadError && <div className="prof-alert err">{loadError}</div>}

      <ProfileIdentity
        initialName={initialName}
        email={email}
        pictureUrl={pictureUrl}
        onSaved={() => router.refresh()}
      />

      <ProviderBindings
        methods={methods}
        googleEnabled={googleEnabled}
        github={github}
        methodCount={methodCount}
        onChanged={refresh}
      />

      <EmailLinkPanel
        methods={methods}
        methodCount={methodCount}
        onChanged={refresh}
      />

      <PasswordPanel
        methods={methods}
        methodCount={methodCount}
        onChanged={refresh}
      />
    </div>
  );
}

function initialsOf(name: string, email: string) {
  const source = (name || email || "").trim();
  if (!source) return "·";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function EmailLinkPanel({
  methods,
  methodCount,
  onChanged,
}: {
  methods: AuthMethodRecord[];
  methodCount: number;
  onChanged: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enabled = hasMethod(methods, "email_link");
  const isLast = enabled && methodCount <= 1;

  async function toggle(action: "enable" | "disable") {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/methods/email-link", {
        method: action === "enable" ? "POST" : "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || t("Could not update. Try again."));
        return;
      }
      setNotice(action === "enable" ? t("Email sign-in enabled.") : t("Email sign-in disabled."));
      onChanged();
    } catch {
      setError(t("Could not update. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel prof-panel">
      <div className="panel-h">
        <h3>{t("Email sign-in link")}</h3>
      </div>
      <div className="prof-body">
        <p className="prof-desc">
          {t("Receive a one-time sign-in link by email. No password required.")}
        </p>
        {notice && <div className="prof-alert ok">{notice}</div>}
        {error && <div className="prof-alert err">{error}</div>}
        <div className="prof-actions">
          {enabled ? (
            <button
              type="button"
              className="btn"
              disabled={busy || isLast}
              title={isLast ? t("Keep at least one sign-in method.") : undefined}
              onClick={() => toggle("disable")}
            >
              {busy ? t("Working…") : t("Disable email link")}
            </button>
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => toggle("enable")}
            >
              {busy ? t("Working…") : t("Enable email link")}
            </button>
          )}
          <span className={`prof-state${enabled ? " on" : ""}`}>
            {enabled ? t("Enabled") : t("Disabled")}
          </span>
        </div>
      </div>
    </section>
  );
}

function PasswordPanel({
  methods,
  methodCount,
  onChanged,
}: {
  methods: AuthMethodRecord[];
  methodCount: number;
  onChanged: () => void;
}) {
  const t = useT();
  const hasPassword = hasMethod(methods, "password");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLast = hasPassword && methodCount <= 1;

  async function submit() {
    setNotice(null);
    setError(null);
    if (next !== confirm) {
      setError(t("Passwords do not match."));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/methods/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? current : undefined,
          newPassword: next,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || t("Could not update. Try again."));
        return;
      }
      setNotice(data.message || t("Password updated."));
      setCurrent("");
      setNext("");
      setConfirm("");
      onChanged();
    } catch {
      setError(t("Could not update. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function removePassword() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/methods/password", {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || t("Could not remove. Try again."));
        return;
      }
      setNotice(t("Password removed."));
      onChanged();
    } catch {
      setError(t("Could not remove. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel prof-panel">
      <div className="panel-h">
        <h3>{hasPassword ? t("Change password") : t("Set a password")}</h3>
      </div>
      <div className="prof-body">
        {hasPassword && (
          <div className="prof-field">
            <label className="prof-lbl" htmlFor="pw-current">
              {t("Current password")}
            </label>
            <input
              id="pw-current"
              type="password"
              className="input"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
        )}
        <div className="prof-field">
          <label className="prof-lbl" htmlFor="pw-new">
            {t("New password")}
          </label>
          <input
            id="pw-new"
            type="password"
            className="input"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="prof-field">
          <label className="prof-lbl" htmlFor="pw-confirm">
            {t("Confirm new password")}
          </label>
          <input
            id="pw-confirm"
            type="password"
            className="input"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {notice && <div className="prof-alert ok">{notice}</div>}
        {error && <div className="prof-alert err">{error}</div>}
        <div className="prof-actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy || !next}
            onClick={submit}
          >
            {busy ? t("Saving…") : hasPassword ? t("Update password") : t("Set password")}
          </button>
          {hasPassword && (
            <button
              type="button"
              className="btn danger"
              disabled={busy || isLast}
              title={isLast ? t("Keep at least one sign-in method.") : undefined}
              onClick={removePassword}
            >
              {t("Remove password")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ProviderBindings({
  methods,
  googleEnabled,
  github,
  methodCount,
  onChanged,
}: {
  methods: AuthMethodRecord[];
  googleEnabled: boolean;
  github: ProfileStatus["providers"]["github"] | undefined;
  methodCount: number;
  onChanged: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const googleConnected = hasMethod(methods, "google");
  const googleRecord = methods.find((m) => m.method === "google");
  const githubConnected = Boolean(github?.connected);

  async function disconnectGoogle() {
    setBusy("google");
    setError(null);
    try {
      const res = await fetch("/api/auth/methods/google", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || t("Could not disconnect. Try again."));
        return;
      }
      onChanged();
    } catch {
      setError(t("Could not disconnect. Try again."));
    } finally {
      setBusy(null);
    }
  }

  async function disconnectGitHub() {
    setBusy("github");
    setError(null);
    try {
      const res = await fetch("/api/auth/github/connection", {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || t("Could not disconnect. Try again."));
        return;
      }
      onChanged();
    } catch {
      setError(t("Could not disconnect. Try again."));
    } finally {
      setBusy(null);
    }
  }

  const returnTo = encodeURIComponent("/profile");
  // Removing a linked identity that is the only remaining sign-in method would
  // lock the user out; the backend also enforces this, but disable up front.
  const googleLast = googleConnected && methodCount <= 1;

  return (
    <section className="panel prof-panel">
      <div className="panel-h">
        <h3>{t("Connected accounts")}</h3>
      </div>
      <div className="prof-body">
        {error && <div className="prof-alert err">{error}</div>}

        <div className="prov-row">
          <div className="prov-ico" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
              <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 010-4.22V7.05H2.18a11 11 0 000 9.9l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.29 9.14 5.38 12 5.38z" />
            </svg>
          </div>
          <div className="prov-main">
            <div className="prov-nm">Google</div>
            <div className="prov-sub">
              {googleConnected
                ? googleRecord?.providerLabel || t("Connected")
                : googleEnabled
                  ? t("Not connected")
                  : t("Unavailable")}
            </div>
          </div>
          {googleConnected ? (
            <button
              type="button"
              className="btn"
              disabled={busy !== null || googleLast}
              title={googleLast ? t("Keep at least one sign-in method.") : undefined}
              onClick={disconnectGoogle}
            >
              {busy === "google" ? t("Working…") : t("Disconnect")}
            </button>
          ) : (
            <a
              className={`btn primary${googleEnabled ? "" : " disabled"}`}
              aria-disabled={!googleEnabled}
              href={
                googleEnabled
                  ? `/api/auth/google/connect/start?returnTo=${returnTo}`
                  : undefined
              }
            >
              {t("Connect")}
            </a>
          )}
        </div>

        <div className="prov-row">
          <div className="prov-ico" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 1C5.37 1 0 6.37 0 13c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0024 13c0-6.63-5.37-12-12-12z" />
            </svg>
          </div>
          <div className="prov-main">
            <div className="prov-nm">GitHub</div>
            <div className="prov-sub">
              {githubConnected
                ? github?.login
                  ? `@${github.login}`
                  : t("Connected")
                : github?.authEnabled
                  ? t("Not connected")
                  : t("Unavailable")}
            </div>
          </div>
          {githubConnected ? (
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={disconnectGitHub}
            >
              {busy === "github" ? t("Working…") : t("Disconnect")}
            </button>
          ) : (
            <a
              className={`btn primary${github?.authEnabled ? "" : " disabled"}`}
              aria-disabled={!github?.authEnabled}
              href={
                github?.authEnabled
                  ? `/api/auth/github/connect/start?returnTo=${returnTo}`
                  : undefined
              }
            >
              {t("Connect")}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function ProfileIdentity({
  initialName,
  email,
  pictureUrl,
  onSaved,
}: {
  initialName: string;
  email: string;
  pictureUrl: string | null;
  onSaved: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== initialName.trim();

  async function save() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || t("Could not save. Try again."));
        return;
      }
      setNotice(t("Saved."));
      onSaved();
    } catch {
      setError(t("Could not save. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel prof-panel">
      <div className="panel-h">
        <h3>{t("Identity")}</h3>
      </div>
      <div className="prof-body">
        <div className="prof-identity">
          {pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pictureUrl} alt="" className="prof-avatar" />
          ) : (
            <span className="prof-avatar prof-avatar-fallback">
              {initialsOf(name, email)}
            </span>
          )}
          <div className="prof-field">
            <label className="prof-lbl" htmlFor="prof-name">
              {t("Display name")}
            </label>
            <input
              id="prof-name"
              className="input"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Your name")}
            />
            <div className="prof-hint">{email}</div>
          </div>
        </div>
        {notice && <div className="prof-alert ok">{notice}</div>}
        {error && <div className="prof-alert err">{error}</div>}
        <div className="prof-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? t("Saving…") : t("Save changes")}
          </button>
        </div>
      </div>
    </section>
  );
}

