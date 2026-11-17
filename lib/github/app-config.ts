import "server-only";

export function githubAppConfiguration() {
  const id = process.env.GITHUB_APP_ID?.trim() ?? "";
  const slug = process.env.GITHUB_APP_SLUG?.trim() ?? "";
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim().replace(/\\n/g, "\n") ?? "";
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() ?? "";
  return { id, slug, privateKey, webhookSecret, configured: Boolean(id && slug && privateKey && webhookSecret) };
}

export function requireGitHubAppConfiguration() {
  const config = githubAppConfiguration();
  if (!config.configured) throw new Error("503 GitHub App is not configured.");
  if (!/^[a-z0-9-]+$/.test(config.slug) || !/^\d+$/.test(config.id)) {
    throw new Error("503 GitHub App configuration is invalid.");
  }
  return config;
}
