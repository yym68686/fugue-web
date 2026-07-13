# WP-11A — Admin users/apps bounded pagination evidence

Date: 2026-07-12

## Contract and compatibility

- The authoritative control-plane contract is `/Users/yanyuming/Downloads/GitHub/fugue/openapi/openapi.yaml`.
- `GET /v1/apps` now accepts optional `limit`, opaque `cursor`, `sort`, and `phase` parameters in addition to its existing server-side filters.
- Pagination is opt-in. Requests that omit `limit`, `cursor`, and `sort` retain the legacy `{ "apps": [...] }` response; paginated requests also receive `page_info`.
- Every sort ends with app `id` as a deterministic tie-breaker. Cursor scope binds the cursor to the authenticated tenant/project/admin boundary, filters, and sort.
- `fugue-web` synced the contract into `apps/web/openapi/fugue.yaml` and regenerated `apps/web/lib/fugue/openapi.generated.ts`; neither derived file was edited by hand.

## Storage and UI bounds

- Control-plane apps use keyset SQL pagination and hydrate backing services/resource usage only for the returned page.
- Product users use a fixed stable keyset order: admin rank, status rank, last activity, then normalized email.
- Both Postgres schemas include matching pagination indexes. Verified-domain filtering has a partial app-domain index.
- Admin page services do not write paginated results to the legacy unbounded snapshot caches. The browser hook holds only the active page and aborts the active request immediately while a new search is being debounced.
- Admin tables request 50 rows, perform search/status/phase filtering on the server, reset stale cursors, and render only the returned page.
- Startup warmup and route hover warmup no longer trigger the legacy unbounded admin users/apps snapshots.

## Verification

The following gates passed:

```text
fugue: make generate-openapi
fugue: make test
fugue: go test ./internal/store -run 'Test(AppPageWindow|ListAppsPage|PostgresSchemaIncludesBounded|PostgresAppPage)' -count=1
fugue: go test ./internal/api -run 'TestListApps(OptIn|PaginationRejects)' -count=1

fugue-web: bun run contract:check
fugue-web: bun run --cwd apps/web lint
fugue-web: bun run --cwd apps/web test:unit
fugue-web: bun run --cwd apps/web build
```

An isolated PostgreSQL 17 container was used for the integration fixture:

```text
bun run --cwd apps/web test:integration
3 pass, 0 fail
10,037 users, page size 97, 10,357 assertions
```

The integration test verifies:

- every response remains at or below the requested limit;
- all 10,037 users are visited exactly once;
- previous navigation returns the original page;
- status filtering is executed in SQL;
- `EXPLAIN` uses `idx_app_users_admin_status_activity_email`.

Backend tests additionally cover 10,037 apps with repeated timestamps/names across all supported stable sorts, tenant/project restrictions, deleted/deleting exclusion, forward/back navigation, cursor/filter mismatch rejection, and a live Postgres `EXPLAIN` using `idx_fugue_apps_created_id_desc`.
