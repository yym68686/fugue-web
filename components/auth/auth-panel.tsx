"use client";

import { type FormEvent, useRef, useState } from "react";

type AuthMode = "sign-in" | "sign-up";
type AuthMethod = "password" | "email";
type LoadingTarget = "email" | "github" | "google" | "password" | null;

const SERVER_MESSAGES: Record<string, string> = {
  "Enter a valid email address.": "请输入有效的邮箱地址。",
  "Enter a password.": "请输入密码。",
  "Enter your current password.": "请输入当前密码。",
  "Choose a new password.": "请设置新密码。",
  "Current password is incorrect.": "当前密码不正确。",
  "Display name is too long.": "显示名称过长。",
  "Invalid request payload.": "请求内容无效。",
  "This account is blocked.": "该账号已被封禁。",
  "This account has been deleted.": "该账号已被删除。",
  "Authentication request payload is too large.": "认证请求体过大。",
  "Verification email could not be sent. Try again.": "验证邮件发送失败，请重试。",
  "Email verification is temporarily unavailable. Try again.":
    "邮箱验证暂时不可用，请重试。",
  "Fugue could not open the workspace session. Try again.":
    "无法打开工作空间会话，请重试。",
  "Google sign-in is not configured.": "Google 登录未配置。",
  "Google sign-in is temporarily unavailable. Try again.":
    "Google 登录暂时不可用，请重试。",
  "GitHub sign-in is temporarily unavailable. Try again.":
    "GitHub 登录暂时不可用，请重试。",
};

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

async function readResponseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  const serverMessage =
    typeof payload?.error === "string" ? payload.error.trim() : "";
  if (serverMessage && SERVER_MESSAGES[serverMessage]) {
    return SERVER_MESSAGES[serverMessage];
  }
  if (serverMessage) return serverMessage;
  return `请求失败（${response.status}）。`;
}

async function requestAuth<T>(input: string, init: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new AuthRequestError(
      await readResponseMessage(response),
      response.status,
      readRetryAfterSeconds(response),
    );
  }
  return (await response.json().catch(() => ({}))) as T;
}

function normalizeError(error: unknown) {
  if (error instanceof AuthRequestError && error.status === 429) {
    const retryAfter = error.retryAfterSeconds;
    return retryAfter === null
      ? "尝试过于频繁，请稍后再试。"
      : `尝试过于频繁，请在 ${retryAfter} 秒后再试。`;
  }
  return error instanceof AuthRequestError ? error.message : "认证请求失败。";
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
      setError("两次输入的密码不一致。");
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
      );
      if (result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }
      window.location.assign(returnTo);
    } catch (err) {
      setError(normalizeError(err));
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
      );
      if (result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }
      setNotice("验证邮件已发送，请查收邮箱完成登录。");
      setLoading(null);
      requestInFlightRef.current = false;
    } catch (err) {
      setError(normalizeError(err));
      setLoading(null);
      requestInFlightRef.current = false;
    }
  }

  const busy = loading !== null;

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h1>{isSignUp ? "创建账号" : "登录 Fugue"}</h1>
        <p>
          {isSignUp
            ? "注册后即可部署应用、管理密钥与账单。"
            : "使用你的账号继续访问控制台。"}
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
          {loading === "github" ? "跳转中…" : "使用 GitHub 继续"}
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
          {loading === "google" ? "跳转中…" : "使用 Google 继续"}
        </button>
      </div>

      <div className="auth-sep">或使用邮箱</div>

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
          密码
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
          邮件链接
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
              <label htmlFor="auth-name">显示名称（可选）</label>
              <input
                id="auth-name"
                className="input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的名字"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">邮箱</label>
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
            <label htmlFor="auth-password">密码</label>
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
            {isSignUp && <span className="auth-hint">至少 8 个字符。</span>}
          </div>
          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-confirm">确认密码</label>
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
              ? "处理中…"
              : isSignUp
                ? "创建账号"
                : "登录"}
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={onEmailSubmit}>
          {isSignUp && (
            <div className="field">
              <label htmlFor="auth-name-email">显示名称（可选）</label>
              <input
                id="auth-name-email"
                className="input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的名字"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email-link">邮箱</label>
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
            <span className="auth-hint">我们会发送一封登录链接邮件给你。</span>
          </div>
          <button type="submit" className="btn primary block" disabled={busy}>
            {loading === "email" ? "发送中…" : "发送登录链接"}
          </button>
        </form>
      )}

      <div className="auth-foot">
        {isSignUp ? (
          <>
            已有账号？<a href={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>登录</a>
          </>
        ) : (
          <>
            还没有账号？<a href={`/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`}>注册</a>
          </>
        )}
      </div>
    </div>
  );
}

