export type GitHubImageLink = {
  id: string;
  fugueAppId: string;
  githubRepo: string;
  githubInstallationId: string;
  githubWorkflow: string;
  githubBranch: string;
  githubPackage: string;
  imageRef: string;
  enabled: boolean;
  lastWebhookReceivedAt: string | null;
  lastImageSyncAt: string | null;
  lastImageSyncError: string;
};

export type GitHubImageJob = {
  deliveryId: string;
  eventName: string;
  status: string;
  attempts: number;
  operationId: string;
  lastError: string;
  updatedAt: string;
};

export type GitHubImageSettings = {
  configured: boolean;
  githubConnected: boolean;
  link: GitHubImageLink | null;
  jobs: GitHubImageJob[];
  imageRef: string | null;
  trackingEnabled: boolean;
};

export type GitHubImageEvent = {
  deliveryId: string;
  eventName: string;
  installationId: string;
  repo: string;
  workflow: string;
  workflowPath: string;
  branch: string;
  packageName: string;
};
