"use client";

import { type FormEvent, useRef, useState } from "react";

import { useT } from "@/lib/i18n/client";
import type { TranslateFn } from "@/lib/i18n/translate";

type AuthMode = "sign-in" | "sign-up";
type AuthMethod = "password" | "email";
type LoadingTarget = "email" | "github" | "google" | "password" | null;

// Server error strings (English) that have a localized catalog entry. The value
// sent by the API is the English source; t() looks up the translation.
const KNOWN_SERVER_MESSAGES = new Set<string>([
  "Enter a valid email address.",
  "Enter a password.",
  "Enter your current password.",
  "Choose a new password.",
  "Current password is incorrect.",
  "Display name is too long.",
  "Invalid request payload.",
  "This account is blocked.",
  "This account has been deleted.",
  "Authentication request payload is too large.",
  "Verification email could not be sent. Try again.",
  "Email verification is temporarily unavailable. Try again.",
  "Fugue could not open the workspace session. Try again.",
  "Google sign-in is not configured.",
  "Google sign-in is temporarily unavailable. Try again.",
  "GitHub sign-in is temporarily unavailable. Try again.",
]);

class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

function readRetryAfterSeconds(response: Response) {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return null;

  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(1, Math.ceil((retryAt - Date.now()) / 1_000));
}

async function readResponseMessage(response: Response, t: TranslateFn) {
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  const serverMessage =
    typeof payload?.error === "string" ? payload.error.trim() : "";
  if (serverMessage && KNOWN_SERVER_MESSAGES.has(serverMessage)) {
    return t(serverMessage);
  }
  if (serverMessage) return serverMessage;
  return t("Request failed ({status}).", { status: response.status });
}

async function requestAuth<T>(input: string, init: RequestInit, t: TranslateFn) {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new AuthRequestError(
      await readResponseMessage(response, t),
      response.status,
      readRetryAfterSeconds(response),
    );
  }
  return (await response.json().catch(() => ({}))) as T;
}

function normalizeError(error: unknown, t: TranslateFn) {
  if (error instanceof AuthRequestError && error.status === 429) {
    const retryAfter = error.retryAfterSeconds;
    return retryAfter === null
      ? t("Too many attempts. Please try again later.")
      : t("Too many attempts. Please try again in {seconds} seconds.", {
          seconds: retryAfter,
        });
  }
  return error instanceof AuthRequestError
    ? error.message
    : t("Authentication request failed.");
}

