"use client";

import { Alert, AlertDescription, AlertTitle } from "@fugue/ui/components/alert";
import { Button } from "@fugue/ui/components/button";
import { Card, CardContent } from "@fugue/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@fugue/ui/components/field";
import { Form } from "@fugue/ui/components/form";
import { Input } from "@fugue/ui/components/input";
import {
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { type AuthPanelMessages, interpolateAuthMessage } from "@/lib/auth/ui-messages";

type AuthMode = "sign-in" | "sign-up";
type AuthMethod = "password" | "email";
type LoadingTarget = "email" | "github" | "google" | "password";

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

  if (!value) {
    return null;
  }

  const seconds = Number.parseInt(value, 10);

  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds;
  }

  const retryAt = Date.parse(value);

  if (!Number.isFinite(retryAt)) {
    return null;
  }

  return Math.max(1, Math.ceil((retryAt - Date.now()) / 1_000));
}

async function readResponseMessage(response: Response, messages: AuthPanelMessages) {
  const payload = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;

  const serverMessage = typeof payload?.error === "string" ? payload.error.trim() : "";

  if (serverMessage && messages.serverMessages[serverMessage]) {
    return messages.serverMessages[serverMessage];
  }

  return interpolateAuthMessage(messages.requestFailedStatus, {
    status: response.status,
  });
}

async function requestAuth<T>(
  input: string,
  init: RequestInit,
  messages: AuthPanelMessages,
) {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new AuthRequestError(
      await readResponseMessage(response, messages),
      response.status,
      readRetryAfterSeconds(response),
    );
  }

  return (await response.json().catch(() => ({}))) as T;
}

function normalizeError(error: unknown, messages: AuthPanelMessages) {
  if (error instanceof AuthRequestError && error.status === 429) {
    const retryAfter = error.retryAfterSeconds;
    return {
      message:
        retryAfter === null
          ? messages.tooManyAttempts
          : interpolateAuthMessage(messages.tooManyAttemptsSeconds, {
              seconds: retryAfter,
            }),
      retryAfter,
    };
  }

  return {
    message:
      error instanceof AuthRequestError
        ? error.message
        : messages.authenticationRequestFailed,
    retryAfter: null,
  };
}

