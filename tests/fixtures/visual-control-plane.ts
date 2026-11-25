import { createServer } from "node:http";
import { ensureDbSchema } from "@/lib/db/schema";
import { queryDb, withDbTransaction } from "@/lib/db/pool";
import { sealText } from "@/lib/security/seal";

if (process.env.DATABASE_URL !== "postgresql://127.0.0.1:55461/fugue_visual" ||
    process.env.FUGUE_VISUAL_FIXTURE !== "1") {
  throw new Error("Use the dedicated local fugue_visual test database.");
}

const scopes = ["app.read", "app.write", "project.read", "project.write", "apikey.read", "apikey.write", "billing.read", "object_store.read", "object_store.write"];
const project = { id: "fixture-project", name: "International production platform 长名称数据库迁移预览", updated_at: "2026-11-25T23:00:00Z" };
const app = { id: "fixture-app", project_id: project.id, tenant_id: "fixture-tenant-0", name: "release-verification-console-worker-with-a-very-long-service-name", status: { phase: "Running" },
  route: { hostname: "example.invalid", public_url: "https://example.invalid" },
  spec: { replicas: 1 }, build_source: { repo_url: "https://example.invalid/a-long-owner/a-long-service", type: "git" }, tech_stack: [{ name: "Next.js" }],
  current_resource_usage: { cpu_millicores: 100, memory_bytes: 129000000, persistent_storage_used_bytes: 11600000000, persistent_storage_capacity_bytes: 20000000000 },
};
const node = { name: "node-abcdefghij-0123456789-production-ipv6", region: "Asia Pacific", roles: ["control-plane", "app-runtime"], status: "Ready", cpu: { usage_percent: 42, request_percent: 60, capacity_millicores: 4000, used_millicores: 1680 }, memory: { usage_percent: 60, request_percent: 72, capacity_bytes: 17000000000, used_bytes: 10200000000 } };
const store = { id: "fixture-storage", project_id: project.id, name: "release-artifacts-and-object-storage", bucket: "fixture-bucket", endpoint: "https://objects.example.invalid", status: "active" };
const billing = (tenant: number) => ({ tenant_id: `fixture-tenant-${tenant}`, status: "active", app_count: 1, managed_cap: { cpu_millicores: 1000, memory_mebibytes: 4096, storage_gibibytes: 20 },
  managed_committed: {}, balance_microcents: 2314099888872, hourly_rate_microcents: 1929000, monthly_estimate_microcents: 231432100, runway_hours: 12000,
  price_book: { currency: "USD", hours_per_month: 730, cpu_microcents_per_millicore_hour: 14, memory_microcents_per_mib_hour: 12, storage_microcents_per_gib_hour: 140 }, events: [],
});
const snapshot = { ...project, app_count: 1, service_count: 0, service_badges: [], resource_usage_snapshot: app.current_resource_usage };
const imageUsage = { projects: [{ project_id: project.id, measurement_status: "unavailable", measurement_reasons: ["no_storage_evidence"], total_size_bytes: 0 }], measurement_status: "unavailable" };
const worktree = { pod: "fixture-app-0123456789-abcde", workspace_root: "/workspace/long-directory-name/fixture-service" };