export function AuthPanel({
  initialError,
  mode,
  returnTo,
}: {
  initialError?: string;
  mode: AuthMode;
  returnTo: string;
}) {
  const t = useT();
  const requestInFlightRef = useRef(false);
  const [method, setMethod] = useState<AuthMethod>("password");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState<LoadingTarget>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignUp = mode === "sign-up";

  function startOAuth(provider: "github" | "google") {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setLoading(provider);
    setError(null);
    window.location.assign(
      `/api/auth/${provider}/start?mode=${isSignUp ? "signup" : "signin"}&returnTo=${encodeURIComponent(returnTo)}`,
    );
  }

  async function onPasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (requestInFlightRef.current) return;

    if (isSignUp && password !== confirmPassword) {
      setError(t("The two passwords do not match."));
      return;
    }

    requestInFlightRef.current = true;
    setLoading("password");
    setError(null);
    setNotice(null);

    try {
      const result = await requestAuth<{ redirectTo?: string }>(
        `/api/auth/password/${isSignUp ? "sign-up" : "sign-in"}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            ...(isSignUp ? { name, confirmPassword } : {}),
            returnTo,
          }),
        },
        t,
      );
      if (result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }
      window.location.assign(returnTo);
    } catch (err) {
      setError(normalizeError(err, t));
      setLoading(null);
      requestInFlightRef.current = false;
    }
  }

  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setLoading("email");
    setError(null);
    setNotice(null);

    try {
      const result = await requestAuth<{ redirectTo?: string }>(
        "/api/auth/email/start",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email,
            ...(isSignUp ? { name } : {}),
            returnTo,
          }),
        },
        t,
      );
      if (result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }
      setNotice(t("Verification email sent. Check your inbox to finish signing in."));
      setLoading(null);
      requestInFlightRef.current = false;
    } catch (err) {
      setError(normalizeError(err, t));
      setLoading(null);
      requestInFlightRef.current = false;
    }
  }

  const busy = loading !== null;

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h1>{isSignUp ? t("Create account") : t("Sign in to Fugue")}</h1>
        <p>
          {isSignUp
            ? t("Sign up to deploy apps and manage secrets and billing.")
            : t("Use your account to continue to the console.")}
        </p>
      </div>

      <div className="auth-oauth">
        <button
          type="button"
          className="btn block"
          disabled={busy}
          onClick={() => startOAuth("github")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.35 9.35 0 0 1 2.5-.34c.85 0 1.7.11 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
          </svg>
          {loading === "github" ? t("Redirecting…") : t("Continue with GitHub")}
        </button>
        <button
          type="button"
          className="btn block"
          disabled={busy}
          onClick={() => startOAuth("google")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-7.9z" />
            <path fill="#34A853" d="M12 23c2.95 0 5.43-.98 7.24-2.65l-3.54-2.75c-.98.66-2.24 1.05-3.7 1.05-2.85 0-5.26-1.92-6.12-4.5H2.23v2.84A10.99 10.99 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.88 14.15a6.6 6.6 0 0 1 0-4.3V7.01H2.23a11 11 0 0 0 0 9.98l3.65-2.84z" />
            <path fill="#EA4335" d="M12 5.4c1.61 0 3.05.55 4.19 1.64l3.14-3.14A10.98 10.98 0 0 0 12 1 10.99 10.99 0 0 0 2.23 7.01l3.65 2.84C6.74 7.32 9.15 5.4 12 5.4z" />
          </svg>
          {loading === "google" ? t("Redirecting…") : t("Continue with Google")}
        </button>
      </div>

      <div className="auth-sep">{t("Or use email")}</div>

      <div className="auth-tabs">
        <button
          type="button"
          className={method === "password" ? "active" : ""}
          onClick={() => {
            setMethod("password");
            setError(null);
            setNotice(null);
          }}
        >
          {t("Password")}
        </button>
        <button
          type="button"
          className={method === "email" ? "active" : ""}
          onClick={() => {
            setMethod("email");
            setError(null);
            setNotice(null);
          }}
        >
          {t("Email link")}
        </button>
      </div>

      {error && (
        <div className="auth-alert" role="alert" style={{ marginBottom: 13 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="auth-alert ok" style={{ marginBottom: 13 }}>
          {notice}
        </div>
      )}

      {method === "password" ? (
        <form className="auth-form" onSubmit={onPasswordSubmit}>
          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-name">{t("Display name (optional)")}</label>
              <input
                id="auth-name"
                className="input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Your name")}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">{t("Email")}</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">{t("Password")}</label>
            <input
              id="auth-password"
              className="input"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            {isSignUp && <span className="auth-hint">{t("At least 8 characters.")}</span>}
          </div>
          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-confirm">{t("Confirm password")}</label>
              <input
                id="auth-confirm"
                className="input"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}
          <button type="submit" className="btn primary block" disabled={busy}>
            {loading === "password"
              ? t("Processing…")
              : isSignUp
                ? t("Create account")
                : t("Sign in")}
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={onEmailSubmit}>
          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-name-email">{t("Display name (optional)")}</label>
              <input
                id="auth-name-email"
                className="input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Your name")}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email-link">{t("Email")}</label>
            <input
              id="auth-email-link"
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <span className="auth-hint">{t("We'll email you a sign-in link.")}</span>
          </div>
          <button type="submit" className="btn primary block" disabled={busy}>
            {loading === "email" ? t("Sending…") : t("Send sign-in link")}
          </button>
        </form>
      )}

      <div className="auth-foot">
        {isSignUp ? (
          <>
            {t("Already have an account?")}<a href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>{t("Sign in")}</a>
          </>
        ) : (
          <>
            {t("Don't have an account?")}<a href={`/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`}>{t("Sign up")}</a>
          </>
        )}
      </div>
    </div>
  );
}