export function AuthPanel({
  initialError,
  messages,
  mode,
  returnTo,
}: {
  initialError?: string;
  messages: AuthPanelMessages;
  mode: AuthMode;
  returnTo: string;
}) {
  const id = useId();
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const requestInFlightRef = useRef(false);
  const [method, setMethod] = useState<AuthMethod>("password");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [invalidField, setInvalidField] = useState<
    "confirmPassword" | "email" | "password" | null
  >(null);
  const [loading, setLoading] = useState<LoadingTarget | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const emailInvalid = email.length > 0 && !email.includes("@");
  const emailFieldInvalid = emailInvalid || invalidField === "email";
  const passwordFieldInvalid = invalidField === "password";
  const confirmPasswordFieldInvalid =
    invalidField === "confirmPassword" ||
    (confirmPassword.length > 0 && password !== confirmPassword);
  const busy = loading !== null;
  const rateLimited = retryAfter !== null && retryAfter > 0;

  useEffect(() => {
    if (!rateLimited) {
      return;
    }

    const timer = window.setInterval(() => {
      setRetryAfter((current) =>
        current === null || current <= 1 ? null : current - 1,
      );
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [rateLimited]);

  function resetFeedback() {
    setError(null);
    setInvalidField(null);
    setNotice(null);
  }

  function focusAfterStateUpdate(ref: RefObject<HTMLInputElement | null>) {
    window.requestAnimationFrame(() => ref.current?.focus());
  }

  function startOAuth(provider: "google" | "github") {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    resetFeedback();
    setLoading(provider);
    window.location.assign(
      `/api/auth/${provider}/start?mode=${mode === "sign-up" ? "signup" : "signin"}&returnTo=${encodeURIComponent(returnTo)}`,
    );
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requestInFlightRef.current) return;

    resetFeedback();

    if (!email || emailInvalid) {
      setError(messages.enterValidEmail);
      setInvalidField("email");
      focusAfterStateUpdate(emailRef);
      return;
    }

    if (method === "password") {
      if (password.length < 10) {
        setError(messages.passwordMinimum);
        setInvalidField("password");
        focusAfterStateUpdate(passwordRef);
        return;
      }

      if (mode === "sign-up" && password !== confirmPassword) {
        setError(messages.passwordsMismatch);
        setInvalidField("confirmPassword");
        focusAfterStateUpdate(confirmPasswordRef);
        return;
      }

      requestInFlightRef.current = true;
      setLoading("password");

      try {
        const result = await requestAuth<{
          message?: string;
          ok: boolean;
          redirectTo?: string;
        }>(
          `/api/auth/password/${mode === "sign-up" ? "sign-up" : "sign-in"}`,
          {
            body: JSON.stringify({
              confirmPassword,
              email,
              name,
              password,
              returnTo,
            }),
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
          messages,
        );
        if (result.redirectTo) {
          window.location.assign(result.redirectTo);
          return;
        }

        setNotice(messages.checkEmailFinish);
        requestInFlightRef.current = false;
        setLoading(null);
      } catch (nextError) {
        const failure = normalizeError(nextError, messages);
        setError(failure.message);
        setRetryAfter(failure.retryAfter);
        requestInFlightRef.current = false;
        setLoading(null);
        focusAfterStateUpdate(emailRef);
      }

      return;
    }

    requestInFlightRef.current = true;
    setLoading("email");

    try {
      const result = await requestAuth<{
        message?: string;
        ok: boolean;
        redirectTo?: string;
      }>(
        "/api/auth/email/start",
        {
          body: JSON.stringify({
            email,
            mode: mode === "sign-up" ? "signup" : "signin",
            name,
            returnTo,
          }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
        messages,
      );

      if (result.redirectTo) {
        window.location.assign(result.redirectTo);
        return;
      }

      setNotice(interpolateAuthMessage(messages.verificationSent, { email }));
    } catch (nextError) {
      const failure = normalizeError(nextError, messages);
      setError(failure.message);
      setRetryAfter(failure.retryAfter);
      focusAfterStateUpdate(emailRef);
    } finally {
      requestInFlightRef.current = false;
      setLoading(null);
    }
  }

  const fields = (
    <FieldGroup>
      {mode === "sign-up" ? (
        <Field data-disabled={busy || undefined}>
          <FieldLabel htmlFor={`${id}-name`}>{messages.displayName}</FieldLabel>
          <Input
            autoComplete="name"
            disabled={busy}
            id={`${id}-name`}
            maxLength={80}
            name="name"
            onChange={(event) => setName(event.target.value)}
            type="text"
            value={name}
          />
        </Field>
      ) : null}

      <Field
        data-disabled={busy || undefined}
        data-invalid={emailFieldInvalid || undefined}
      >
        <FieldLabel htmlFor={`${id}-email`}>{messages.email}</FieldLabel>
        <Input
          aria-describedby={emailFieldInvalid ? `${id}-email-error` : undefined}
          aria-invalid={emailFieldInvalid || undefined}
          autoCapitalize="none"
          autoComplete="email"
          disabled={busy}
          id={`${id}-email`}
          inputMode="email"
          maxLength={320}
          name="email"
          onChange={(event) => {
            setEmail(event.target.value);
            if (invalidField === "email") setInvalidField(null);
          }}
          required
          spellCheck={false}
          type="email"
          value={email}
          ref={emailRef}
        />
        {emailFieldInvalid ? (
          <FieldError id={`${id}-email-error`} role="alert">
            {messages.enterValidEmail}
          </FieldError>
        ) : null}
      </Field>

      {method === "password" ? (
        <>
          <Field
            data-disabled={busy || undefined}
            data-invalid={passwordFieldInvalid || undefined}
          >
            <FieldLabel htmlFor={`${id}-password`}>{messages.password}</FieldLabel>
            <Input
              aria-describedby={
                passwordFieldInvalid ? `${id}-password-error` : undefined
              }
              aria-invalid={passwordFieldInvalid || undefined}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              disabled={busy}
              id={`${id}-password`}
              maxLength={256}
              minLength={10}
              name="password"
              onChange={(event) => {
                setPassword(event.target.value);
                if (invalidField === "password") setInvalidField(null);
              }}
              required
              type="password"
              value={password}
              ref={passwordRef}
            />
            <FieldDescription>
              {mode === "sign-up"
                ? messages.passwordSignUpHelp
                : messages.passwordSignInHelp}
            </FieldDescription>
            {passwordFieldInvalid ? (
              <FieldError id={`${id}-password-error`} role="alert">
                {messages.passwordMinimum}
              </FieldError>
            ) : null}
          </Field>
          {mode === "sign-up" ? (
            <Field
              data-disabled={busy || undefined}
              data-invalid={confirmPasswordFieldInvalid || undefined}
            >
              <FieldLabel htmlFor={`${id}-confirm-password`}>
                {messages.confirmPassword}
              </FieldLabel>
              <Input
                aria-describedby={
                  confirmPasswordFieldInvalid
                    ? `${id}-confirm-password-error`
                    : undefined
                }
                aria-invalid={confirmPasswordFieldInvalid || undefined}
                autoComplete="new-password"
                disabled={busy}
                id={`${id}-confirm-password`}
                maxLength={256}
                minLength={10}
                name="confirmPassword"
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  if (invalidField === "confirmPassword") setInvalidField(null);
                }}
                required
                type="password"
                value={confirmPassword}
                ref={confirmPasswordRef}
              />
              {confirmPasswordFieldInvalid ? (
                <FieldError id={`${id}-confirm-password-error`} role="alert">
                  {messages.passwordsMismatch}
                </FieldError>
              ) : null}
            </Field>
          ) : null}
        </>
      ) : (
        <Alert variant="info">
          <AlertTitle>{messages.emailLinkTitle}</AlertTitle>
          <AlertDescription>{messages.emailLinkDescription}</AlertDescription>
        </Alert>
      )}
    </FieldGroup>
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div aria-live="polite" className="flex flex-col gap-3">
          {error ? (
            <Alert variant={rateLimited ? "warning" : "error"}>
              <AlertTitle>
                {rateLimited ? messages.tryAgainLaterTitle : messages.authFailedTitle}
              </AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {notice ? (
            <Alert variant="success">
              <AlertTitle>{messages.checkEmailTitle}</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            disabled={busy || rateLimited}
            loading={loading === "google"}
            onClick={() => startOAuth("google")}
            type="button"
            variant="outline"
          >
            {loading === "google" ? messages.continuingGoogle : messages.continueGoogle}
          </Button>
          <Button
            disabled={busy || rateLimited}
            loading={loading === "github"}
            onClick={() => startOAuth("github")}
            type="button"
            variant="outline"
          >
            {loading === "github" ? messages.continuingGithub : messages.continueGithub}
          </Button>
        </div>

        <Form className="flex flex-col gap-5" onSubmit={submitAuth}>
          <fieldset className="coss-auth-methods" disabled={busy}>
            <legend className="coss-sr-only">{messages.authMethodLabel}</legend>
            {(
              [
                ["password", messages.password],
                ["email", messages.emailLink],
              ] as const
            ).map(([value, label]) => (
              <label data-checked={method === value || undefined} key={value}>
                <input
                  checked={method === value}
                  className="coss-sr-only"
                  name="authMethod"
                  onChange={() => setMethod(value)}
                  type="radio"
                  value={value}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          {fields}

          <Button
            disabled={busy || rateLimited}
            loading={loading === "email" || loading === "password"}
            type="submit"
          >
            {rateLimited
              ? interpolateAuthMessage(messages.tryAgainSeconds, {
                  seconds: retryAfter ?? 0,
                })
              : method === "password"
                ? mode === "sign-up"
                  ? loading === "password"
                    ? messages.creatingAccount
                    : messages.createAccount
                  : loading === "password"
                    ? messages.signingIn
                    : messages.signIn
                : loading === "email"
                  ? messages.sendingLink
                  : messages.sendLink}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}
