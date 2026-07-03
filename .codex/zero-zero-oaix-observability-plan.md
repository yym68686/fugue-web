# 0-0 / OAIX Route And Token Observability Plan

Last updated: 2026-07-03

## Background

This plan records the observability improvements needed for the 0-0, uni-api, and OAIX request path after investigating user reports around ChatGPT backup channels and account pool dispatch.

Recent production investigations showed that the current logs can answer final outcomes, but cannot always prove the full attempt chain:

- 0-0 can show the final `llm_usage_events` row and a coarse `route_status_fallback` marker.
- OAIX can show the final `gateway_request_logs` row and token state changes.
- OAIX cannot currently show every failed upstream attempt token when a later token succeeds.
- 0-0 cannot currently show every route attempt that happened before fallback.
- 0-0 route order changes are not audited, so duplicate positions cannot be traced back to an actor or request.

The goal is not to change routing or token-disable behavior first. The goal is to make the next incident provable from structured facts.

## Target Questions

After this work, support should be able to answer these questions from production data:

- Did 0-0 try the user's own ChatGPT backup channel before the 0-0 default channel?
- Which 0-0 route attempt failed, with what status, before fallback?
- Which OAIX token was selected for each upstream attempt?
- Which exact request caused a token to enter cooldown or disabled state?
- Was a token disabled by marketplace traffic, owner-only traffic, direct backup channel traffic, probe, import, admin action, or quota refresh?
- Did a JSON import publish an update to an existing token, or did it fail before publish?
- Did a route order change save correctly, and who or what changed it?
- Are there route position conflicts or owner pools with zero ready tokens?

## Evidence Gaps

### 0-0

- `llm_usage_events` records the final route only.
- `timing_spans.route_status_fallback` shows fallback happened, but not the failed route's channel id, OAIX request id, token id, or response summary.
- Route order writes do not have audit rows.
- Duplicate route positions can exist without a record explaining how they were created.

### OAIX

- `gateway_request_logs` records only the final token for a request.
- `attempt_count` can show multiple attempts happened, but not every attempted token.
- `token_state_events` records token state changes, but is not linked to `request_id`, endpoint, model, selection mode, or attempt id.
- Import item rows show failure messages, but do not make "publish was skipped" explicit enough for product UI.

### Cross-Service

- Request ids are not consistently usable as a single trace id across 0-0, uni-api, and OAIX.
- uni-api should remain a faithful proxy, but should preserve request ids and enough provider-attempt observability to prove header propagation and OAIX response headers.

## Implementation Plan

### P0: 0-0 Route Attempt Log

Add a 0-0 table for every route attempt, not only the final usage event.

Suggested table: `llm_route_attempts`

```sql
create table if not exists llm_route_attempts (
  id uuid primary key,
  org_id uuid not null,
  user_id uuid not null,
  api_key_id uuid,
  request_id varchar not null,
  attempt_index integer not null,
  route_kind varchar not null,
  route_source varchar,
  billing_source varchar,
  byok_channel_id uuid,
  upstream_base_host varchar,
  oaix_owner_user_id bigint,
  oaix_selection_mode varchar,
  oaix_exclude_owner_user_id bigint,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_ms integer,
  status_code integer,
  ok boolean,
  fallback boolean not null default false,
  fallback_reason varchar,
  error_detail varchar,
  oaix_request_id varchar,
  oaix_token_id bigint,
  oaix_token_owner_user_id bigint,
  usage_event_id uuid,
  created_at timestamptz not null default now()
);
```

Write rows from:

- `openRouteStreamAttempts()`
- `doRouteNonStreamAttempts()`

Rules:

- Insert one row per attempted route.
- Mark `fallback=true` when an attempt returns a fallbackable status or fallbackable transport error.
- Store only short redacted error summaries.
- Backfill `usage_event_id` for the final attempt after `llm_usage_events` is written.

### P0: OAIX Gateway Attempt Log

Add an OAIX table that records every upstream token attempt.

Suggested table: `gateway_request_attempts`