await ensureDbSchema();
for (let i = 0; i < 2; i++) {
  const email = i === 0 ? "operator-with-a-long-display-identifier@example.invalid" : "member@example.invalid";
  await withDbTransaction(async (client) => {
    await client.query("SET LOCAL fugue.allow_admin_promotion = 'on'");
    await client.query("INSERT INTO app_users(email, name, provider, verified, is_admin) VALUES ($1,$2,'email',TRUE,$3) ON CONFLICT DO NOTHING", [email, i === 0 ? "Visual test administrator" : "Visual test member", i === 0]);
  });
  await queryDb("INSERT INTO app_workspaces(user_email,tenant_id,tenant_name,admin_key_id,admin_key_label,admin_key_secret_sealed,admin_key_scopes) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING", [email,`fixture-tenant-${i}`,"Visual workspace",`fixture-key-${i}`,"Workspace key",sealText(`fixture-backend-${i}`),JSON.stringify(scopes)]);
  await queryDb("INSERT INTO app_api_keys(fugue_key_id,user_email,tenant_id,label,prefix,status,source,scopes,secret_sealed) VALUES($1,$2,$3,$4,'fg_preview','active','managed',$5,$6) ON CONFLICT DO NOTHING", [`fixture-managed-${i}`,email,`fixture-tenant-${i}`,"Deploy automation token with a long name",JSON.stringify(scopes),sealText("fake-visual-secret-not-a-credential")]);
}

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  const tenant = req.headers.authorization?.endsWith("-1") ? 1 : 0;
  let body: unknown;
  res.setHeader("content-type","application/json");
  if (req.method !== "GET") return res.writeHead(405).end('{"error":"Synthetic test data are read-only"}');
  switch (path) {
    case "/v1/auth/context": body = { principal: { scopes, tenant_id: `fixture-tenant-${tenant}`, actor_type: "api_key", actor_id: `fixture-key-${tenant}` } }; break;
    case "/v1/console/gallery": body = { projects: [{ ...project, app_count: 1, service_count: 0, service_badges: [] }] }; break;
    case "/v1/console/projects/snapshot": body = { projects: [snapshot], image_usage: imageUsage }; break;
    case "/v1/console/projects/fixture-project": body = { project, project_id: project.id, project_name: project.name, apps: [app] }; break;
    case "/v1/apps": body = { apps: [app] }; break;
    case "/v1/apps/fixture-app": body = { app }; break;
    case "/v1/apps/fixture-app/domains": body = { domains: [{ hostname: "verify-this-long-domain-for-visual-regression.example.invalid", tls_status: "pending", verification_txt_name: "_fugue.example.invalid", verification_txt_value: "synthetic-txt-value" }] }; break;
    case "/v1/apps/fixture-app/env": body = { env: { DEMO_CREDENTIAL: "fake-example", LONG_CONFIGURATION_NAME: "long-example" } }; break;
    case "/v1/apps/fixture-app/runtime-logs": body = { logs: "Synthetic runtime log: " + "line-without-breaks-".repeat(16), pods: [worktree.pod] }; break;
    case "/v1/apps/fixture-app/build-logs": body = { available: true, logs: "Synthetic build log" }; break;
    case "/v1/apps/fixture-app/filesystem/tree": body = { ...worktree, entries: [{ name: "config.toml", path: "config.toml", kind: "file", size: 28 }] }; break;
    case "/v1/apps/fixture-app/filesystem/file": body = { ...worktree, path: "config.toml", content: "name = \"visual-fixture\"", size: 28, encoding: "utf-8" }; break;
    case "/v1/apps/fixture-app/images": body = { app_id: app.id, registry_configured: true, measurement_status: "unavailable", measurement_reasons: ["no_storage_evidence"], versions: [{ image_ref: "registry.example.invalid/long-owner/long-repository@sha256:" + "abc123".repeat(10), current: true, size_measurement_status: "unavailable", size_measurement_reasons: ["no_storage_evidence"] }] }; break;
    case "/v1/apps/fixture-app/observability/metrics/summary": body = { source: { available: false, reason: "No synthetic metrics for this interval" }, metrics: [] }; break;
    case "/v1/apps/fixture-app/observability/requests": body = { source: { available: true }, requests: [{ method: "GET", route: "/long-audit-route/isolated-browser-fixture", status: 200, request_id: "fixture-request-01", trace_id: "fixture-trace-01", duration_ms: 72 }] }; break;
    case "/v1/cluster/nodes": body = { cluster_nodes: [node] }; break;
    case "/v1/projects/image-usage": body = imageUsage; break;
    case "/v1/projects": body = { projects: [project] }; break;
    case "/v1/runtimes": body = { runtimes: [] }; break;
    case "/v1/object-stores": body = { stores: [store] }; break;
    case "/v1/object-stores/fixture-storage/credentials": body = { credentials: [] }; break;
    case "/v1/admin/storage/jobs": body = { jobs: [] }; break;
    case "/v1/admin/storage": body = { observed_at: "2026-11-25T23:00:00Z", configured: true, account_id: "fixture-account",
      buckets_complete: true, longhorn_complete: false, metrics_status: "partial", billing_status: "unknown", warnings: [],
      buckets: [{ name: "fixture-bucket", source: "configured" }], namespaces: [{
        kind: "object-store", resource_id: store.id, name: store.name, tenant_id: app.tenant_id, project_id: project.id,
        bucket: store.bucket, prefix: "/visual-fixture", status: "active",
      }], longhorn: [],
    }; break;
    case "/v1/billing": body = { billing: billing(tenant) }; break;
    case "/v1/billing/summaries": body = { billings: [billing(0), billing(1)], missing_tenant_ids: [] }; break;
    default: return res.writeHead(404).end(JSON.stringify({ error: `No synthetic data for ${path}` }));
  }
  res.end(JSON.stringify(body));
}).listen(3319, "127.0.0.1", () => console.log("Read-only demo control plane ready"));
