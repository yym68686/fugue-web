export type Tone = "default" | "success" | "warning" | "destructive" | "info";

export type Project = {
  id: string;
  name: string;
  lifecycle: string;
  apps: number;
  services: number;
  runtime: string;
  usage: number;
  tags: string[];
};

export type Service = {
  id: string;
  name: string;
  kind: "app" | "backing";
  phase: string;
  route: string;
  runtime: string;
  usage: number;
};

export const projects: Project[] = [
  {
    id: "pulseboard",
    name: "pulseboard",
    lifecycle: "Running",
    apps: 3,
    services: 4,
    runtime: "shared-us-west",
    usage: 64,
    tags: ["Next.js", "Postgres", "Worker"],
  },
  {
    id: "atlas-api",
    name: "atlas-api",
    lifecycle: "Deploying",
    apps: 2,
    services: 3,
    runtime: "alicehk2",
    usage: 48,
    tags: ["Docker", "Redis"],
  },
  {
    id: "billing-lab",
    name: "billing-lab",
    lifecycle: "Attention",
    apps: 1,
    services: 2,
    runtime: "netcup",
    usage: 82,
    tags: ["Rails", "Postgres"],
  },
];

export const services: Service[] = [
  {
    id: "web",
    name: "web",
    kind: "app",
    phase: "Running",
    route: "https://pulseboard.fugue.dev",
    runtime: "shared-us-west",
    usage: 58,
  },
  {
    id: "worker",
    name: "worker",
    kind: "app",
    phase: "Building",
    route: "internal://worker",
    runtime: "shared-us-west",
    usage: 36,
  },
  {
    id: "postgres",
    name: "postgres",
    kind: "backing",
    phase: "Primary",
    route: "postgres://managed/pulseboard",
    runtime: "shared-us-west",
    usage: 72,
  },
];

export const envRows = [
  { key: "APP_PUBLIC_URL", value: "https://pulseboard.fugue.dev" },
  { key: "DATABASE_URL", value: "••••••••••••••••" },
  { key: "NEXT_PUBLIC_REGION", value: "us-west" },
];

export const logLines = [
  "12:01:03 build image ghcr.io/acme/pulseboard:82c1",
  "12:01:18 install dependencies completed",
  "12:02:09 route table reconciled for web",
  "12:02:41 runtime started on shared-us-west",
  "12:02:44 health check passed on :3000",
];

export const fileTree = [
  { path: "/app/package.json", content: "{\n  \"scripts\": { \"start\": \"next start\" }\n}" },
  { path: "/app/fugue.yaml", content: "services:\n  web:\n    port: 3000\n    route: public" },
  { path: "/data/uploads/.keep", content: "# persistent storage mount" },
];

export const imageVersions = [
  { id: "img-82c1", tag: "ghcr.io/acme/pulseboard:82c1", created: "12 min ago", current: true },
  { id: "img-71aa", tag: "ghcr.io/acme/pulseboard:71aa", created: "2 hours ago", current: false },
  { id: "img-62fd", tag: "ghcr.io/acme/pulseboard:62fd", created: "Yesterday", current: false },
];

export const requests = [
  { id: "req-01", path: "GET /", status: 200, latency: "42 ms" },
  { id: "req-02", path: "POST /api/import", status: 202, latency: "118 ms" },
  { id: "req-03", path: "GET /dashboard", status: 200, latency: "65 ms" },
];

export const servers = [
  { id: "ovhvpsuswest", role: "control-plane", ready: "ready", cpu: 31, memory: 47, disk: 52, workloads: 5 },
  { id: "ovhuseast", role: "runtime", ready: "ready", cpu: 44, memory: 61, disk: 33, workloads: 9 },
  { id: "netcup", role: "runtime+build", ready: "pressure", cpu: 79, memory: 83, disk: 68, workloads: 14 },
  { id: "alicehk2", role: "runtime", ready: "ready", cpu: 28, memory: 39, disk: 25, workloads: 4 },
];

export const docsSections = [
  {
    id: "quickstart",
    title: "CLI quick start",
    body: "Install Fugue, authenticate, and import a service from a repository, image, or local upload.",
    code: "fugue login\nfugue import github yym68686/fugue-demo --port 3000\nfugue app logs web --follow",
  },
  {
    id: "imports",
    title: "Import modes",
    body: "GitHub repository, Docker image, and local upload all create the same project/service graph.",
    code: "fugue import image ghcr.io/acme/web:latest --name web\nfugue import upload ./dist --name static-site",
  },
  {
    id: "topology",
    title: "fugue.yaml topology",
    body: "Topology files describe services, routes, backing services, runtime targets, and persistent mounts.",
    code: "services:\n  web:\n    port: 3000\n    route: public\n  db:\n    type: postgres\n    failover: managed",
  },
  {
    id: "diagnose",
    title: "Inspect and diagnose",
    body: "Use inspect and diagnose to compare configured intent against runtime state.",
    code: "fugue app inspect web\nfugue app diagnose web --runtime shared-us-west",
  },
];