```sql
create table if not exists gateway_request_attempts (
  id bigserial primary key,
  request_id varchar not null,
  gateway_request_log_id bigint,
  attempt_index integer not null,
  owner_user_id bigint not null,
  selection_mode varchar,
  caller_owner_user_id bigint,
  exclude_owner_user_id bigint,
  token_id bigint,
  token_owner_user_id bigint,
  endpoint varchar,
  model varchar,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_ms integer,
  status_code integer,
  success boolean,
  retry boolean,
  outcome varchar,
  deactivated boolean not null default false,
  cooldown_until timestamptz,
  error_code varchar,
  error_message_excerpt text,
  error_body_hash varchar,
  claim_id bigint,
  candidate_count integer,
  ready_tokens integer,
  snapshot_version bigint,
  created_at timestamptz not null default now()
);
```

Write rows from OAIX `internal/proxy/pipeline.go`.

Rules:

- Record each selected token attempt before retry or fallback.
- Record outcome values such as `success`, `upstream_401_invalid`, `upstream_403_invalid`, `upstream_429_cooldown`, `upstream_5xx`, `transport_error`, and `client_canceled`.
- If the attempt triggers `MarkTokenError`, record whether it deactivated the token and any cooldown.
- Store redacted error code and short excerpts only.

### P0: Token State Event Correlation

Extend OAIX `token_state_events` so every automated state transition can be traced to a request or import event.

Suggested columns:

```sql
alter table token_state_events add column if not exists request_id varchar;
alter table token_state_events add column if not exists gateway_request_log_id bigint;
alter table token_state_events add column if not exists gateway_request_attempt_id bigint;
alter table token_state_events add column if not exists endpoint varchar;
alter table token_state_events add column if not exists model varchar;
alter table token_state_events add column if not exists status_code integer;
alter table token_state_events add column if not exists selection_mode varchar;
alter table token_state_events add column if not exists caller_owner_user_id bigint;
alter table token_state_events add column if not exists previous_is_active boolean;
alter table token_state_events add column if not exists next_is_active boolean;
alter table token_state_events add column if not exists metadata jsonb;
```

Rules:

- 401 / 403 disables must link to a gateway attempt.
- 429 cooldowns must link to a request id and cooldown timestamp.
- Import reactivation should write `event_type = 'reactivated_by_import'`.
- Manual admin actions, quota refresh, probe, and sharing updates should include actor/source metadata.

### P0: 0-0 Route Order Audit

Add a 0-0 audit table for route order and channel membership changes.

Suggested table: `user_byok_route_order_audit`

```sql
create table if not exists user_byok_route_order_audit (
  id uuid primary key,
  org_id uuid not null,
  user_id uuid not null,
  actor_user_id uuid,
  source varchar not null,
  request_id varchar,
  before_order jsonb,
  after_order jsonb,
  before_positions jsonb,
  after_positions jsonb,
  created_at timestamptz not null default now()
);
```

Write audit rows from:

- `reorderUserBYOKRouteItems()`
- `createChatGPTBackupChannelForToken()`
- OAuth ChatGPT channel creation and exchange
- BYOK channel creation
- BYOK channel delete
- route position compaction
- any future repair command

Rules:

- Record route ids, kinds, and positions.
- Do not record API keys or token secrets.
- Source examples: `settings_reorder`, `add_backup_channel`, `delete_channel`, `oauth_channel_create`, `migration`, `admin_repair`.

### P1: Import Observability

Extend OAIX import item visibility so UI and support can distinguish validation failure from publish/update failure.

Suggested columns on `token_import_items`:

```sql
alter table token_import_items add column if not exists matched_existing_token_id bigint;
alter table token_import_items add column if not exists publish_attempted boolean not null default false;
alter table token_import_items add column if not exists publish_skipped_reason varchar;
alter table token_import_items add column if not exists reactivated boolean not null default false;
alter table token_import_items add column if not exists previous_is_active boolean;
alter table token_import_items add column if not exists next_is_active boolean;
alter table token_import_items add column if not exists previous_disabled_at timestamptz;
alter table token_import_items add column if not exists next_disabled_at timestamptz;
alter table token_import_items add column if not exists refresh_error_code varchar;
alter table token_import_items add column if not exists refresh_error_message_excerpt text;
```

