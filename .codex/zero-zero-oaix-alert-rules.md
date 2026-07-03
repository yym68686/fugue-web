# 0-0 / OAIX Route Observability Alert Rules

Last updated: 2026-07-03

These rules are the first alert definitions for the route and token observability work. They are intentionally scoped to facts now emitted by 0-0 and OAIX.

## OAIX Prometheus Rules

```yaml
groups:
  - name: oaix-route-observability
    rules:
      - alert: OAIXTokenDisabledSpike
        expr: sum(increase(oaix_token_disabled_total{status_code=~"401|403"}[10m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: OAIX token 401/403 disable spike
          description: More than 5 tokens were disabled by 401/403 responses in 10 minutes.

      - alert: OAIXMarketplaceNoAvailableTokenSpike
        expr: sum(increase(oaix_no_available_token_total{selection_mode="marketplace"}[10m])) > 20
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: OAIX marketplace no-available-token spike
          description: Marketplace dispatch is repeatedly unable to find a usable token.

      - alert: OAIXRefreshTokenReusedSpike
        expr: sum(increase(oaix_import_item_total{error_code="refresh_token_reused"}[10m])) > 3
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: OAIX import refresh_token_reused spike
          description: Multiple import items failed because refresh tokens were already used.

      - alert: OAIXOwnerReadyTokenZeroDuringFallback
        expr: sum(increase(oaix_no_available_token_total[10m])) > 0 and oaix_token_ready_tokens == 0
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: OAIX has no ready tokens while requests are falling back
          description: No-token events are occurring while the ready token gauge is zero.
```

## 0-0 Route Diagnostics Rules

0-0 exposes the corresponding JSON facts at:

```text
GET /v1/observability/route-metrics?windowSeconds=600
```

Suggested checks:

- `metrics.zerozero_route_order_conflict_total > 0`
- `metrics.zerozero_chatgpt_direct_no_available_total[0].value > 0`
- `alerts[].id == "route_position_conflicts"`
- `alerts[].id == "chatgpt_direct_no_available"`

These checks should page only after repeated failures. A single diagnostic warning should create a support ticket, not trigger automated repair.
