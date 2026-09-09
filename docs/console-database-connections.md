# Console database connections

The Web process keeps a pool of at most 10 PostgreSQL connections. `FUGUE_WEB_DATABASE_MIN_IDLE` retains up to that many established idle connections (default `3`, valid range `0`–`10`). `FUGUE_WEB_DATABASE_IDLE_TIMEOUT_MS` closes excess idle connections after the configured interval (default `300000`, valid range `0`–`3600000`; `0` disables idle expiry).

The Node server starts a best-effort, read-only warm-up using `SELECT 1` for the minimum retained connections. Database unavailability does not block HTTP startup. Idle-connection failures are logged by error code after the PostgreSQL pool has removed the failed connection, allowing later requests to reconnect after a database switchover.

To restore the earlier idle retention behavior, set `FUGUE_WEB_DATABASE_MIN_IDLE=0` and `FUGUE_WEB_DATABASE_IDLE_TIMEOUT_MS=30000` through normal Fugue application environment configuration. This does not require a code change. The maximum pool size and authorization checks remain the same.

Page dependency logs distinguish `database.acquireMs` from `database.queryMs`. Browser markers distinguish document and client navigation, response wait, response transfer and rendering after the response. They record numerical timings without SQL text, credentials or resource URLs.
