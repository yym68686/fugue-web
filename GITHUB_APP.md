# GitHub App image notifications

This restores event-driven **external image tracking**, not GitHub source builds.
No application image, scale, registry, or existing polling configuration is changed
by installing the App. A user must explicitly save a repository binding on an
image service's Settings tab. Legacy bindings are inert until reverified and saved.

## Operator setup

Configure the Web process (never the browser) with:

```dotenv
APP_BASE_URL=https://your-fugue-console.example
GITHUB_APP_ID=<numeric App ID>
GITHUB_APP_SLUG=<App slug from github.com/apps/SLUG>
GITHUB_APP_PRIVATE_KEY=<PEM private key; literal \\n is also accepted>
GITHUB_APP_WEBHOOK_SECRET=<strong random webhook secret>
```

The existing PostgreSQL connection, session signing secret, workspace credential
encryption secret, and GitHub OAuth connection must also be configured. Keep all
secrets in the deployment's secret store, not Git. Compose passes through the four
App variables. Do not print PEM keys, tokens, or webhook secrets in diagnostics.

In the GitHub App registration:

- Set Setup URL to `https://your-fugue-console.example/api/github/app/install/callback`.
  Do not enable "Request user authorization (OAuth) during installation"; Fugue
  uses its separate, existing GitHub account connection to verify repository access.
- Set Webhook URL to `https://your-fugue-console.example/api/webhook/github` and
  configure the identical webhook secret. Keep webhook delivery active.
- For workflow notifications grant repository **Actions: read**, **Metadata: read**
  and subscribe to **Workflow run**. Installation removal/suspension and repository
  removal events invalidate the stored verification.
- Optionally grant **Packages: read** and subscribe to **Registry package** for
  GitHub container package notifications.
- Install only on the intended repositories. Existing installations may need to
  approve new permissions. Repository write access is required for the user who
  saves a Fugue binding; a guessed installation ID is not sufficient.

## Binding a service

1. Keep external image tracking enabled on the service's intended mutable image
   reference. Fugue's existing image-sync API resolves and compares digests.
2. Open service Settings → GitHub App image notifications. Connect GitHub if needed,
   install the App on the repository, and return to the service.
3. For Docker Hub or any external registry select **Successful workflow**, specify
   the release branch, and preferably the exact workflow path/name. The workflow
   must finish successfully *after* publishing the tracked image. Failed, PR, fork,
   non-completed, and non-matching branch/workflow runs do not trigger a sync.
4. For GitHub Packages select **GitHub container package** and the exact package
   name. Branch/workflow filters do not apply in this mode.
5. Save the repository binding. Installation alone does not enable deployments.

For a multi-architecture build, `workflow_run` arrives after the **whole workflow**
succeeds. This feature does not split AMD64/ARM64 publishing or make a multiarch
workflow notify early. That requires a separate CI change.

## Delivery and recovery

`POST /api/webhook/github` verifies HMAC-SHA256 against the raw, bounded request
body, then commits matching deliveries/jobs in PostgreSQL before returning 202.
The GitHub delivery ID is deduplicated; conflicting payloads under the same ID are
rejected. No deployment or registry calls run inside the webhook acknowledgement.

The Node Web process starts a bounded dispatcher. A 15-second queue wakeup is a
retry mechanism, not registry polling. Database leases permit multiple replicas
and recover work after process restarts. Each dispatch rechecks the current
binding revision, active user, current GitHub repository write access and App
installation, tenant-scoped workspace key,
service ownership, and paused state. It calls only the existing tenant-scoped
`POST /v1/apps/{id}/image-sync`, carrying the tracked image reference and delivery
ID. Backend reference checks prevent stale bindings from changing another image.

An active-operation 202 is retried rather than incorrectly marked delivered.
Transient failures back off up to 12 attempts; failed jobs are visible and can be
manually retried. A disabled/rebound service cancels stale work. Paused services
are never started by notifications. Digest equality is a successful no-op. A
completed notification means image-sync accepted/resolved the request, **not**
that the resulting rollout is healthy; use normal service operation health/status.

The panel exposes recent delivery IDs, attempts, safe failure categories, operation
IDs and last-sync timestamps. Structured server logs use `github_app_image_sync`
and `github_app_worker` without secrets or webhook payloads. Bounded housekeeping
retains delivery deduplication and finished-job history for at least 30 days and
consumed install states for at least one day. Pending/processing jobs are retained.

## Verification

`npm test`, `npm run typecheck`, `npm run build -- --webpack`.
Optional real-PostgreSQL queue tests run with an **empty disposable database**:

```bash
FUGUE_GITHUB_TEST_DATABASE_URL=postgres://localhost/disposable_test_db npm test
```

Never point this test variable at a product or production database. The integration
test creates and drops its own isolated schema. To validate a live registration,
use GitHub's signed ping first; then inspect a naturally occurring matching build
and its Fugue operation. Do not manufacture a production deploy to test connectivity.