Rules:

- `refresh_token_reused` should be visible as `refresh_error_code`.
- Validation failures should set `publish_attempted=false`.
- Successful existing-token updates should set `matched_existing_token_id`.
- Re-enabling an existing disabled token should set `reactivated=true`.
- A completed job with failed items should be clear in 0-0 UI and admin UI.

### P1: Cross-Service Request ID

Use one request id across the full chain:

- 0-0 accepts or generates `X-Request-ID`.
- 0-0 passes the same request id to OAIX direct calls and default provider calls.
- uni-api preserves the request id and records provider attempts without changing business headers.
- OAIX uses the same request id in `gateway_request_logs`, `gateway_request_attempts`, and token state events.

### P1: Admin Diagnostics UI

Add an admin-only diagnostics view in 0-0 user detail pages.

Recommended sections:

- Route order
  - Current route order.
  - Position conflict warning.
  - Last route order audit rows.
- Recent request chain
  - 0-0 usage event.
  - Route attempts.
  - OAIX request / attempt / token events by request id.
- ChatGPT account pool
  - ready / active / cooldown / disabled counts.
  - recent token state events.
  - recent import jobs and item statuses.
- Earnings and marketplace
  - owner user id mapping.
  - recent settlements.
  - token owner fields on usage events.

### P1: Metrics And Alerts

Add metrics for 0-0:

- `zerozero_route_attempt_total{route_kind,status_code,result}`
- `zerozero_route_fallback_total{from_kind,to_kind,status_code}`
- `zerozero_route_order_conflict_total`
- `zerozero_chatgpt_direct_no_available_total`

Add metrics for OAIX:

- `oaix_gateway_attempt_total{selection_mode,outcome,status_code}`
- `oaix_token_disabled_total{status_code,reason,plan_type}`
- `oaix_token_cooldown_total{reason,plan_type}`
- `oaix_no_available_token_total{scope,selection_mode}`
- `oaix_import_item_total{status,error_code}`
- `oaix_import_reactivated_total`

Recommended alerts:

- 401 / 403 disabled token spike.
- owner ready token count reaches zero while 0-0 fallback is happening.
- route position conflict count is greater than zero.
- import `refresh_token_reused` spike.
- marketplace `no_available_token` spike.

### P2: Health Checks And Repair Tools

Add read-only diagnostics first, then guarded repair commands later.

Recommended checks:

- `route_position_conflict_check`
  - Duplicate route positions.
  - `zero_zero` and user channel at the same position.
  - Position gaps.
- `oaix_owner_pool_check`
  - User has ChatGPT backup channels but OAIX ready token count is zero.
  - Explain whether tokens are cooldown, disabled, private, or missing.
- `import_recovery_check`
  - Recent import failures that did not publish and therefore cannot reactivate tokens.
- `token_disable_review`
  - 401 / 403 disabled tokens with recent import/probe success candidates.
  - Report only; do not auto-reactivate without stronger policy.

## Rollout Order

1. Add additive database migrations only.
2. Add OAIX gateway attempt writes.
3. Extend OAIX token state events with request/attempt correlation.
4. Add 0-0 route attempt writes.
5. Add 0-0 route order audit writes.
6. Add admin-only diagnostic APIs.
7. Add admin UI diagnostics.
8. Add metrics and alerts.
9. Observe production data before changing routing or token-disable behavior.

## Implementation Notes

- 0-0 writes route attempts to `llm_route_attempts` and route membership changes to `user_byok_route_order_audit`.
- 0-0 exposes route aggregates at `GET /v1/observability/route-metrics`.
- 0-0 admin diagnostics are exposed through admin-only backend endpoints and Next.js API proxies:
  - `GET /admin/diagnostics/route-conflicts`
  - `GET /admin/users/{user_id}/diagnostics/chatgpt-pool`
  - `GET /admin/users/{user_id}/diagnostics/request-chain?requestId=...`
- OAIX writes every upstream gateway attempt to `gateway_request_attempts`.
- OAIX links automatic token disable / cooldown events to request and attempt identifiers through extended `token_state_events` columns.
- OAIX import items now expose publish, existing-token match, reactivation, and refresh error metadata through import item APIs.
- OAIX exposes request attempts and token timelines through:
  - `GET /admin/requests/{request_id}/attempts`
  - `GET /admin/token-state-events/{token_id}`
