import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { escapeHtmlAttribute, escapeHtmlText } from "../../lib/auth/html.ts";
import {
  createPkcePair,
  hashOAuthNonce,
  safelyMatchesOAuthNonce,
} from "../../lib/auth/oauth-crypto.ts";
import {
  isSecureRequest,
  readClientIp,
  readRequestOrigin,
} from "../../lib/auth/origin.ts";
import {
  AuthRequestTooLargeError,
  readLimitedRequestText,
} from "../../lib/auth/request.ts";
import { signToken, verifyToken } from "../../lib/auth/token.ts";
import {
  sanitizeExternalHttpUrl,
  validateReturnTo,
} from "../../lib/auth/validation.ts";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

async function readRepositoryFile(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("returnTo accepts serialized same-origin paths", () => {
  const cases = new Map([
    ["/safe", "/safe"],
    ["/app/projects?id=one#activity", "/app/projects?id=one#activity"],
    ["/space%20name", "/space%20name"],
    ["/search?q=100%25", "/search?q=100%25"],
    [undefined, "/app"],
  ]);

  for (const [input, expected] of cases) {
    assert.deepEqual(validateReturnTo(input), {
      accepted: true,
      path: expected,
      reason: null,
    });
  }
});

test("returnTo rejects slash, backslash, control and nested-encoding bypasses", () => {
  const unsafeValues = [
    "//evil.example/path",
    "/\\evil.example/path",
    "/%5cevil.example/path",
    "/%255cevil.example/path",
    "/%2fevil.example/path",
    "/%252fevil.example/path",
    "/safe%0d%0aLocation%3a%20https%3a%2f%2fevil.example",
    "/safe\u0000path",
    "https://evil.example/path",
    "javascript:alert(1)",
    "%25252f%25252fevil.example",
    { pathname: "/app" },
  ];

  for (const value of unsafeValues) {
    const result = validateReturnTo(value);
    assert.equal(result.accepted, false, value);
    assert.equal(result.path, "/app", value);
    assert.ok(result.reason, value);
  }
});

test("canonical auth origin ignores forged forwarded host and proto", () => {
  const previousBaseUrl = process.env.APP_BASE_URL;
  const previousPublicBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;
  const previousNodeEnv = process.env.NODE_ENV;

  process.env.APP_BASE_URL = "https://app.fugue.example";
  delete process.env.NEXT_PUBLIC_APP_BASE_URL;
  process.env.NODE_ENV = "production";

  try {
    const request = new Request("http://internal:3000/api/auth/google/start", {
      headers: {
        host: "evil.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "http",
      },
    });

    assert.equal(readRequestOrigin(request), "https://app.fugue.example");
    assert.equal(isSecureRequest(request), true);

    process.env.APP_BASE_URL = "http://127.0.0.1:3100";
    assert.equal(readRequestOrigin(request), "http://127.0.0.1:3100");
    assert.equal(isSecureRequest(request), false);
  } finally {
    if (previousBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previousBaseUrl;
    if (previousPublicBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_BASE_URL = previousPublicBaseUrl;
    }
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("client IP headers remain untrusted unless proxy trust is explicit", () => {
  const previousTrust = process.env.AUTH_TRUST_PROXY_HEADERS;
  const previousHops = process.env.AUTH_TRUSTED_PROXY_HOPS;
  const request = new Request("https://app.fugue.example", {
    headers: { "x-forwarded-for": "203.0.113.4, 10.0.0.9" },
  });

  try {
    delete process.env.AUTH_TRUST_PROXY_HEADERS;
    assert.equal(readClientIp(request), null);

    process.env.AUTH_TRUST_PROXY_HEADERS = "true";
    process.env.AUTH_TRUSTED_PROXY_HOPS = "2";
    assert.equal(readClientIp(request), "203.0.113.4");
  } finally {
    if (previousTrust === undefined) delete process.env.AUTH_TRUST_PROXY_HEADERS;
    else process.env.AUTH_TRUST_PROXY_HEADERS = previousTrust;
    if (previousHops === undefined) delete process.env.AUTH_TRUSTED_PROXY_HOPS;
    else process.env.AUTH_TRUSTED_PROXY_HOPS = previousHops;
  }
});

test("PKCE uses an S256 verifier/challenge pair and nonce comparison fails closed", () => {
  const { verifier, challenge } = createPkcePair();
  const expectedChallenge = createHash("sha256")
    .update(verifier, "ascii")
    .digest("base64url");

  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(challenge, expectedChallenge);

  const nonceHash = hashOAuthNonce("browser-secret");
  assert.equal(safelyMatchesOAuthNonce("browser-secret", nonceHash), true);
  assert.equal(safelyMatchesOAuthNonce("other-browser", nonceHash), false);
  assert.equal(safelyMatchesOAuthNonce("browser-secret", "short"), false);
});

test("signed auth tokens require exactly three segments and the expected protected header", () => {
  const previousSecret = process.env.AUTH_SESSION_SECRET;
  process.env.AUTH_SESSION_SECRET = "test-only-session-secret-with-enough-entropy";

  try {
    const token = signToken({ type: "test-token", value: "ok" }, 60);
    assert.equal(verifyToken(token)?.value, "ok");
    assert.equal(verifyToken(`${token}.ignored`), null);

    const [, body, signature] = token.split(".");
    const wrongHeader = Buffer.from(
      JSON.stringify({ alg: "none", typ: "FUGUE" }),
    ).toString("base64url");
    assert.equal(verifyToken(`${wrongHeader}.${body}.${signature}`), null);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SESSION_SECRET;
    else process.env.AUTH_SESSION_SECRET = previousSecret;
  }
});

test("email HTML helpers escape both text and attribute injection", () => {
  assert.equal(
    escapeHtmlText('<img src=x onerror="alert(1)"> & hello'),
    '&lt;img src=x onerror="alert(1)"&gt; &amp; hello',
  );
  assert.equal(
    escapeHtmlAttribute('https://example.test/?q=" onmouseover="x&next=`x`'),
    "https://example.test/?q=&quot; onmouseover=&quot;x&amp;next=&#96;x&#96;",
  );
  assert.equal(escapeHtmlText("你好 👋"), "你好 👋");
  assert.equal(sanitizeExternalHttpUrl("javascript:alert(1)"), null);
  assert.equal(
    sanitizeExternalHttpUrl("https://images.example/avatar.png"),
    "https://images.example/avatar.png",
  );
});

test("request body limit rejects streamed bodies without Content-Length", async () => {
  const request = new Request("https://app.fugue.example/api/auth/email/start", {
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("12345"));
        controller.enqueue(new TextEncoder().encode("67890"));
        controller.close();
      },
    }),
    duplex: "half",
    method: "POST",
  });

  await assert.rejects(
    readLimitedRequestText(request, 8),
    (error) => error instanceof AuthRequestTooLargeError,
  );
});

test("OAuth routes require transaction cookies, atomic state consumption and PKCE", async () => {
  const oauthStore = await readRepositoryFile("lib/auth/oauth-transaction.ts");
  const rateLimit = await readRepositoryFile("lib/auth/rate-limit.ts");
  const schema = await readRepositoryFile("lib/db/schema.ts");
  const methods = await readRepositoryFile("lib/auth/methods.ts");
  const callbackFiles = [
    "app/api/auth/google/callback/route.ts",
    "app/api/auth/github/callback/route.ts",
    "app/api/auth/google/link/callback/route.ts",
    "app/api/auth/github/link/callback/route.ts",
    "app/api/auth/github/connect/callback/route.ts",
  ];

  assert.match(oauthStore, /FOR UPDATE/);
  assert.match(oauthStore, /consumed_at = NOW\(\)/);
  assert.match(oauthStore, /safelyMatchesOAuthNonce/);
  assert.match(oauthStore, /pkce_verifier_sealed = ''/);
  assert.match(schema, /app_auth_oauth_transactions/);
  assert.match(schema, /app_auth_rate_limits/);
  assert.doesNotMatch(rateLimit, /new Map/);
  assert.match(methods, /lockAuthMethodOwner/);
  assert.match(methods, /FOR UPDATE/);

  for (const callbackFile of callbackFiles) {
    const source = await readRepositoryFile(callbackFile);
    assert.match(source, /readOAuthTransactionCookie/, callbackFile);
    assert.match(source, /consumeOAuthTransaction/, callbackFile);
    assert.match(source, /pkceVerifier/, callbackFile);
  }
});

test("password sign-up is a bounded, rate-limited verification flow", async () => {
  const route = await readRepositoryFile("app/api/auth/password/sign-up/route.ts");
  const methods = await readRepositoryFile("lib/auth/methods.ts");
  const rateLimit = await readRepositoryFile("lib/auth/rate-limit.ts");
  const panel = await readRepositoryFile("components/auth/auth-panel.tsx");

  assert.match(route, /PASSWORD_SIGN_UP_REQUEST_MAX_BYTES/);
  assert.match(route, /readLimited(?:Json|UrlEncodedForm)/);
  assert.match(route, /enforceAuthRateLimit\(request, "password-sign-up", email\)/);
  assert.match(route, /validatePassword\(password\)/);
  assert.match(route, /hashPassword\(password\)/);
  assert.match(route, /registerPasswordAuthMethod/);
  assert.match(route, /GENERIC_SIGN_UP_MESSAGE/);
  assert.match(route, /type:\s*"email-verify"/);
  assert.match(route, /sendVerificationEmail/);
  assert.doesNotMatch(route, /buildSessionCookie/);

  assert.match(methods, /export async function registerPasswordAuthMethod/);
  assert.match(methods, /withDbTransaction/);
  assert.match(methods, /ON CONFLICT \(email\) DO NOTHING/);
  assert.match(methods, /verified,[\s\S]*FALSE/);
  assert.match(methods, /method:\s*"password"/);
  assert.match(methods, /user\.password\.registered/);
  assert.doesNotMatch(
    methods.match(/export async function registerPasswordAuthMethod[\s\S]*?^}/m)?.[0] ??
      "",
    /maybeBootstrap|is_admin\s*=\s*TRUE/,
  );

  assert.match(rateLimit, /\| "password-sign-up"/);
  assert.match(panel, /\/api\/auth\/password\/\$\{/);
  assert.match(panel, /autoComplete="new-password"/);
  assert.match(panel, /name="confirmPassword"/);
  assert.match(panel, /messages\.passwordsMismatch/);
});

test("password sign-in cannot create a session before email verification", async () => {
  const source = await readRepositoryFile("app/api/auth/password/sign-in/route.ts");

  assert.match(source, /if \(!user\.verified\)/);
  assert.match(source, /AUTH_ERROR_INVALID_CREDENTIALS/);
  assert.ok(
    source.indexOf("if (!user.verified)") < source.indexOf("const sessionUser ="),
    "verification must be checked before the session subject is created",
  );
});
