import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { Client } from "pg";

const baseDatabaseUrl = (
  process.env.FUGUE_TEST_DATABASE_URL ?? process.env.TEST_DATABASE_URL
)?.trim();

if (process.env.CI && !baseDatabaseUrl) {
  throw new Error(
    "CI integration tests require FUGUE_TEST_DATABASE_URL or TEST_DATABASE_URL",
  );
}

(baseDatabaseUrl ? describe : describe.skip)(
  "PostgreSQL auth security invariants",
  () => {
    const databaseName = `fugue_auth_${process.pid}_${Date.now()}`.replace(
      /[^a-z0-9_]/g,
      "",
    );
    const ordinaryPrefix = `ordinary-${process.pid}-${Date.now()}`;
    let adminClient: Client;
    let beginOAuthTransaction: typeof import("../../lib/auth/oauth-transaction").beginOAuthTransaction;
    let consumeOAuthTransaction: typeof import("../../lib/auth/oauth-transaction").consumeOAuthTransaction;
    let ensureAppUserRecord: typeof import("../../lib/app-users/store").ensureAppUserRecord;
    let enforceAuthRateLimit: typeof import("../../lib/auth/rate-limit").enforceAuthRateLimit;
    let finalizeOAuthTransaction: typeof import("../../lib/auth/oauth-transaction").finalizeOAuthTransaction;
    let getAppUserByEmail: typeof import("../../lib/app-users/store").getAppUserByEmail;
    let getDbPool: typeof import("../../lib/db/pool").getDbPool;
    let hashPassword: typeof import("../../lib/auth/password").hashPassword;
    let listAuthMethodsByEmail: typeof import("../../lib/auth/methods").listAuthMethodsByEmail;
    let queryDb: typeof import("../../lib/db/pool").queryDb;
    let registerPasswordAuthMethod: typeof import("../../lib/auth/methods").registerPasswordAuthMethod;
    let removeAuthMethod: typeof import("../../lib/auth/methods").removeAuthMethod;
    let saveWorkspaceAccess: typeof import("../../lib/workspace/store").saveWorkspaceAccess;
    let sealText: typeof import("../../lib/security/seal").sealText;
    let setAppUserAdmin: typeof import("../../lib/app-users/store").setAppUserAdmin;
    let setAppUserStatus: typeof import("../../lib/app-users/store").setAppUserStatus;
    let upsertEmailLinkAuthMethod: typeof import("../../lib/auth/methods").upsertEmailLinkAuthMethod;

    beforeAll(async () => {
      const adminUrl = new URL(baseDatabaseUrl as string);
      adminUrl.pathname = "/postgres";
      adminClient = new Client({ connectionString: adminUrl.toString() });
      await adminClient.connect();
      await adminClient.query(`CREATE DATABASE "${databaseName}"`);

      const isolatedUrl = new URL(baseDatabaseUrl as string);
      isolatedUrl.pathname = `/${databaseName}`;
      process.env.DATABASE_URL = isolatedUrl.toString();
      process.env.APP_BASE_URL = "http://localhost:3000";
      process.env.AUTH_RATE_LIMIT_SECRET =
        "integration-rate-limit-secret-at-least-32-characters";
      process.env.AUTH_SESSION_SECRET =
        "integration-session-secret-at-least-32-characters";
      process.env.FUGUE_API_URL = "https://control-plane.integration.invalid";
      process.env.FUGUE_BOOTSTRAP_KEY =
        "integration-bootstrap-key-at-least-32-characters";
      process.env.GITHUB_AUTH_CLIENT_ID = "integration-github-client";
      process.env.GITHUB_AUTH_CLIENT_SECRET = "integration-github-secret";
      process.env.GITHUB_AUTH_REDIRECT_URI =
        "http://localhost:3000/api/auth/github/callback";
      process.env.GOOGLE_CLIENT_ID = "integration-google-client";
      process.env.GOOGLE_CLIENT_SECRET = "integration-google-secret";
      process.env.GOOGLE_REDIRECT_URI =
        "http://localhost:3000/api/auth/google/callback";
      process.env.RESEND_API_KEY = "integration-resend-key";
      process.env.RESEND_FROM_EMAIL = "test@example.test";
      process.env.WORKSPACE_STORE_KEY_ID = "integration";
      process.env.WORKSPACE_STORE_SECRET =
        "integration-workspace-secret-at-least-32-characters";
      delete process.env.FUGUE_ADMIN_BOOTSTRAP_EMAIL;

      globalThis.__fuguePgPool = undefined;
      globalThis.__fugueDbSchemaPromise = undefined;
      globalThis.__fugueDbSchemaVersion = undefined;

      const poolModule = await import("../../lib/db/pool");
      const schemaModule = await import("../../lib/db/schema");
      const userStore = await import("../../lib/app-users/store");
      const authMethods = await import("../../lib/auth/methods");
      const oauthTransactions = await import("../../lib/auth/oauth-transaction");
      const rateLimit = await import("../../lib/auth/rate-limit");
      const password = await import("../../lib/auth/password");
      const workspaceStore = await import("../../lib/workspace/store");
      const securitySeal = await import("../../lib/security/seal");

      getDbPool = poolModule.getDbPool;
      queryDb = poolModule.queryDb;
      ensureAppUserRecord = userStore.ensureAppUserRecord;
      getAppUserByEmail = userStore.getAppUserByEmail;
      setAppUserAdmin = userStore.setAppUserAdmin;
      setAppUserStatus = userStore.setAppUserStatus;
      listAuthMethodsByEmail = authMethods.listAuthMethodsByEmail;
      registerPasswordAuthMethod = authMethods.registerPasswordAuthMethod;
      removeAuthMethod = authMethods.removeAuthMethod;
      upsertEmailLinkAuthMethod = authMethods.upsertEmailLinkAuthMethod;
      beginOAuthTransaction = oauthTransactions.beginOAuthTransaction;
      consumeOAuthTransaction = oauthTransactions.consumeOAuthTransaction;
      finalizeOAuthTransaction = oauthTransactions.finalizeOAuthTransaction;
      enforceAuthRateLimit = rateLimit.enforceAuthRateLimit;
      hashPassword = password.hashPassword;
      saveWorkspaceAccess = workspaceStore.saveWorkspaceAccess;
      sealText = securitySeal.sealText;

      await schemaModule.ensureDbSchema();
    });

    afterAll(async () => {
      delete process.env.FUGUE_ADMIN_BOOTSTRAP_EMAIL;
      await getDbPool?.().end();
      globalThis.__fuguePgPool = undefined;
      globalThis.__fugueDbSchemaPromise = undefined;
      globalThis.__fugueDbSchemaVersion = undefined;

      if (adminClient) {
        await adminClient.query(
          `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
        );
        await adminClient.end();
      }
    });

    test("ordinary email and OAuth registrations never inherit an empty-database admin role", async () => {
      for (const provider of ["email", "google", "github"] as const) {
        const user = await ensureAppUserRecord(
          {
            email: `${ordinaryPrefix}-${provider}@example.test`,
            provider,
            providerId: provider === "email" ? undefined : `${provider}-fixture`,
            verified: true,
          },
          { markSignedIn: true },
        );

        expect(user.isAdmin).toBeFalse();
        expect(user.sessionVersion).toBe(1);
      }
    });

    test("configured bootstrap is globally serialized, durable and never replayed", async () => {
      const bootstrapEmail = `bootstrap-${ordinaryPrefix}@example.test`;
      process.env.FUGUE_ADMIN_BOOTSTRAP_EMAIL = bootstrapEmail;
      const candidate = {
        email: bootstrapEmail,
        provider: "email" as const,
        verified: true,
      };
      const results = await Promise.all([
        ensureAppUserRecord(candidate, { markSignedIn: true }),
        ensureAppUserRecord(candidate, { markSignedIn: true }),
      ]);

      expect(results.every((user) => user.isAdmin)).toBeTrue();
      const state = await queryDb<{
        admin_email: string;
        completed: boolean;
      }>(
        `SELECT completed, admin_email FROM app_admin_bootstrap_state WHERE singleton = TRUE`,
      );
      expect(state.rows).toHaveLength(1);
      expect(state.rows[0]?.completed).toBeTrue();
      expect(state.rows[0]?.admin_email).toBe(bootstrapEmail);

      const completedEvents = await queryDb<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app_security_audit_events WHERE action = 'admin.bootstrap.completed'`,
      );
      expect(Number(completedEvents.rows[0]?.count)).toBe(1);

      const replayEmail = `bootstrap-replay-${ordinaryPrefix}@example.test`;
      process.env.FUGUE_ADMIN_BOOTSTRAP_EMAIL = replayEmail;
      const replayed = await ensureAppUserRecord(
        {
          email: replayEmail,
          provider: "google",
          providerId: "replay",
          verified: true,
        },
        { markSignedIn: true },
      );
      expect(replayed.isAdmin).toBeFalse();
    });

    test("unverified password registration cannot sign in and concurrent method removal preserves one method", async () => {
      const email = `password-${ordinaryPrefix}@example.test`;
      const password = "Correct horse battery staple 42!";
      const registration = await registerPasswordAuthMethod({
        email,
        passwordHash: await hashPassword(password),
      });
      expect(registration.created).toBeTrue();

      const unverifiedUser = await getAppUserByEmail(email);
      expect(unverifiedUser?.verified).toBeFalse();
      const signInRoute = await import("../../app/api/auth/password/sign-in/route");
      const response = await signInRoute.POST(
        new Request("http://localhost:3000/api/auth/password/sign-in", {
          body: JSON.stringify({ email, password, returnTo: "/app" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: "Email or password is incorrect.",
      });

      await upsertEmailLinkAuthMethod(email);
      const versionBefore = (await getAppUserByEmail(email))?.sessionVersion ?? 0;
      const removals = await Promise.allSettled([
        removeAuthMethod(email, "password"),
        removeAuthMethod(email, "email_link"),
      ]);
      expect(removals.filter((result) => result.status === "fulfilled")).toHaveLength(
        1,
      );
      expect(removals.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(await listAuthMethodsByEmail(email)).toHaveLength(1);
      expect((await getAppUserByEmail(email))?.sessionVersion).toBe(versionBefore + 1);
    });

    test("password and email-link sign-in or sign-up finalize and reject replay or expiry", async () => {
      const originalFetch = globalThis.fetch;
      const verificationUrls: string[] = [];

      try {
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input) !== "https://api.resend.com/emails") {
            throw new Error(`Unexpected email integration request: ${String(input)}`);
          }

          const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string };
          const verifyUrl = body.text?.match(/https?:\/\/[^\s]+/)?.[0];
          if (!verifyUrl) throw new Error("Verification email did not contain a URL.");
          verificationUrls.push(verifyUrl);
          return Response.json({ id: `email-${verificationUrls.length}` });
        }) as typeof fetch;

        const email = `signup-${ordinaryPrefix}@example.test`;
        const password = "Verified password integration 42!";
        const signUpRoute = await import("../../app/api/auth/password/sign-up/route");
        const signUpResponse = await signUpRoute.POST(
          new Request("http://localhost:3000/api/auth/password/sign-up", {
            body: JSON.stringify({
              confirmPassword: password,
              email,
              name: "Password Integration",
              password,
              returnTo: "/app?from=password-signup",
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        );
        expect(signUpResponse.status).toBe(202);
        expect(verificationUrls).toHaveLength(1);
        expect((await getAppUserByEmail(email))?.verified).toBeFalse();

        const now = new Date().toISOString();
        await saveWorkspaceAccess({
          adminKeyId: "password-signup-key",
          adminKeyLabel: "workspace-admin",
          adminKeyPrefix: "signup_prefix",
          adminKeyScopes: [],
          adminKeySecret: "password-signup-workspace-secret-at-least-32-characters",
          createdAt: now,
          defaultProjectId: null,
          defaultProjectName: null,
          email,
          firstAppId: null,
          tenantId: "password-signup-tenant",
          tenantName: "Password signup tenant",
          updatedAt: now,
        });

        const verifyRoute = await import("../../app/api/auth/email/verify/route");
        const verifyResponse = await verifyRoute.GET(
          new Request(verificationUrls[0] as string),
        );
        expect(verifyResponse.status).toBe(303);
        expect((await getAppUserByEmail(email))?.verified).toBeTrue();

        const handoffLocation = verifyResponse.headers.get("location");
        const handoffToken = new URL(handoffLocation as string).hash.slice(1);
        const finalizeRoute = await import("../../app/auth/finalize/complete/route");
        const finalizeRequest = () =>
          new Request("http://localhost:3000/auth/finalize/complete", {
            body: new URLSearchParams({ token: handoffToken }),
            method: "POST",
          });
        const finalized = await finalizeRoute.POST(finalizeRequest());
        expect(finalized.status).toBe(303);
        expect(finalized.headers.get("location")).toBe(
          "http://localhost:3000/app?from=password-signup",
        );
        expect(finalized.headers.get("set-cookie") ?? "").toContain("fugue_session=");

        const replayed = await finalizeRoute.POST(finalizeRequest());
        expect(replayed.status).toBe(303);
        expect(replayed.headers.get("location") ?? "").toContain(
          "error=handoff-failed",
        );
        expect(replayed.headers.get("set-cookie") ?? "").not.toContain(
          "fugue_session=",
        );

        const emailStartRoute = await import("../../app/api/auth/email/start/route");
        const emailStart = await emailStartRoute.POST(
          new Request("http://localhost:3000/api/auth/email/start", {
            body: JSON.stringify({
              email,
              mode: "signin",
              returnTo: "/app?from=email-link",
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        );
        expect(emailStart.status).toBe(200);
        expect(verificationUrls).toHaveLength(2);
        const emailVerify = await verifyRoute.GET(
          new Request(verificationUrls[1] as string),
        );
        expect(emailVerify.status).toBe(303);
        expect(
          new URL(emailVerify.headers.get("location") as string).hash,
        ).toBeTruthy();
        const emailHandoffToken = new URL(
          emailVerify.headers.get("location") as string,
        ).hash.slice(1);
        const emailFinalized = await finalizeRoute.POST(
          new Request("http://localhost:3000/auth/finalize/complete", {
            body: new URLSearchParams({ token: emailHandoffToken }),
            method: "POST",
          }),
        );
        expect(emailFinalized.status).toBe(303);
        expect(emailFinalized.headers.get("location")).toBe(
          "http://localhost:3000/app?from=email-link",
        );
        expect(emailFinalized.headers.get("set-cookie") ?? "").toContain(
          "fugue_session=",
        );

        const emailSignup = `email-signup-${ordinaryPrefix}@example.test`;
        const emailSignupStart = await emailStartRoute.POST(
          new Request("http://localhost:3000/api/auth/email/start", {
            body: JSON.stringify({
              email: emailSignup,
              mode: "signup",
              name: "Email Signup Integration",
              returnTo: "/app?from=email-signup",
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        );
        expect(emailSignupStart.status).toBe(200);
        expect(verificationUrls).toHaveLength(3);
        expect(await getAppUserByEmail(emailSignup)).toBeNull();

        await saveWorkspaceAccess({
          adminKeyId: "email-signup-key",
          adminKeyLabel: "workspace-admin",
          adminKeyPrefix: "email_signup_prefix",
          adminKeyScopes: [],
          adminKeySecret: "email-signup-workspace-secret-at-least-32-characters",
          createdAt: now,
          defaultProjectId: null,
          defaultProjectName: null,
          email: emailSignup,
          firstAppId: null,
          tenantId: "email-signup-tenant",
          tenantName: "Email signup tenant",
          updatedAt: now,
        });

        const emailSignupVerify = await verifyRoute.GET(
          new Request(verificationUrls[2] as string),
        );
        expect(emailSignupVerify.status).toBe(303);
        expect((await getAppUserByEmail(emailSignup))?.verified).toBeTrue();
        const emailSignupHandoffToken = new URL(
          emailSignupVerify.headers.get("location") as string,
        ).hash.slice(1);
        const emailSignupFinalized = await finalizeRoute.POST(
          new Request("http://localhost:3000/auth/finalize/complete", {
            body: new URLSearchParams({ token: emailSignupHandoffToken }),
            method: "POST",
          }),
        );
        expect(emailSignupFinalized.status).toBe(303);
        expect(emailSignupFinalized.headers.get("location")).toBe(
          "http://localhost:3000/app?from=email-signup",
        );
        expect(emailSignupFinalized.headers.get("set-cookie") ?? "").toContain(
          "fugue_session=",
        );

        const { signToken } = await import("../../lib/auth/token");
        const expiredToken = signToken(
          {
            type: "email-verify",
            email,
            jti: "expired-email-token",
            mode: "signin",
            origin: "http://localhost:3000",
            returnTo: "/app",
          },
          -1,
        );
        const expired = await verifyRoute.GET(
          new Request(
            `http://localhost:3000/api/auth/email/verify?token=${encodeURIComponent(expiredToken)}`,
          ),
        );
        expect(expired.status).toBe(303);
        expect(expired.headers.get("location") ?? "").toContain("error=invalid-token");
        expect(expired.headers.get("set-cookie") ?? "").not.toContain("fugue_session=");

        const expiredHandoffToken = signToken(
          {
            authMethod: "email_link",
            email,
            jti: "00000000-0000-4000-8000-000000000001",
            name: "Password Integration",
            origin: "http://localhost:3000",
            picture: null,
            provider: "email",
            providerId: null,
            returnTo: "/app?from=expired-handoff",
            sessionVersion: (await getAppUserByEmail(email))?.sessionVersion ?? 1,
            type: "session-handoff",
            verified: true,
          },
          -1,
        );
        const expiredFinalize = await finalizeRoute.POST(
          new Request("http://localhost:3000/auth/finalize/complete", {
            body: new URLSearchParams({ token: expiredHandoffToken }),
            method: "POST",
          }),
        );
        expect(expiredFinalize.status).toBe(303);
        expect(expiredFinalize.headers.get("location") ?? "").toContain(
          "error=handoff-failed",
        );
        expect(expiredFinalize.headers.get("set-cookie") ?? "").not.toContain(
          "fugue_session=",
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("blocked, deleted and demoted users invalidate the previous authorization version", async () => {
      const bootstrapEmail = `bootstrap-${ordinaryPrefix}@example.test`;
      const blockedEmail = `blocked-${ordinaryPrefix}@example.test`;
      const deletedEmail = `deleted-${ordinaryPrefix}@example.test`;
      const demotedEmail = `demoted-${ordinaryPrefix}@example.test`;

      for (const email of [blockedEmail, deletedEmail, demotedEmail]) {
        await ensureAppUserRecord(
          { email, provider: "email", verified: true },
          { markSignedIn: true },
        );
      }

      const blockedBefore = await getAppUserByEmail(blockedEmail);
      const deletedBefore = await getAppUserByEmail(deletedEmail);
      await setAppUserStatus(blockedEmail, "blocked", { actorEmail: bootstrapEmail });
      await setAppUserStatus(deletedEmail, "deleted", { actorEmail: bootstrapEmail });
      expect((await getAppUserByEmail(blockedEmail))?.sessionVersion).toBe(
        (blockedBefore?.sessionVersion ?? 0) + 1,
      );
      expect((await getAppUserByEmail(deletedEmail))?.sessionVersion).toBe(
        (deletedBefore?.sessionVersion ?? 0) + 1,
      );

      await setAppUserAdmin(demotedEmail, true, { actorEmail: bootstrapEmail });
      const adminVersion = (await getAppUserByEmail(demotedEmail))?.sessionVersion ?? 0;
      await setAppUserAdmin(demotedEmail, false, { actorEmail: bootstrapEmail });
      const demoted = await getAppUserByEmail(demotedEmail);
      expect(demoted?.isAdmin).toBeFalse();
      expect(demoted?.sessionVersion).toBe(adminVersion + 1);
    });

    test("OAuth transactions are browser-bound and exactly-once under concurrency", async () => {
      const first = await beginOAuthTransaction({
        flow: "google-signin",
        mode: "signin",
        origin: "http://localhost:3000",
        returnTo: "/app",
      });
      expect(
        await consumeOAuthTransaction({
          expectedFlow: "google-signin",
          nonce: "wrong-browser-nonce",
          stateToken: first.state,
        }),
      ).toBeNull();

      const consumed = await Promise.all([
        consumeOAuthTransaction({
          expectedFlow: "google-signin",
          nonce: first.nonce,
          stateToken: first.state,
        }),
        consumeOAuthTransaction({
          expectedFlow: "google-signin",
          nonce: first.nonce,
          stateToken: first.state,
        }),
      ]);
      expect(consumed.filter(Boolean)).toHaveLength(1);
      expect(
        await consumeOAuthTransaction({
          expectedFlow: "google-signin",
          nonce: first.nonce,
          stateToken: first.state,
        }),
      ).toBeNull();

      const tabs = await Promise.all([
        beginOAuthTransaction({
          flow: "github-signin",
          origin: "http://localhost:3000",
          returnTo: "/app/projects/a",
        }),
        beginOAuthTransaction({
          flow: "github-signin",
          origin: "http://localhost:3000",
          returnTo: "/app/projects/b",
        }),
      ]);
      const tabResults = await Promise.all(
        tabs.map((transaction) =>
          consumeOAuthTransaction({
            expectedFlow: "github-signin",
            nonce: transaction.nonce,
            stateToken: transaction.state,
          }),
        ),
      );
      expect(tabResults.map((result) => result?.returnTo).sort()).toEqual([
        "/app/projects/a",
        "/app/projects/b",
      ]);

      const finalized = await Promise.all([
        finalizeOAuthTransaction(tabs[0]?.id ?? "", tabs[0]?.nonce ?? ""),
        finalizeOAuthTransaction(tabs[0]?.id ?? "", tabs[0]?.nonce ?? ""),
      ]);
      expect(finalized.filter(Boolean)).toHaveLength(1);
    });

    test("Google and GitHub sign-in or sign-up callbacks prove PKCE and finalize browser-bound sessions", async () => {
      const originalFetch = globalThis.fetch;
      const finalizeRoute = await import("../../app/auth/finalize/complete/route");

      try {
        for (const { mode, provider } of [
          { mode: "signin", provider: "google" },
          { mode: "signup", provider: "google" },
          { mode: "signin", provider: "github" },
          { mode: "signup", provider: "github" },
        ] as const) {
          const email = `${provider}-${mode}-success-${ordinaryPrefix}@example.test`;
          const transaction = await beginOAuthTransaction({
            flow: `${provider}-signin`,
            mode,
            origin: "http://localhost:3000",
            returnTo: `/app?provider=${provider}&mode=${mode}`,
          });
          const now = new Date().toISOString();
          await saveWorkspaceAccess({
            adminKeyId: `${provider}-${mode}-key-id`,
            adminKeyLabel: "workspace-admin",
            adminKeyPrefix: `${provider}_${mode}_prefix`,
            adminKeyScopes: [],
            adminKeySecret: `${provider}-${mode}-workspace-secret-at-least-32-characters`,
            createdAt: now,
            defaultProjectId: null,
            defaultProjectName: null,
            email,
            firstAppId: null,
            tenantId: `${provider}-${mode}-tenant-id`,
            tenantName: `${provider} ${mode} tenant`,
            updatedAt: now,
          });

          let observedPkceChallenge = "";
          globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const target = String(input);

            if (target === "https://oauth2.googleapis.com/token") {
              const body = new URLSearchParams(String(init?.body ?? ""));
              observedPkceChallenge = createHash("sha256")
                .update(body.get("code_verifier") ?? "", "ascii")
                .digest("base64url");
              return Response.json({ access_token: "google-access-token" });
            }

            if (target === "https://www.googleapis.com/oauth2/v3/userinfo") {
              return Response.json({
                email,
                email_verified: true,
                name: "Google Integration",
                sub: `google-${mode}-${ordinaryPrefix}`,
              });
            }

            if (target === "https://github.com/login/oauth/access_token") {
              const body = JSON.parse(String(init?.body ?? "{}")) as {
                code_verifier?: string;
              };
              observedPkceChallenge = createHash("sha256")
                .update(body.code_verifier ?? "", "ascii")
                .digest("base64url");
              return Response.json({
                access_token: "github-access-token",
                scope: "read:user,user:email",
              });
            }

            if (target === "https://api.github.com/user") {
              return Response.json(
                {
                  email,
                  id: mode === "signin" ? 42 : 43,
                  login: "integration-user",
                  name: "GitHub Integration",
                },
                { headers: { "x-oauth-scopes": "read:user,user:email" } },
              );
            }

            throw new Error(`Unexpected OAuth integration request: ${target}`);
          }) as typeof fetch;

          const callbackRoute =
            provider === "google"
              ? await import("../../app/api/auth/google/callback/route")
              : await import("../../app/api/auth/github/callback/route");
          const cookie = `fugue_oauth_${transaction.id}=${encodeURIComponent(transaction.nonce)}`;
          const callbackResponse = await callbackRoute.GET(
            new Request(
              `http://localhost:3000/api/auth/${provider}/callback?code=integration-code&state=${encodeURIComponent(transaction.state)}`,
              { headers: { cookie } },
            ),
          );

          expect(callbackResponse.status).toBe(303);
          expect(observedPkceChallenge).toBe(transaction.codeChallenge);
          expect(callbackResponse.headers.get("set-cookie") ?? "").not.toContain(
            "fugue_session=",
          );

          const handoffLocation = callbackResponse.headers.get("location");
          expect(handoffLocation).toBeTruthy();
          const handoffToken = new URL(handoffLocation as string).hash.slice(1);
          expect(handoffToken.length).toBeGreaterThan(100);

          const finalizeResponse = await finalizeRoute.POST(
            new Request("http://localhost:3000/auth/finalize/complete", {
              body: new URLSearchParams({ token: handoffToken }),
              headers: { cookie },
              method: "POST",
            }),
          );
          const setCookie = finalizeResponse.headers.get("set-cookie") ?? "";
          expect(finalizeResponse.status).toBe(303);
          expect(finalizeResponse.headers.get("location")).toBe(
            `http://localhost:3000/app?provider=${provider}&mode=${mode}`,
          );
          expect(setCookie).toContain("fugue_session=");
          expect(setCookie).toContain(`fugue_oauth_${transaction.id}=`);
          expect(setCookie).toContain("Max-Age=0");

          const transactionState = await queryDb<{
            consumed_at: Date | null;
            failed_at: Date | null;
            finalized_at: Date | null;
            mode: string | null;
            pkce_verifier_sealed: string;
          }>(
            `SELECT consumed_at, failed_at, finalized_at, mode, pkce_verifier_sealed
             FROM app_auth_oauth_transactions WHERE id = $1`,
            [transaction.id],
          );
          expect(transactionState.rows[0]?.consumed_at).toBeTruthy();
          expect(transactionState.rows[0]?.finalized_at).toBeTruthy();
          expect(transactionState.rows[0]?.failed_at).toBeNull();
          expect(transactionState.rows[0]?.mode).toBe(mode);
          expect(transactionState.rows[0]?.pkce_verifier_sealed).toBe("");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("OAuth nonce, provider, expiry and PKCE failures clear browser state without issuing a session", async () => {
      const originalFetch = globalThis.fetch;
      const originalWarn = console.warn;
      const oauthEvents: Array<{
        event: string;
        outcome: string;
        provider: string;
        reason: string;
        stage: string;
      }> = [];
      const googleRoute = await import("../../app/api/auth/google/callback/route");
      const githubRoute = await import("../../app/api/auth/github/callback/route");

      function assertRejected(response: Response, transactionId: string) {
        const setCookie = response.headers.get("set-cookie") ?? "";
        expect(response.status).toBe(303);
        expect(setCookie).not.toContain("fugue_session=");
        expect(setCookie).toContain(`fugue_oauth_${transactionId}=`);
        expect(setCookie).toContain("Max-Age=0");
      }

      try {
        console.warn = ((message: unknown, ...details: unknown[]) => {
          if (typeof message === "string") {
            try {
              const parsed = JSON.parse(message) as (typeof oauthEvents)[number];
              if (parsed.event === "fugue_web_oauth_callback") {
                oauthEvents.push(parsed);
                return;
              }
            } catch {
              // Preserve unrelated warning output below.
            }
          }
          originalWarn(message, ...details);
        }) as typeof console.warn;
        globalThis.fetch = (async () => {
          throw new Error("Provider exchange must not run for rejected state.");
        }) as unknown as typeof fetch;

        const missingCookie = await beginOAuthTransaction({
          flow: "google-signin",
          origin: "http://localhost:3000",
          returnTo: "/app",
        });
        assertRejected(
          await googleRoute.GET(
            new Request(
              `http://localhost:3000/api/auth/google/callback?code=x&state=${encodeURIComponent(missingCookie.state)}`,
            ),
          ),
          missingCookie.id,
        );

        const tamperedNonce = await beginOAuthTransaction({
          flow: "github-signin",
          origin: "http://localhost:3000",
          returnTo: "/app",
        });
        assertRejected(
          await githubRoute.GET(
            new Request(
              `http://localhost:3000/api/auth/github/callback?code=x&state=${encodeURIComponent(tamperedNonce.state)}`,
              { headers: { cookie: `fugue_oauth_${tamperedNonce.id}=wrong` } },
            ),
          ),
          tamperedNonce.id,
        );

        const wrongProvider = await beginOAuthTransaction({
          flow: "github-signin",
          origin: "http://localhost:3000",
          returnTo: "/app",
        });
        assertRejected(
          await googleRoute.GET(
            new Request(
              `http://localhost:3000/api/auth/google/callback?code=x&state=${encodeURIComponent(wrongProvider.state)}`,
              {
                headers: {
                  cookie: `fugue_oauth_${wrongProvider.id}=${wrongProvider.nonce}`,
                },
              },
            ),
          ),
          wrongProvider.id,
        );

        for (const failure of ["expired", "missing-pkce"] as const) {
          const transaction = await beginOAuthTransaction({
            flow: "google-signin",
            origin: "http://localhost:3000",
            returnTo: "/app",
          });
          await queryDb(
            failure === "expired"
              ? `UPDATE app_auth_oauth_transactions SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1`
              : `UPDATE app_auth_oauth_transactions SET pkce_verifier_sealed = '' WHERE id = $1`,
            [transaction.id],
          );
          assertRejected(
            await googleRoute.GET(
              new Request(
                `http://localhost:3000/api/auth/google/callback?code=x&state=${encodeURIComponent(transaction.state)}`,
                {
                  headers: {
                    cookie: `fugue_oauth_${transaction.id}=${transaction.nonce}`,
                  },
                },
              ),
            ),
            transaction.id,
          );
          const state = await queryDb<{
            failed_at: Date | null;
            pkce_verifier_sealed: string;
          }>(
            `SELECT failed_at, pkce_verifier_sealed FROM app_auth_oauth_transactions WHERE id = $1`,
            [transaction.id],
          );
          expect(state.rows[0]?.failed_at).toBeTruthy();
          expect(state.rows[0]?.pkce_verifier_sealed).toBe("");
        }

        const mismatchedPkce = await beginOAuthTransaction({
          flow: "google-signin",
          origin: "http://localhost:3000",
          returnTo: "/app",
        });
        await queryDb(
          `UPDATE app_auth_oauth_transactions SET pkce_verifier_sealed = $1 WHERE id = $2`,
          [
            sealText("a-different-pkce-verifier-that-the-provider-will-reject"),
            mismatchedPkce.id,
          ],
        );
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          if (String(input) !== "https://oauth2.googleapis.com/token") {
            throw new Error("Profile fetch must not run after PKCE rejection.");
          }
          const body = new URLSearchParams(String(init?.body ?? ""));
          const challenge = createHash("sha256")
            .update(body.get("code_verifier") ?? "", "ascii")
            .digest("base64url");
          return challenge === mismatchedPkce.codeChallenge
            ? Response.json({ access_token: "unexpected" })
            : Response.json({ error: "invalid_grant" }, { status: 400 });
        }) as typeof fetch;
        assertRejected(
          await googleRoute.GET(
            new Request(
              `http://localhost:3000/api/auth/google/callback?code=x&state=${encodeURIComponent(mismatchedPkce.state)}`,
              {
                headers: {
                  cookie: `fugue_oauth_${mismatchedPkce.id}=${mismatchedPkce.nonce}`,
                },
              },
            ),
          ),
          mismatchedPkce.id,
        );
        const mismatchState = await queryDb<{
          failed_at: Date | null;
          finalized_at: Date | null;
        }>(
          `SELECT failed_at, finalized_at FROM app_auth_oauth_transactions WHERE id = $1`,
          [mismatchedPkce.id],
        );
        expect(mismatchState.rows[0]?.failed_at).toBeTruthy();
        expect(mismatchState.rows[0]?.finalized_at).toBeNull();
        expect(new Set(oauthEvents.map((event) => event.reason))).toEqual(
          new Set([
            "invalid-state",
            "missing-browser-nonce",
            "provider-exchange-failed",
            "state-not-consumable",
          ]),
        );
        expect(
          oauthEvents.every(
            (event) =>
              event.stage === "callback" &&
              event.outcome === "rejected" &&
              (event.provider === "google" || event.provider === "github"),
          ),
        ).toBeTrue();
        expect(
          oauthEvents.every(
            (event) =>
              JSON.stringify(Object.keys(event).sort()) ===
              JSON.stringify(
                ["event", "outcome", "provider", "reason", "stage"].sort(),
              ),
          ),
        ).toBeTrue();
        const serializedEvents = JSON.stringify(oauthEvents);
        for (const sensitiveValue of [
          missingCookie.id,
          missingCookie.nonce,
          missingCookie.state,
          tamperedNonce.id,
          tamperedNonce.nonce,
          tamperedNonce.state,
          wrongProvider.id,
          wrongProvider.nonce,
          wrongProvider.state,
          mismatchedPkce.id,
          mismatchedPkce.nonce,
          mismatchedPkce.state,
        ]) {
          expect(serializedEvents).not.toContain(sensitiveValue);
        }
      } finally {
        globalThis.fetch = originalFetch;
        console.warn = originalWarn;
      }
    });

    test("shared rate-limit rows serialize concurrent abuse and return Retry-After", async () => {
      const request = new Request("http://localhost:3000/api/auth/password/sign-in", {
        method: "POST",
      });
      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          enforceAuthRateLimit(
            request,
            "password-sign-in",
            `rate-${ordinaryPrefix}@example.test`,
          ),
        ),
      );
      const limited = responses.filter((response) => response !== null);
      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited.every((response) => response?.status === 429)).toBeTrue();
      expect(
        limited.every((response) => Number(response?.headers.get("retry-after")) >= 1),
      ).toBeTrue();
    });

    test("completed bootstrap state survives deletion and recreation", async () => {
      const bootstrapEmail = `bootstrap-${ordinaryPrefix}@example.test`;
      process.env.FUGUE_ADMIN_BOOTSTRAP_EMAIL = bootstrapEmail;
      await queryDb("DELETE FROM app_users WHERE email = $1", [bootstrapEmail]);
      const recreated = await ensureAppUserRecord(
        { email: bootstrapEmail, provider: "email", verified: true },
        { markSignedIn: true },
      );
      expect(recreated.isAdmin).toBeFalse();
    });
  },
);
