export type ShellMessages = {
  accessKeys: string;
  account: string;
  admin: string;
  apps: string;
  billing: string;
  breadcrumb: string;
  cluster: string;
  configure: string;
  console: string;
  consoleNavigation: string;
  createProjectSteps: string;
  deploy: string;
  dns: string;
  docs: string;
  fugueHome: string;
  getStarted: string;
  profile: string;
  profileAndSecurity: string;
  projects: string;
  publicNavigation: string;
  servers: string;
  signIn: string;
  skipToMain: string;
  source: string;
  users: string;
  workspace: string;
};

export type ClientUiMessages = {
  cancel: string;
  close: string;
  confirm: string;
  consoleRenderFailedDescription: string;
  consoleRenderFailedTitle: string;
  copy: string;
  copyFailed: string;
  copySucceeded: string;
  loadingConsoleData: string;
  localeUpdateFailed: string;
  next: string;
  pageRenderFailedDescription: string;
  pageRenderFailedTitle: string;
  previous: string;
  retry: string;
  retryConsole: string;
  showingOf: string;
  tablePagination: string;
};

export type ProfileFormMessages = {
  loadProfileFailed: string;
  noSignInMethod: string;
  noSignInMethodDescription: string;
  passwordSaveFailed: string;
  displayNameTooLong: string;
  passwordMinimum: string;
  profileUpdateFailed: string;
  signInMethodsUpdateFailed: string;
};

export type NewProjectFormMessages = {
  advancedSettings: string;
  advancedSettingsDescription: string;
  chooseSourceFirst: string;
  deployFailed: string;
  duplicateKey: string;
  duplicateKeyDescription: string;
  imageReferenceRequired: string;
  noRuntimeTargets: string;
  noRuntimeTargetsDescription: string;
  projectNameRequired: string;
  repositoryLinkRequired: string;
  runtimeTargetsUnavailable: string;
  servicePortInvalid: string;
  templateDescription: string;
  templateLabel: string;
  unknown: string;
  variableKey: string;
  variableValue: string;
};

type Translate = (key: string) => string;

export function interpolateUiMessage(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = values[key];
    return value === undefined ? placeholder : String(value);
  });
}

export function createShellMessages(t: Translate): ShellMessages {
  return {
    accessKeys: t("Access keys"),
    account: t("Account"),
    admin: t("Admin"),
    apps: t("Apps"),
    billing: t("Billing"),
    breadcrumb: t("Breadcrumb"),
    cluster: t("Cluster"),
    configure: t("Configure"),
    console: t("Console"),
    consoleNavigation: t("Console navigation"),
    createProjectSteps: t("Create project steps"),
    deploy: t("Deploy"),
    dns: t("DNS"),
    docs: t("Docs"),
    fugueHome: t("Fugue home"),
    getStarted: t("Get started"),
    profile: t("Profile"),
    profileAndSecurity: t("Profile and security"),
    projects: t("Projects"),
    publicNavigation: t("Public navigation"),
    servers: t("Servers"),
    signIn: t("Sign in"),
    skipToMain: t("Skip to main content"),
    source: t("Source"),
    users: t("Users"),
    workspace: t("Workspace"),
  };
}

export function createClientUiMessages(t: Translate): ClientUiMessages {
  return {
    cancel: t("Cancel"),
    close: t("Close"),
    confirm: t("Confirm"),
    consoleRenderFailedDescription: t(
      "The protected workspace view could not render. Retry without leaving the console.",
    ),
    consoleRenderFailedTitle: t("Console surface failed"),
    copy: t("Copy"),
    copyFailed: t("Could not copy to clipboard."),
    copySucceeded: t("Copied to clipboard."),
    loadingConsoleData: t("Loading console data…"),
    localeUpdateFailed: t("Unable to update the interface language."),
    next: t("Next"),
    pageRenderFailedDescription: t(
      "The page failed to render. Retry keeps the current route and asks React to recover.",
    ),
    pageRenderFailedTitle: t("Something went wrong"),
    previous: t("Previous"),
    retry: t("Retry"),
    retryConsole: t("Retry console"),
    showingOf: t("Showing {visible} of {total}"),
    tablePagination: t("Table pagination"),
  };
}

export function createProfileFormMessages(t: Translate): ProfileFormMessages {
  return {
    displayNameTooLong: t("Display name must be 80 characters or fewer."),
    loadProfileFailed: t("Fugue could not load the profile settings right now."),
    noSignInMethod: t("No sign-in method is recorded."),
    noSignInMethodDescription: t(
      "Enable email link or connect an OAuth provider before leaving this page.",
    ),
    passwordSaveFailed: t("Could not save password."),
    passwordMinimum: t("Password must be at least 10 characters."),
    profileUpdateFailed: t("Could not update your profile."),
    signInMethodsUpdateFailed: t("Could not update sign-in methods."),
  };
}

export function createNewProjectFormMessages(t: Translate): NewProjectFormMessages {
  return {
    advancedSettings: t("Advanced settings"),
    advancedSettingsDescription: t(
      "Network mode and persistent storage are available after source validation.",
    ),
    chooseSourceFirst: t("Choose a source archive or source file first."),
    deployFailed: t("Deploy failed"),
    duplicateKey: t("Duplicate key"),
    duplicateKeyDescription: t("Environment keys must be unique before save."),
    imageReferenceRequired: t("Image reference is required."),
    noRuntimeTargets: t("No runtime targets"),
    noRuntimeTargetsDescription: t(
      "Fugue did not return a selectable runtime target. Leaving this blank lets the control plane choose the default placement.",
    ),
    projectNameRequired: t("Project name is required."),
    repositoryLinkRequired: t("Repository link is required."),
    runtimeTargetsUnavailable: t("Runtime targets unavailable"),
    servicePortInvalid: t("Service port must be a positive integer."),
    templateDescription: t(
      "Template variables and topology preview are included in the deploy payload.",
    ),
    templateLabel: t("Template: {template}"),
    unknown: t("Unknown"),
    variableKey: t("Variable {index} key"),
    variableValue: t("Variable {index} value"),
  };
}
