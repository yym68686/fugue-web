export type AuthPanelMessages = {
  authFailedTitle: string;
  authMethodLabel: string;
  authenticationRequestFailed: string;
  checkEmailFinish: string;
  checkEmailTitle: string;
  confirmPassword: string;
  continueGithub: string;
  continueGoogle: string;
  continuingGithub: string;
  continuingGoogle: string;
  createAccount: string;
  creatingAccount: string;
  displayName: string;
  email: string;
  emailLink: string;
  emailLinkDescription: string;
  emailLinkTitle: string;
  enterValidEmail: string;
  password: string;
  passwordMinimum: string;
  passwordSignInHelp: string;
  passwordSignUpHelp: string;
  passwordsMismatch: string;
  requestFailedStatus: string;
  sendLink: string;
  sendingLink: string;
  serverMessages: Record<string, string>;
  signIn: string;
  signingIn: string;
  tooManyAttempts: string;
  tooManyAttemptsSeconds: string;
  tryAgainLaterTitle: string;
  tryAgainSeconds: string;
  verificationSent: string;
};

export type AuthFinalizeMessages = {
  completeSession: string;
  handoffDescription: string;
  handoffTokenMissingDescription: string;
  handoffTokenMissingTitle: string;
  missingToken: string;
  ready: string;
  restartSignIn: string;
  validating: string;
};

type Translate = (key: string) => string;

export function createAuthPanelMessages(t: Translate): AuthPanelMessages {
  const serverMessageKeys = [
    "Account registration is temporarily unavailable.",
    "Authentication protection is temporarily unavailable. Try again.",
    "Authentication request payload is too large.",
    "Display name is too long.",
    "Email or password is incorrect.",
    "Enter a password.",
    "Enter a valid email address.",
    "Fugue could not open the workspace session. Try again.",
    "Invalid request payload.",
    "Passwords do not match.",
    "Passwords must stay under 256 characters.",
    "This account has been deleted.",
    "This account is blocked.",
    "Use at least 10 characters.",
    "Verification email could not be sent. Try again.",
  ] as const;

  return {
    authFailedTitle: t("Authentication failed"),
    authMethodLabel: t("Authentication method"),
    authenticationRequestFailed: t("Authentication request failed."),
    checkEmailFinish: t("Check your email to finish creating the account."),
    checkEmailTitle: t("Check your email"),
    confirmPassword: t("Confirm password"),
    continueGithub: t("Continue with GitHub"),
    continueGoogle: t("Continue with Google"),
    continuingGithub: t("Continuing with GitHub…"),
    continuingGoogle: t("Continuing with Google…"),
    createAccount: t("Create account"),
    creatingAccount: t("Creating account…"),
    displayName: t("Display name"),
    email: t("Email"),
    emailLink: t("Email link"),
    emailLinkDescription: t(
      "A verification link creates or resumes the session without exposing credentials.",
    ),
    emailLinkTitle: t("Email link mode"),
    enterValidEmail: t("Enter a valid email address."),
    password: t("Password"),
    passwordMinimum: t("Password must be at least 10 characters."),
    passwordSignInHelp: t("Use an existing password for this account."),
    passwordSignUpHelp: t(
      "Use at least 10 characters. Email verification is still required.",
    ),
    passwordsMismatch: t("Passwords do not match."),
    requestFailedStatus: t("Request failed with status {status}."),
    sendLink: t("Send link"),
    sendingLink: t("Sending link…"),
    serverMessages: Object.fromEntries(serverMessageKeys.map((key) => [key, t(key)])),
    signIn: t("Sign in"),
    signingIn: t("Signing in…"),
    tooManyAttempts: t("Too many attempts. Wait a moment and try again."),
    tooManyAttemptsSeconds: t("Too many attempts. Try again in {seconds} seconds."),
    tryAgainLaterTitle: t("Try again later"),
    tryAgainSeconds: t("Try again in {seconds} seconds"),
    verificationSent: t("Verification link sent to {email}."),
  };
}

export function createAuthFinalizeMessages(t: Translate): AuthFinalizeMessages {
  return {
    completeSession: t("Complete session"),
    handoffDescription: t(
      "Fugue validates the provider handoff token, creates a first-party session, and redirects to the requested destination.",
    ),
    handoffTokenMissingDescription: t(
      "Start a fresh sign-in flow to receive a new browser session token.",
    ),
    handoffTokenMissingTitle: t("Handoff token missing"),
    missingToken: t("Missing token"),
    ready: t("Ready"),
    restartSignIn: t("Restart sign in"),
    validating: t("Validating…"),
  };
}

export function interpolateAuthMessage(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] === undefined ? `{${key}}` : String(values[key]),
  );
}