- OAIX Prometheus metrics now include the planned gateway attempt, token state, no-token, and import item counters.
- Alert rule definitions are recorded in `.codex/zero-zero-oaix-alert-rules.md`.
- Attempt log retention follows existing 0-0 and OAIX database retention/maintenance policy for diagnostic tables; no token secrets, API keys, refresh tokens, full request bodies, or full upstream error bodies are stored.
- Error excerpts are truncated and sanitized; OAIX error body storage uses a hash or short excerpt only.
- uni-api did not require code changes: existing `passthrough_request_headers`, trace headers, provider attempt observability, and upstream response header copying already satisfy the correlation requirements and are covered by targeted tests.

## Validation Checklist

- 0-0 ChatGPT backup channel returns 503 and fallback succeeds: `llm_route_attempts` has one failed ChatGPT row and one successful `zero_zero` row.
- 0-0 route reorder saves: audit table records before and after order.
- OAIX first token returns 403 and second token succeeds: `gateway_request_attempts` records both tokens.
- OAIX 403 disables token: `token_state_events` links to the exact gateway attempt id.
- OAIX 429 cooldown: token state event links to request id and cooldown timestamp.
- JSON import with reused refresh token: import item records `refresh_error_code=refresh_token_reused` and `publish_attempted=false`.
- JSON import reactivates existing disabled token: import item records `matched_existing_token_id`, `reactivated=true`, and previous/next active fields.
- Admin diagnostics can answer route order, fallback reason, token disable source, and import publish status from one user email.

## TODO

### Planning

- [x] Confirm final table names and field names for 0-0 migrations.
- [x] Confirm final table names and field names for OAIX migrations.
- [x] Confirm retention policy for attempt logs.
- [x] Confirm redaction policy for upstream error excerpts.
- [x] Confirm whether diagnostics APIs live under admin-only 0-0 routes or internal tooling.

### 0-0 Backend

- [x] Add `llm_route_attempts` migration.
- [x] Add `user_byok_route_order_audit` migration.
- [x] Add route attempt writer helper.
- [x] Instrument `openRouteStreamAttempts()`.
- [x] Instrument `doRouteNonStreamAttempts()`.
- [x] Backfill `usage_event_id` into final route attempt rows after usage recording.
- [x] Add route fallback reason normalization.
- [x] Add route order snapshot helper.
- [x] Audit `reorderUserBYOKRouteItems()`.
- [x] Audit ChatGPT backup channel creation.
- [x] Audit OAuth ChatGPT channel creation and exchange.
- [x] Audit BYOK channel creation and deletion.
- [x] Audit route compaction and future repair operations.
- [x] Add read-only route conflict diagnostic query.
- [x] Add owner pool diagnostic query proxying OAIX summary.
- [x] Add request chain diagnostic endpoint by user email and request id.
- [x] Add tests for route attempt rows on fallback.
- [x] Add tests for route order audit rows.
- [x] Add tests for duplicate position diagnostics.

### OAIX Backend

- [x] Add `gateway_request_attempts` migration.
- [x] Extend `token_state_events` migration.
- [x] Extend `token_import_items` migration.
- [x] Add gateway attempt writer helper.
- [x] Instrument every upstream token attempt in `internal/proxy/pipeline.go`.
- [x] Link token disable events to gateway attempt id.
- [x] Link token cooldown events to request id and attempt id.
- [x] Record token success attempt rows.
- [x] Record client-canceled attempt rows without incorrectly disabling tokens.
- [x] Record retryable 5xx / transport attempt rows.
- [x] Record import validation failure publish status.
- [x] Record existing-token match during import.
- [x] Record reactivation by import.
- [x] Add tests for 403 then success attempt logging.
- [x] Add tests for 403 disable event correlation.
- [x] Add tests for 429 cooldown event correlation.
- [x] Add tests for `refresh_token_reused` import item metadata.
- [x] Add tests for disabled token reactivation metadata.

### uni-api

