export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const [auth, bootstrap, fugue, rateLimit, seal] = await Promise.all([
    import("@/lib/auth/env"),
    import("@/lib/app-users/admin-bootstrap"),
    import("@/lib/fugue/warm"),
    import("@/lib/auth/rate-limit"),
    import("@/lib/security/seal"),
  ]);

  auth.validateAuthRuntimeConfiguration();
  bootstrap.validateAdminBootstrapConfiguration();
  rateLimit.validateAuthRateLimitConfiguration();
  seal.validateSealConfiguration();
  void fugue.warmServerRuntime();
}
