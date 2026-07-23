export type GitHubConnectionView = {
  authEnabled: boolean;
  connected: boolean;
  login: string | null;
  name: string | null;
  scopes: string[];
  updatedAt: string | null;
};