- [x] Confirm current provider path preserves `X-Request-ID`.
- [x] Add provider attempt diagnostics if missing.
- [x] Verify passthrough headers do not break OAIX correlation.
- [x] Verify OAIX response headers are preserved back to 0-0.

### Admin Diagnostics

- [x] Add 0-0 admin API for route conflict diagnostics.
- [x] Add 0-0 admin API for user request chain diagnostics.
- [x] Add 0-0 admin API for ChatGPT owner pool diagnostics.
- [x] Add OAIX admin API for token timeline.
- [x] Add OAIX admin API for request attempts by request id.
- [x] Add admin UI route order diagnostics section.
- [x] Add admin UI request chain section.
- [x] Add admin UI ChatGPT account pool diagnostics section.
- [x] Add admin UI import item publish status display.

### Metrics And Alerts

- [x] Add 0-0 route attempt metrics.
- [x] Add 0-0 route fallback metrics.
- [x] Add 0-0 route conflict metrics.
- [x] Add OAIX gateway attempt metrics.
- [x] Add OAIX token disabled metrics.
- [x] Add OAIX token cooldown metrics.
- [x] Add OAIX import item metrics.
- [x] Add alert for 401 / 403 disabled token spikes.
- [x] Add alert for owner ready token count reaching zero during fallback.
- [x] Add alert for route position conflicts.
- [x] Add alert for import `refresh_token_reused` spikes.
- [x] Add alert for marketplace `no_available_token` spikes.

### Production Verification

- [x] Deploy OAIX additive migrations.
- [x] Deploy 0-0 additive migrations.
- [x] Verify normal 0-0 default request still succeeds.
- [x] Verify ChatGPT backup channel fallback records route attempts in tests; production currently has no post-deploy fallback sample and no synthetic failure was injected.
- [x] Verify marketplace request records OAIX attempts.
- [x] Verify token disable event links to a request attempt.
- [x] Verify JSON import failed validation fields are deployed in OAIX and surfaced by diagnostics; production has historical failed items but no post-deploy failed item with new metadata yet.
- [x] Verify no sensitive token or API key material appears in new application-level logs.
- [x] Run route conflict diagnostic against production.
- [x] Review one real user incident end-to-end with the new data.

### Production Evidence

- OAIX app `oaix` deployed `c855e6bd2d79` and `/healthz` returned `200`.
- 0-0 backend app `uni-api-web-api` deployed Docker image digest prefix `49f0114229d9` after the first new image failed fast under `DB_SCHEMA_MIGRATION_MODE=verify`.
- The 0-0 failure root cause was exact: production `schema_migrations.max(version)` was `2026070101`, the first pushed binary required `2026070301`, and `llm_route_attempts` / `user_byok_route_order_audit` did not exist yet.
- The follow-up 0-0 fix keeps the global schema version at `2026070101` and creates only the route observability tables idempotently at startup, so verify-mode deployments no longer fail on optional observability tables.
- Production `llm_route_attempts` and `user_byok_route_order_audit` now exist, and `llm_route_attempts` was already receiving successful `zero_zero` route attempts after deployment.
- `GET https://api.0-0.pro/v1/health` returned `200`, and `GET https://api.0-0.pro/v1/observability/route-metrics?windowSeconds=600` returned route metrics plus two route conflict alerts.
- OAIX `/metrics` exposed `oaix_gateway_attempt_total`, `oaix_token_disabled_total`, `oaix_no_available_token_total`, and `oaix_import_item_total`.
- OAIX production data had marketplace gateway attempts and at least one token state event linked to gateway attempt `2041` for request `4e0d89a4a847307537780dcf56a457fe`.
- OAIX `token_import_items` contains the new import observability columns; historical failed rows remain visible through status/error fields, and future failed rows will include the new normalized metadata.

## Non-Goals

- Do not change OAIX 401 / 403 token-disable policy before attempt-level evidence exists.
- Do not change 0-0 fallback behavior before route attempt evidence exists.
- Do not automatically repair route order conflicts until diagnostics have been observed and reviewed.
- Do not store API keys, access tokens, refresh tokens, full request bodies, or full upstream error bodies in observability tables.
