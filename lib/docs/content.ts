import type { Locale } from "@/lib/i18n/core";
import type { PrismCodeLanguage } from "@/lib/ui/prism";

type DocsRouteNote = {
  index: string;
  meta: string;
  title: string;
};

type DocsValueItem = {
  detail?: string;
  label: string;
  value: string;
};

type DocsValueGroup = {
  items: DocsValueItem[];
  title: string;
};

type DocsBulletGroup = {
  items: string[];
  title: string;
};

type DocsTable = {
  columns: string[];
  description?: string;
  rows: string[][];
  title: string;
};

type DocsCodeExample = {
  caption?: string;
  code: string;
  filename?: string;
  language: PrismCodeLanguage;
  title: string;
};

export type DocsSection = {
  bulletGroups?: DocsBulletGroup[];
  codeExamples?: DocsCodeExample[];
  id: string;
  intro: string;
  label: string;
  note?: {
    body: string;
    title: string;
  };
  paragraphs?: string[];
  tables?: DocsTable[];
  title: string;
  valueGroups?: DocsValueGroup[];
};

export type DocsPageContent = {
  copyLabel: string;
  copiedLabel: string;
  ctaSignedIn: string;
  ctaSignedOut: string;
  footerNote: string;
  hero: {
    eyebrow: string;
    highlights: DocsValueItem[];
    highlightsTitle: string;
    intro: string;
    notes: DocsRouteNote[];
    notesIntro: string;
    notesTitle: string;
    title: string;
  };
  mastheadMeta: string;
  metadata: {
    description: string;
    title: string;
  };
  railLabel: string;
  railNotes: string[];
  railTitle: string;
  sections: DocsSection[];
  skipToContent: string;
};

const CLI_INSTALL_SNIPPET = `curl -fsSL https://raw.githubusercontent.com/yym68686/fugue/main/scripts/install_fugue_cli.sh | sh

export FUGUE_API_KEY=<copied-access-key>
fugue deploy .
fugue app overview my-app`;

const CLI_SELF_HOSTED_SNIPPET = `export FUGUE_BASE_URL=https://api.example.com
export FUGUE_WEB_BASE_URL=https://app.example.com
export FUGUE_API_KEY=<copied-access-key>

fugue app ls
fugue version --check-latest
fugue upgrade`;

const IMPORT_SNIPPET = `fugue deploy .

fugue deploy github owner/repo --branch main
fugue deploy github owner/repo --private --repo-token $GITHUB_TOKEN

fugue deploy github owner/repo \\
  --service-env-file gateway=.env.gateway \\
  --service-env-file runtime=.env.runtime

fugue deploy image ghcr.io/example/app:latest --name demo
fugue deploy . --background`;

const FUGUE_MANIFEST_SNIPPET = `version: 1
primary_service: web

template:
  name: Next starter
  slug: next-starter
  description: Ship a ready-made Next.js app.
  source_mode: github
  default_runtime: runtime_edge_hk
  variables:
    - key: NEXT_PUBLIC_SITE_URL
      label: Site URL
      description: Public app URL.
      default: https://example.com
      required: true
    - key: SESSION_SECRET
      label: Session secret
      description: Used to sign cookies.
      generate: password
      secret: true

services:
  web:
    public: true
    port: 3000
    build:
      strategy: dockerfile
      context: .
      dockerfile: Dockerfile
    env:
      API_BASE_URL: http://api:8000/v1
    depends_on:
      - api
    volumes:
      - ./api.yaml:/workspace/api.yaml
    persistent_storage:
      storage_size: 10Gi
      storage_class_name: fast-rwo

  api:
    port: 8000
    build:
      strategy: dockerfile
      context: apps/api
      dockerfile: Dockerfile
    bindings:
      - db

backing_services:
  db:
    type: postgres
    image: postgres:17.6-alpine
    owner_service: api`;

const BILLING_SNIPPET = `fugue admin billing show
fugue admin billing cap --cpu 2000 --memory 4096 --storage 30
fugue admin billing topup 25 --note "manual credit"

fugue project images usage marketing`;

const FAILOVER_SNIPPET = `fugue app continuity audit
fugue app continuity audit my-app

fugue app failover policy set my-app --app-to runtime-b --db-to runtime-c
fugue app failover run my-app --to runtime-b`;

const DIAGNOSE_SNIPPET = `fugue template inspect github owner/repo
fugue deploy inspect github owner/repo

fugue app logs pods my-app
fugue app logs query my-app --table gateway_request_logs --since 1h --match status=500
fugue app request my-app GET /admin/requests --header-from-env X-Service-Key=SERVICE_KEY

fugue app fs ls my-app / --source live
fugue runtime doctor shared
fugue api request GET /v1/apps
fugue diagnose timing -- app overview my-app`;

const EN_CONTENT: DocsPageContent = {
  copyLabel: "Copy",
  copiedLabel: "Copied",
  ctaSignedIn: "Open app",
  ctaSignedOut: "Get started",
  footerNote:
    "Trust the current CLI behavior and the OpenAPI contract when an older snippet, README fragment, or screenshot disagrees.",
  hero: {
    eyebrow: "CLI, import, billing, and route handoff",
    highlights: [
      {
        detail:
          "Web local upload uses the multipart upload endpoint; CLI local deploy creates the archive for you.",
        label: "Accepted upload archives",
        value: ".zip · .tgz · .tar.gz",
      },
      {
        detail:
          "This is the current default free managed envelope before paid managed capacity starts.",
        label: "Free managed cap",
        value: "500m CPU · 512 MiB · 5 GiB",
      },
      {
        detail:
          "The default price book is calibrated so this managed envelope lands near four dollars per month.",
        label: "Calibrated reference",
        value: "2 vCPU · 4 GiB · 30 GiB ≈ $4 / month",
      },
    ],
    highlightsTitle: "Numbers worth remembering",
    intro:
      "Fugue is route-first: start on a shared managed runtime, keep the public route stable, and move the same app onto your own machine later. This page focuses on the parts that are easiest to misread from code alone: CLI defaults, import boundaries, `fugue.yaml`, billing activation, and the line between stateless migrate and managed failover.",
    notes: [
      {
        index: "01",
        meta: "Omit `--runtime` and Fugue targets the shared managed runtime.",
        title: "CLI default runtime is shared managed.",
      },
      {
        index: "02",
        meta:
          "`persistent_storage_seed_files` only works when topology detection stays fully automatic.",
        title: "Seed-file overrides are topology-preserving only.",
      },
      {
        index: "03",
        meta:
          "`migrate` stays stateless. Managed PostgreSQL or persistent workspaces push you to failover instead.",
        title: "Stateful handoff is not the same as migrate.",
      },
    ],
    notesIntro:
      "These are the edges users usually trip over on the first real deploy.",
    notesTitle: "Read this before the first import",
    title: "Operate Fugue without guessing what the route, runtime, or bill will do next.",
  },
  mastheadMeta: "Docs / CLI / Billing",
  metadata: {
    description:
      "Fugue docs for CLI workflows, import modes, billing rules, fugue.yaml topology, and runtime handoff boundaries.",
    title: "Fugue Docs",
  },
  railLabel: "Section navigation",
  railNotes: [
    "Use tenant-scoped API keys for normal deploys. Keep platform-admin or bootstrap keys for admin-only work.",
    "Inspect a GitHub repo or local archive before importing it when you do not fully trust the topology.",
    "Billing can activate from retained managed image inventory even when app traffic looks quiet.",
    "Use `fugue app continuity audit` before promising a stateful app can move with one click.",
  ],
  railTitle: "Especially easy to miss",
  sections: [
    {
      codeExamples: [
        {
          caption:
            "Install the released CLI, export one access key, and the first deploy can happen from the current directory.",
          code: CLI_INSTALL_SNIPPET,
          filename: "quickstart.sh",
          language: "bash",
          title: "Released CLI quick start",
        },
        {
          caption:
            "Self-hosted control planes also need API and web base URLs when you use admin snapshots or `web diagnose` commands.",
          code: CLI_SELF_HOSTED_SNIPPET,
          filename: "self-hosted.sh",
          language: "bash",
          title: "Self-hosted shell environment",
        },
      ],
      id: "cli",
      intro:
        "The CLI is the main operator interface. It covers deploy, import, inspect, runtime, failover, and raw HTTP diagnostics without dropping into `kubectl`.",
      label: "CLI",
      note: {
        body:
          "Normal text-mode commands can remind you that a newer GitHub Release exists. Use `fugue upgrade` to self-update, or set `FUGUE_SKIP_UPDATE_CHECK=1` when you need a quiet shell.",
        title: "Upgrade behavior",
      },
      paragraphs: [
        "For normal deploys, one tenant-scoped access key is enough. Reserve platform-admin or bootstrap keys for `fugue admin ...`, cross-tenant inspection, or product-layer debugging.",
        "For self-hosted control planes, set both `FUGUE_BASE_URL` and `FUGUE_WEB_BASE_URL`. The first points CLI HTTP requests at the API, the second is needed when commands read `fugue-web` snapshot routes.",
        "Secrets are intentionally redacted from `fugue app overview` and `fugue operation show` JSON output. Only add `--show-secrets` when you explicitly need raw values during debugging.",
      ],
      tables: [
        {
          columns: ["Goal", "Command", "Why it matters"],
          rows: [
            [
              "Deploy current source",
              "`fugue deploy .`",
              "Uploads local source as an archive and queues an import without inventing extra scaffolding.",
            ],
            [
              "Inspect full app context",
              "`fugue app overview my-app`",
              "Shows domains, bindings, image inventory, operations, and rollout context in one snapshot.",
            ],
            [
              "Tail runtime logs",
              "`fugue app logs runtime my-app --follow`",
              "Follows pod logs without leaving the CLI.",
            ],
            [
              "Query log-style tables",
              "`fugue app logs query my-app --table gateway_request_logs --since 1h --match status=500`",
              "Useful when the useful data lives in the app database instead of stdout.",
            ],
            [
              "Call internal HTTP safely",
              "`fugue app request my-app GET /admin/requests --header-from-env X-Service-Key=SERVICE_KEY`",
              "Injects auth headers from app env so you do not paste service secrets into the shell.",
            ],
            [
              "Check and apply updates",
              "`fugue version --check-latest` / `fugue upgrade`",
              "Released binaries can self-upgrade in place.",
            ],
          ],
          title: "High-signal commands",
        },
      ],
      title: "CLI quick start and operator defaults",
      valueGroups: [
        {
          items: [
            {
              detail: "Required for normal deploys and tenant-scoped operations.",
              label: "FUGUE_API_KEY",
              value: "Current access key",
            },
            {
              detail: "Set this on self-hosted control planes so CLI requests hit the right API origin.",
              label: "FUGUE_BASE_URL",
              value: "Self-hosted API base URL",
            },
            {
              detail: "Needed by admin snapshot and `fugue web diagnose` commands that talk to `fugue-web` routes.",
              label: "FUGUE_WEB_BASE_URL",
              value: "Self-hosted web base URL",
            },
            {
              detail: "Suppresses the release-upgrade reminder in the current shell session.",
              label: "FUGUE_SKIP_UPDATE_CHECK",
              value: "Optional quiet mode",
            },
          ],
          title: "Shell environment",
        },
      ],
    },
    {
      bulletGroups: [
        {
          items: [
            "GitHub imports support public and private repositories, automatic build detection (`auto`, `static-site`, `dockerfile`, `buildpacks`, `nixpacks`), and service-specific `.env` overrides with `--service-env-file <service>=<path>`.",
            "Local source on the CLI is archived automatically. In the web product layer, local upload is post-sign-in and the JSON create-and-import route deliberately rejects `local-upload`; that path must use the multipart upload endpoint.",
            "Topology-preserving seed-file overrides only work when the importer can keep build detection fully automatic. If you set `source_dir`, `dockerfile_path`, or `build_context_dir`, Fugue rejects `persistent_storage_seed_files`.",
            "When `network_mode=background`, Fugue clears service ports and public routes. When `network_mode=internal`, the service port remains, but the public route stays empty.",
          ],
          title: "Import guardrails",
        },
        {
          items: [
            "`--runtime` defaults to the shared managed runtime when omitted.",
            "`--port` or `--service-port` only matters for public or internal services.",
            "`--command` becomes `sh -lc <command>` on the queued app spec and queued operation.",
            "`--storage-size`, `--mount`, and `--mount-file` define persistent workspace state that later changes how `migrate` and failover behave.",
            "`--managed-postgres` and the `--postgres-*` flags attach app-owned managed PostgreSQL from the start instead of treating it as an afterthought.",
          ],
          title: "Flags that change behavior materially",
        },
      ],
      codeExamples: [
        {
          caption:
            "These are the main import paths in active use today. GitHub and local source can expand topology-aware imports when `fugue.yaml` or Compose files are present.",
          code: IMPORT_SNIPPET,
          filename: "imports.sh",
          language: "bash",
          title: "GitHub, image, and local deploy entrypoints",
        },
      ],
      id: "imports",
      intro:
        "Fugue supports three import surfaces today: local source, GitHub repositories, and image references. GitHub and local uploads can also fan out a topology-aware manifest into multiple apps and operations.",
      label: "Imports",
      paragraphs: [
        "GitHub import is no longer limited to public static sites. The current importer supports public and private repos, tracked repository sync, and stack-aware imports from either `fugue.yaml` or Compose.",
        "Image imports stay the thinnest path: point Fugue at an image reference, optionally name the app, and skip build detection entirely.",
        "If a local archive name implies the app name clearly, upload import can derive it automatically. Accepted archive formats are `.zip`, `.tgz`, and `.tar.gz`.",
      ],
      tables: [
        {
          columns: ["Path", "Best for", "Key parameters", "Watch out for"],
          rows: [
            [
              "Local source",
              "`fugue deploy .` or multipart upload from the web app",
              "`--name`, `--build`, `--command`, persistent-storage flags",
              "Web local upload is multipart-only and happens after sign-in.",
            ],
            [
              "GitHub repository",
              "`fugue deploy github owner/repo`",
              "`--branch`, `--private`, `--repo-token`, `--service-env-file`",
              "Private repos need explicit repo auth unless the workspace already has GitHub access wired.",
            ],
            [
              "Container image",
              "`fugue deploy image ghcr.io/example/app:latest`",
              "`--name`, `--runtime`, `--replicas`, `--command`",
              "No build detection runs here, so Dockerfile/source-dir flags are irrelevant.",
            ],
          ],
          title: "Import paths",
        },
        {
          columns: ["Network mode", "Route behavior", "Port behavior", "Typical use"],
          rows: [
            [
              "Public",
              "Public route is created",
              "Service port is exposed",
              "Default HTTP app path",
            ],
            [
              "Internal",
              "No public route",
              "Internal service remains addressable",
              "Service-to-service traffic only",
            ],
            [
              "Background",
              "No public route",
              "Service ports are cleared",
              "Workers, schedulers, queue consumers",
            ],
          ],
          title: "Network modes",
        },
      ],
      title: "Import paths, flags, and topology guardrails",
    },
    {
      bulletGroups: [
        {
          items: [
            "If more than one service is marked public, set `primary_service` explicitly. Fugue rejects ambiguous multi-public topologies.",
            "If exactly one service is public, Fugue can infer `primary_service` for you.",
            "Missing local files referenced from `volumes` become editable `persistent_storage_seed_files`, which is how the importer surfaces required file mounts before the first deploy.",
            "`persistent_storage.storage_size` and `storage_class_name` merge with mounts inferred from volumes instead of replacing them.",
            "`template.variables` can mark values as `required`, `secret`, and `generate=password`, which is useful when the repo is intended to behave like a reusable starter.",
          ],
          title: "Rules Fugue enforces",
        },
      ],
      codeExamples: [
        {
          caption:
            "This shape reflects what the current importer and template inspector actually understand today.",
          code: FUGUE_MANIFEST_SNIPPET,
          filename: "fugue.yaml",
          language: "yaml",
          title: "Annotated `fugue.yaml` example",
        },
      ],
      id: "manifest",
      intro:
        "`fugue.yaml` is the clearest way to tell Fugue about services, dependencies, bindings, template metadata, and backing services without relying on inference alone.",
      label: "fugue.yaml",
      note: {
        body:
          "Run `fugue template inspect github owner/repo` or `fugue deploy inspect github owner/repo` before importing a repository you did not author yourself. The inspect path shows `primary_service`, inferred warnings, template metadata, and any editable seed files.",
        title: "Inspect before you import",
      },
      paragraphs: [
        "Compose import is still supported, but `fugue.yaml` gives you a better place to name the primary service, declare reusable template variables, and describe backing-service ownership directly.",
        "The importer treats app services, managed Postgres declarations, backing services, and bindings as one topology. That is why `fugue.yaml` matters for both deploy correctness and later failover behavior.",
      ],
      tables: [
        {
          columns: ["Root field", "Meaning", "Current behavior"],
          rows: [
            [
              "`version`",
              "Manifest schema version",
              "Current examples use `version: 1`.",
            ],
            [
              "`primary_service`",
              "Public entrypoint for the topology",
              "Required when more than one service is public; otherwise Fugue can infer it if only one public service exists.",
            ],
            [
              "`template`",
              "Starter metadata",
              "Supports template name, slug, docs/demo URLs, default runtime, and variable definitions.",
            ],
            [
              "`services`",
              "Deployable app and managed service topology",
              "Used to derive app imports, compose dependencies, bindings, and seed files.",
            ],
            [
              "`backing_services`",
              "Shared attached services like Postgres or Redis",
              "Useful when you want explicit ownership and bindings instead of raw env strings.",
            ],
          ],
          title: "Top-level keys",
        },
        {
          columns: ["Service field", "Scope", "What it influences"],
          rows: [
            [
              "`public` / `port`",
              "Per service",
              "Controls public-route eligibility and the internal/public port map.",
            ],
            [
              "`build.strategy`, `build.context`, `build.dockerfile`",
              "Per service",
              "Pins build detection and file paths when auto detection is not enough.",
            ],
            [
              "`env` / `environment`",
              "Per service",
              "Static environment baked into the imported service spec.",
            ],
            [
              "`depends_on`",
              "Per service",
              "Feeds controller-side dependency ordering for topology deploys.",
            ],
            [
              "`bindings`",
              "Per service",
              "Connects app services to named backing services.",
            ],
            [
              "`volumes` and `persistent_storage`",
              "Per service",
              "Drive persistent mount imports, storage class/size, and editable seed-file prompts.",
            ],
          ],
          title: "Service-level fields",
        },
      ],
      title: "`fugue.yaml` topology rules and template metadata",
    },
    {
      bulletGroups: [
        {
          items: [
            "Billing stays inactive until managed capacity, retained managed image inventory, or paid public runtime usage becomes active.",
            "Once billing is active for managed capacity, Fugue meters the saved managed envelope hourly from your balance, not just the latest instantaneous pod reading.",
            "A consumer deploying onto a paid public runtime is billed hourly, while the runtime owner receives the matching credit event.",
            "Your own attached servers stay free unless you publish them for other tenants as paid public runtimes.",
            "The self-serve web top-up flow currently accepts whole USD amounts from 5 to 5000.",
          ],
          title: "What users usually underestimate",
        },
      ],
      codeExamples: [
        {
          caption:
            "These are the current high-value billing commands on the CLI side.",
          code: BILLING_SNIPPET,
          filename: "billing.sh",
          language: "bash",
          title: "Billing inspection and adjustment commands",
        },
      ],
      id: "billing",
      intro:
        "Billing is envelope-based for managed capacity and event-based for paid public runtimes. The important distinction is that billing activation is broader than “the app is currently handling traffic.”",
      label: "Billing",
      note: {
        body:
          "The current price book is calibrated so a managed envelope of 2 vCPU, 4 GiB memory, and 30 GiB storage lands near four US dollars per month. That is a calibration target baked into the core billing model, not marketing copy.",
        title: "Price-book calibration",
      },
      paragraphs: [
        "Live usage and committed billing are different views. The billing API can skip live managed-usage aggregation and return committed billing data only, which is useful when you care about the saved envelope and current billable posture rather than a live probe.",
        "Managed image inventory matters. Retained managed images contribute to billing activation because managed storage is part of the envelope, even if the app itself is otherwise quiet.",
      ],
      tables: [
        {
          columns: ["Status", "Meaning", "Typical next action"],
          rows: [
            [
              "Inactive",
              "No managed resource, retained managed image inventory, or paid public runtime usage is currently billable.",
              "No action needed unless you are expecting managed capacity to be active.",
            ],
            [
              "Active",
              "Managed envelope or paid public runtime usage is deducting balance hourly.",
              "Check envelope size, current usage, and image inventory if the rate looks surprising.",
            ],
            [
              "Restricted",
              "Balance is depleted while there is still billable managed/public runtime activity.",
              "Top up before increasing capacity or deploying onto paid public servers.",
            ],
            [
              "Over cap",
              "Current live managed capacity is above the saved managed envelope.",
              "Save a higher cap before adding more managed capacity.",
            ],
          ],
          title: "Billing status meanings",
        },
      ],
      title: "Billing activation, defaults, and why image inventory matters",
      valueGroups: [
        {
          items: [
            {
              detail: "Current default free managed envelope per tenant.",
              label: "Free managed cap",
              value: "500m CPU · 512 MiB · 5 GiB",
            },
            {
              detail: "Default managed app resources before you override them.",
              label: "Default managed app",
              value: "250m CPU · 512 MiB · 0 GiB extra storage",
            },
            {
              detail: "Default app-owned managed Postgres footprint.",
              label: "Default managed Postgres",
              value: "500m CPU · 1024 MiB · 1 GiB storage",
            },
            {
              detail: "Workspace storage is billable storage when enabled.",
              label: "Default managed workspace",
              value: "10 GiB storage",
            },
          ],
          title: "Default resource baselines",
        },
      ],
    },
    {
      bulletGroups: [
        {
          items: [
            "`ready`: no hard stateful blocker is attached and stateless posture looks reasonable.",
            "`caution`: Fugue does not see a hard blocker, but replicas or runtime posture still need work.",
            "`blocked`: stateless migration is intentionally blocked because managed backing services or persistent workspace state are still attached.",
          ],
          title: "Audit states",
        },
      ],
      codeExamples: [
        {
          caption:
            "Audit first, then configure failover targets, then run failover explicitly when the topology is ready.",
          code: FAILOVER_SNIPPET,
          filename: "continuity.sh",
          language: "bash",
          title: "Continuity audit and failover commands",
        },
      ],
      id: "continuity",
      intro:
        "Fugue intentionally splits stateless migrate from managed failover. Users usually confuse those two paths when a project graduates from shared runtime to attached runtime or needs stateful recovery planning.",
      label: "Continuity",
      note: {
        body:
          "The current managed failover implementation is strongest when the control plane coordinates both runtimes and their storage operators from the same Kubernetes control plane. Cross-cluster database bootstrap, promotion, and end-to-end recovery validation are not fully generic yet.",
        title: "Current boundary",
      },
      paragraphs: [
        "`fugue app move` and `/v1/apps/{id}/migrate` remain the stateless handoff path. They are intentionally blocked for apps that still own Fugue-managed PostgreSQL or persistent workspace state.",
        "Managed failover is controller-orchestrated. It can fence the app, wait for final workspace sync, switch runtimes, and restore replicas when failover targets have been declared.",
      ],
      tables: [
        {
          columns: ["Path", "Use when", "Hard boundary"],
          rows: [
            [
              "Migrate",
              "The app can move runtimes without managed state attached.",
              "Blocked for managed PostgreSQL and persistent workspaces.",
            ],
            [
              "Failover",
              "You need controller-orchestrated runtime switch and state-aware recovery.",
              "Needs declared failover targets and is strongest in same-control-plane environments.",
            ],
          ],
          title: "Migrate vs failover",
        },
      ],
      title: "Stateless migrate versus managed failover",
    },
    {
      bulletGroups: [
        {
          items: [
            "`fugue app fs` can browse either persistent storage roots or the live container filesystem; choose `--source persistent` or `--source live` deliberately.",
            "`fugue app request --header-from-env` is safer than pasting service secrets into your terminal history.",
            "`fugue runtime doctor shared` folds location-specific managed-shared runtime IDs into the shared view, so the output maps to real backing nodes during debugging.",
            "The control plane publishes `/openapi.yaml`, `/openapi.json`, and `/docs`; that contract is the HTTP source of truth.",
          ],
          title: "High-value details",
        },
      ],
      codeExamples: [
        {
          caption:
            "Inspect before import, then use route, logs, filesystem, runtime, and raw HTTP diagnostics without SSH.",
          code: DIAGNOSE_SNIPPET,
          filename: "diagnose.sh",
          language: "bash",
          title: "Inspection and troubleshooting workflow",
        },
      ],
      id: "diagnose",
      intro:
        "The shortest path to the right answer is usually an inspect or diagnose command, not an SSH session. Fugue already exposes topology, route, log, runtime, and HTTP timing probes directly in the CLI.",
      label: "Diagnose",
      paragraphs: [
        "Use template inspection before importing unfamiliar repositories. That path shows `primary_service`, warnings, template metadata, and any editable persistent seed files without mutating anything.",
        "Use `fugue api request` and `fugue diagnose timing` when you need to prove whether a problem is contract shape, control-plane latency, or an app-level behavior mismatch.",
      ],
      tables: [
        {
          columns: ["Command", "Best use", "Why it beats guessing"],
          rows: [
            [
              "`fugue template inspect github owner/repo`",
              "Check a repo before import",
              "Shows topology, template metadata, warnings, and seed files before the first mutation.",
            ],
            [
              "`fugue app overview my-app`",
              "Read current app posture",
              "Pulls route, domains, bindings, operations, images, and rollout context together.",
            ],
            [
              "`fugue app logs pods my-app`",
              "See current and recent pod groups",
              "Useful after rollouts when the current runtime log tail no longer explains what changed.",
            ],
            [
              "`fugue app logs query ...`",
              "Interrogate business-log tables",
              "Avoids writing raw SQL every time a request-log table is the real source of truth.",
            ],
            [
              "`fugue runtime doctor shared`",
              "Inspect runtime health and attachment",
              "Checks status, endpoint, recent heartbeat, and matching nodes in one view.",
            ],
            [
              "`fugue api request GET /v1/apps`",
              "Raw control-plane API debugging",
              "Shows status, headers, body, server-timing, and transport timings directly.",
            ],
            [
              "`fugue diagnose timing -- app overview my-app`",
              "Latency attribution",
              "Reports DNS, connect, TLS, TTFB, and total timing per HTTP request inside a normal CLI command.",
            ],
          ],
          title: "Debugging shortcuts",
        },
      ],
      title: "Inspect, diagnose, and trust the contract",
    },
  ],
  skipToContent: "Skip to content",
};

const ZH_CN_CONTENT: DocsPageContent = {
  copyLabel: "复制",
  copiedLabel: "已复制",
  ctaSignedIn: "打开应用",
  ctaSignedOut: "开始使用",
  footerNote:
    "当旧截图、旧 README 片段或临时示例与当前行为不一致时，以当前 CLI 行为和 OpenAPI 契约为准。",
  hero: {
    eyebrow: "CLI、导入、计费与路由切换",
    highlights: [
      {
        detail:
          "Web 里的本地上传走 multipart 上传接口；CLI 的本地部署会自动帮你打包当前目录。",
        label: "支持的上传归档",
        value: ".zip · .tgz · .tar.gz",
      },
      {
        detail: "这是当前默认的免费托管额度，超过后才开始进入付费托管容量。",
        label: "免费托管上限",
        value: "500m CPU · 512 MiB · 5 GiB",
      },
      {
        detail:
          "当前默认 price book 的校准目标，是让这组托管资源大约落在每月 4 美元附近。",
        label: "校准参考值",
        value: "2 vCPU · 4 GiB · 30 GiB ≈ $4 / 月",
      },
    ],
    highlightsTitle: "需要记住的几个数字",
    intro:
      "Fugue 的核心不是“先选机器”，而是“先把 route 建对”。你可以先跑在共享托管 runtime 上，再把同一个应用迁到自己的机器上，同时保留公开路由和操作模型。这份文档重点写那些最容易从代码里看错的地方：CLI 默认值、导入边界、`fugue.yaml` 规则、计费何时真正开始，以及 stateless migrate 和 managed failover 的分界线。",
    notes: [
      {
        index: "01",
        meta: "省略 `--runtime` 时，Fugue 默认落到 shared managed runtime。",
        title: "CLI 默认 runtime 是共享托管。",
      },
      {
        index: "02",
        meta:
          "`persistent_storage_seed_files` 只有在拓扑识别完全保持自动模式时才可用。",
        title: "seed file 覆盖只能用于保拓扑导入。",
      },
      {
        index: "03",
        meta:
          "`migrate` 依然只适合无状态场景；managed PostgreSQL 或持久化 workspace 会把你推到 failover 路径。",
        title: "有状态切换和 migrate 不是一回事。",
      },
    ],
    notesIntro: "这几条是第一次做真实导入时最容易踩到的边界。",
    notesTitle: "第一次导入前先看这里",
    title: "别靠猜测操作 Fugue，先把 route、runtime 和计费边界看清楚。",
  },
  mastheadMeta: "文档 / CLI / 计费",
  metadata: {
    description:
      "Fugue 文档页，覆盖 CLI、导入方式、计费规则、fugue.yaml 拓扑规则与 runtime handoff 边界。",
    title: "Fugue 文档",
  },
  railLabel: "章节导航",
  railNotes: [
    "日常部署优先用 tenant 级 API key；平台级或 bootstrap key 只留给 admin 场景。",
    "导入你不完全信任的仓库前，先做 inspect，确认 primary service、warning 和 seed file。",
    "即使应用流量看起来不大，保留的 managed image inventory 也可能让计费保持激活。",
    "在承诺“这个有状态应用可以一键迁移”之前，先跑 `fugue app continuity audit`。",
  ],
  railTitle: "最容易忽略的细节",
  sections: [
    {
      codeExamples: [
        {
          caption:
            "安装已发布 CLI，导出一个 access key，然后就能从当前目录直接开始第一次部署。",
          code: CLI_INSTALL_SNIPPET,
          filename: "quickstart.sh",
          language: "bash",
          title: "已发布 CLI 的最短路径",
        },
        {
          caption:
            "如果是自托管控制面，涉及 admin snapshot 或 `web diagnose` 命令时，还要同时设置 API 和 Web 基础地址。",
          code: CLI_SELF_HOSTED_SNIPPET,
          filename: "self-hosted.sh",
          language: "bash",
          title: "自托管环境变量",
        },
      ],
      id: "cli",
      intro:
        "CLI 是 Fugue 当前的主操作入口。部署、导入、inspect、runtime、failover、原始 HTTP 诊断，都已经可以在 CLI 里完成，不需要先掉回 `kubectl`。",
      label: "CLI",
      note: {
        body:
          "普通文本模式命令会在发现 GitHub Release 有更新时给出升级提醒。需要安静 shell 时，用 `FUGUE_SKIP_UPDATE_CHECK=1`；需要升级时，直接 `fugue upgrade`。",
        title: "升级提醒行为",
      },
      paragraphs: [
        "正常部署只需要 tenant 级 access key。平台管理员 key 或 bootstrap key 应该只用于 `fugue admin ...`、跨租户排查或产品层调试。",
        "在自托管控制面上，`FUGUE_BASE_URL` 和 `FUGUE_WEB_BASE_URL` 需要成对设置。前者决定 CLI 打到哪个 API，后者决定 admin snapshot 和 `fugue web diagnose` 去读哪个 `fugue-web` 实例。",
        "`fugue app overview` 和 `fugue operation show` 的 JSON 输出默认会做 secret 脱敏。只有在明确要看原值时才加 `--show-secrets`。",
      ],
      tables: [
        {
          columns: ["目标", "命令", "为什么重要"],
          rows: [
            [
              "部署当前源码",
              "`fugue deploy .`",
              "把本地源码打成归档后排队导入，不需要额外脚手架。",
            ],
            [
              "读取完整应用上下文",
              "`fugue app overview my-app`",
              "一次看到域名、绑定、镜像库存、operation 和 rollout 上下文。",
            ],
            [
              "追 runtime 日志",
              "`fugue app logs runtime my-app --follow`",
              "不离开 CLI 就能跟 pod 日志。",
            ],
            [
              "查询日志表",
              "`fugue app logs query my-app --table gateway_request_logs --since 1h --match status=500`",
              "当真正有价值的数据在应用数据库而不是 stdout 里时特别有用。",
            ],
            [
              "安全调用应用内部 HTTP",
              "`fugue app request my-app GET /admin/requests --header-from-env X-Service-Key=SERVICE_KEY`",
              "从应用 env 自动取 header，避免把 service secret 粘进 shell。",
            ],
            [
              "检查并升级 CLI",
              "`fugue version --check-latest` / `fugue upgrade`",
              "已发布二进制支持原地自升级。",
            ],
          ],
          title: "高频高价值命令",
        },
      ],
      title: "CLI 快速开始与默认行为",
      valueGroups: [
        {
          items: [
            {
              detail: "正常部署和租户级操作的必需项。",
              label: "FUGUE_API_KEY",
              value: "当前 access key",
            },
            {
              detail: "自托管时让 CLI 指向正确的 API 地址。",
              label: "FUGUE_BASE_URL",
              value: "自托管 API 基础地址",
            },
            {
              detail:
                "admin snapshot 与 `fugue web diagnose` 会用到，目标是 `fugue-web` 路由而不是 API。",
              label: "FUGUE_WEB_BASE_URL",
              value: "自托管 Web 基础地址",
            },
            {
              detail: "需要安静 shell 时再开，不影响真实升级能力。",
              label: "FUGUE_SKIP_UPDATE_CHECK",
              value: "可选静默模式",
            },
          ],
          title: "Shell 环境变量",
        },
      ],
    },
    {
      bulletGroups: [
        {
          items: [
            "GitHub 导入已经支持公开/私有仓库、自动构建识别（`auto`、`static-site`、`dockerfile`、`buildpacks`、`nixpacks`），以及 `--service-env-file <service>=<path>` 这类 service 级 `.env` 覆盖。",
            "CLI 的本地源码部署会自动归档；Web 产品层里的本地上传发生在登录后，并且 JSON create-and-import 路由会明确拒绝 `local-upload`，必须走 multipart 上传接口。",
            "只有当 importer 还能保持自动拓扑识别时，`persistent_storage_seed_files` 才成立。只要你手动设置了 `source_dir`、`dockerfile_path` 或 `build_context_dir`，Fugue 就会拒绝 seed-file 覆盖。",
            "当 `network_mode=background` 时，Fugue 会清空 service port 和 public route；当 `network_mode=internal` 时，会保留内部 service port，但不创建 public route。",
          ],
          title: "导入护栏",
        },
        {
          items: [
            "`--runtime` 默认值就是 shared managed runtime。",
            "`--port` 或 `--service-port` 只在 public/internal service 上有意义。",
            "`--command` 最终会以 `sh -lc <command>` 的形式进入 queued app spec 和 queued operation。",
            "`--storage-size`、`--mount`、`--mount-file` 会真正引入持久化状态，之后会影响 `migrate` 和 failover 的边界。",
            "`--managed-postgres` 与一组 `--postgres-*` 参数，意味着你从一开始就在声明 app-owned managed PostgreSQL，而不是临时加一个数据库字符串。",
          ],
          title: "会显著改变行为的参数",
        },
      ],
      codeExamples: [
        {
          caption:
            "这是今天最主要的三种导入路径。GitHub 和本地源码在存在 `fugue.yaml` 或 Compose 时都能展开成拓扑导入。",
          code: IMPORT_SNIPPET,
          filename: "imports.sh",
          language: "bash",
          title: "GitHub、镜像与本地部署入口",
        },
      ],
      id: "imports",
      intro:
        "Fugue 当前支持三条导入面：本地源码、GitHub 仓库、镜像引用。GitHub 与本地上传还可以把拓扑清单展开成多个 app 和 operation。",
      label: "导入",
      paragraphs: [
        "GitHub 导入现在不再只是公开静态站点。当前 importer 已经支持公开/私有仓库、tracked repository sync，以及 `fugue.yaml` / Compose 驱动的 stack-aware import。",
        "镜像导入是最薄的一条路径：直接给镜像引用，可选命名 app，完全绕过构建识别。",
        "如果本地归档文件名已经足够清晰，upload import 会自动推导 app name。当前接受的归档格式是 `.zip`、`.tgz` 和 `.tar.gz`。",
      ],
      tables: [
        {
          columns: ["路径", "适合场景", "关键参数", "特别注意"],
          rows: [
            [
              "本地源码",
              "`fugue deploy .` 或 Web multipart 上传",
              "`--name`、`--build`、`--command`、持久化存储参数",
              "Web 本地上传是 multipart-only，而且发生在登录之后。",
            ],
            [
              "GitHub 仓库",
              "`fugue deploy github owner/repo`",
              "`--branch`、`--private`、`--repo-token`、`--service-env-file`",
              "私有仓库需要明确 repo auth，除非工作区已经接好了 GitHub 访问。",
            ],
            [
              "容器镜像",
              "`fugue deploy image ghcr.io/example/app:latest`",
              "`--name`、`--runtime`、`--replicas`、`--command`",
              "这里不会再做构建识别，所以 Dockerfile/source-dir 参数没有意义。",
            ],
          ],
          title: "导入路径总览",
        },
        {
          columns: ["网络模式", "路由行为", "端口行为", "常见用途"],
          rows: [
            [
              "Public",
              "创建 public route",
              "暴露 service port",
              "默认 HTTP 应用",
            ],
            [
              "Internal",
              "不创建 public route",
              "保留 internal service port",
              "只给服务间调用",
            ],
            [
              "Background",
              "不创建 public route",
              "清空 service port",
              "worker、scheduler、queue consumer",
            ],
          ],
          title: "Network mode 行为",
        },
      ],
      title: "导入方式、关键参数与拓扑导入边界",
    },
    {
      bulletGroups: [
        {
          items: [
            "如果有多个 service 被标记为 public，就必须显式写 `primary_service`；多公共入口的模糊拓扑会被拒绝。",
            "如果只有一个 public service，Fugue 可以自动推导 `primary_service`。",
            "`volumes` 里指向缺失本地文件的挂载，会变成可编辑的 `persistent_storage_seed_files`，这就是首轮部署前要求用户补文件内容的来源。",
            "`persistent_storage.storage_size` 与 `storage_class_name` 会和 volume 推导出来的 mounts 合并，而不是把 mounts 覆盖掉。",
            "`template.variables` 支持 `required`、`secret` 和 `generate=password`，很适合拿来做真正可复用的 starter。",
          ],
          title: "Fugue 真正在执行的规则",
        },
      ],
      codeExamples: [
        {
          caption: "这个形状对应的是当前 importer 与 template inspector 真正理解的 `fugue.yaml`。",
          code: FUGUE_MANIFEST_SNIPPET,
          filename: "fugue.yaml",
          language: "yaml",
          title: "`fugue.yaml` 注释示例",
        },
      ],
      id: "manifest",
      intro:
        "`fugue.yaml` 是告诉 Fugue 服务拓扑、依赖关系、binding、template metadata 和 backing service 的最清晰方式，而不是让 importer 靠猜。",
      label: "fugue.yaml",
      note: {
        body:
          "在导入自己没写过的仓库前，优先跑 `fugue template inspect github owner/repo` 或 `fugue deploy inspect github owner/repo`。它会先告诉你 `primary_service`、warning、template metadata 和可编辑 seed file，再决定是否真正导入。",
        title: "先 inspect，再 import",
      },
      paragraphs: [
        "Compose 导入依然支持，但 `fugue.yaml` 更适合显式声明 primary service、starter 变量和 backing service 归属。",
        "当前 importer 会把 app service、managed Postgres 声明、backing service 和 binding 当成一个统一拓扑来处理，所以 `fugue.yaml` 不只是部署语法，也会影响后续 failover 行为。",
      ],
      tables: [
        {
          columns: ["根字段", "含义", "当前行为"],
          rows: [
            ["`version`", "清单版本", "当前示例使用 `version: 1`。"],
            [
              "`primary_service`",
              "拓扑里的主公开入口",
              "当多个 service 公开暴露时必须显式声明；如果只有一个 public service，则可自动推导。",
            ],
            [
              "`template`",
              "starter 元数据",
              "支持模板名、slug、docs/demo URL、default runtime 与变量定义。",
            ],
            [
              "`services`",
              "可部署的 app / managed service 拓扑",
              "用于推导 app import、依赖顺序、binding 与 seed file。",
            ],
            [
              "`backing_services`",
              "共享后端服务，例如 Postgres 或 Redis",
              "适合在拓扑层显式声明归属与 binding，而不是散落在 env 里。",
            ],
          ],
          title: "顶层字段",
        },
        {
          columns: ["Service 字段", "作用域", "影响什么"],
          rows: [
            [
              "`public` / `port`",
              "service 级",
              "决定 public route 资格和 internal/public 端口映射。",
            ],
            [
              "`build.strategy`、`build.context`、`build.dockerfile`",
              "service 级",
              "当 auto detection 不够时，锁定构建行为与路径。",
            ],
            [
              "`env` / `environment`",
              "service 级",
              "把静态环境变量写进导入后的 service spec。",
            ],
            [
              "`depends_on`",
              "service 级",
              "给 controller 提供拓扑部署顺序与依赖关系。",
            ],
            [
              "`bindings`",
              "service 级",
              "把 app service 显式绑定到命名 backing service。",
            ],
            [
              "`volumes` 与 `persistent_storage`",
              "service 级",
              "控制持久化 mount、storage class/size，以及可编辑 seed file 提示。",
            ],
          ],
          title: "Service 级字段",
        },
      ],
      title: "`fugue.yaml` 拓扑规则与模板元数据",
    },
    {
      bulletGroups: [
        {
          items: [
            "计费在“有 managed 容量、保留的 managed image inventory，或付费 public runtime 使用”任一条件成立时就会激活。",
            "一旦 managed 容量进入计费，扣费依据是已保存的 managed envelope，而不只是某一刻 pod 的瞬时读数。",
            "租户把应用部署到付费 public runtime 上时，会按小时从消费者余额扣费，同时给 runtime owner 记一笔对应 credit。",
            "自己的 attached server 默认免费，只有把它作为对外公开的付费 public runtime 发布给其他租户时，才会进入 public runtime 计费逻辑。",
            "当前 Web 自助充值只接受 5 到 5000 的整美元金额。",
          ],
          title: "最容易低估的地方",
        },
      ],
      codeExamples: [
        {
          caption: "这是今天在 CLI 侧最有价值的计费命令集。",
          code: BILLING_SNIPPET,
          filename: "billing.sh",
          language: "bash",
          title: "计费查看与调整命令",
        },
      ],
      id: "billing",
      intro:
        "Fugue 的计费对 managed 容量是 envelope-based，对 paid public runtime 是 event-based。最重要的区别在于：计费激活条件并不等于“应用现在是否正在处理流量”。",
      label: "计费",
      note: {
        body:
          "当前默认 price book 的校准目标，是让 2 vCPU、4 GiB 内存、30 GiB 存储这组托管容量的大致月估值落在 4 美元附近。这是核心计费模型里的显式校准，不是 marketing 文案。",
        title: "Price book 校准目标",
      },
      paragraphs: [
        "live usage 和 committed billing 是两种不同视角。Billing API 可以跳过 live managed usage 聚合，只返回 committed billing 数据；当你关心“保存下来的 envelope 和可计费状态”时，这个视角更稳定。",
        "managed image inventory 真的会影响计费激活。只要保留的 managed 镜像库存还在，managed storage 就仍是 billable envelope 的一部分，即便应用流量本身很安静。",
      ],
      tables: [
        {
          columns: ["状态", "含义", "常见下一步"],
          rows: [
            [
              "Inactive",
              "当前没有 managed 容量、保留的 managed image inventory，或 paid public runtime 使用处于可计费状态。",
              "如果你原本预期已进入 managed 计费，先检查 envelope、镜像库存和 runtime 放置位置。",
            ],
            [
              "Active",
              "managed envelope 或 paid public runtime 正在按小时扣余额。",
              "如果速率异常，先查 envelope、current usage 与 image inventory。",
            ],
            [
              "Restricted",
              "仍有 billable managed/public runtime 活动，但余额已经耗尽。",
              "先充值，再增加容量或继续部署到 paid public runtime。",
            ],
            [
              "Over cap",
              "当前 live managed capacity 已经高于保存的 managed envelope。",
              "先把 cap 提高到覆盖当前 committed 容量，再继续加 managed 容量。",
            ],
          ],
          title: "计费状态解释",
        },
      ],
      title: "计费何时激活、默认资源与镜像库存影响",
      valueGroups: [
        {
          items: [
            {
              detail: "当前每个 tenant 的默认免费托管额度。",
              label: "免费托管上限",
              value: "500m CPU · 512 MiB · 5 GiB",
            },
            {
              detail: "未显式覆盖时，managed app 的默认资源。",
              label: "默认 managed app",
              value: "250m CPU · 512 MiB · 0 GiB 额外存储",
            },
            {
              detail: "app-owned managed Postgres 的默认资源。",
              label: "默认 managed Postgres",
              value: "500m CPU · 1024 MiB · 1 GiB 存储",
            },
            {
              detail: "开启 workspace 时，它本身就是 billable storage。",
              label: "默认 managed workspace",
              value: "10 GiB 存储",
            },
          ],
          title: "默认资源基线",
        },
      ],
    },
    {
      bulletGroups: [
        {
          items: [
            "`ready`：没有明显的有状态阻断，stateless posture 也基本合理。",
            "`caution`：Fugue 没看到硬阻断，但 replicas 或 runtime posture 还需要补齐。",
            "`blocked`：managed backing service 或 persistent workspace 仍然挂着，stateless migrate 被刻意阻断。",
          ],
          title: "Audit 状态",
        },
      ],
      codeExamples: [
        {
          caption: "先 audit，再声明 failover target，最后在拓扑准备好后显式执行 failover。",
          code: FAILOVER_SNIPPET,
          filename: "continuity.sh",
          language: "bash",
          title: "Continuity audit 与 failover 命令",
        },
      ],
      id: "continuity",
      intro:
        "Fugue 有意把 stateless migrate 和 managed failover 拆成两条路径。很多团队在应用从 shared runtime 走向 attached runtime，或者开始做有状态恢复时，会把这两条路径混在一起。",
      label: "连续性",
      note: {
        body:
          "当前 managed failover 最强的前提，是控制面能从同一个 Kubernetes control plane 协调两端 runtime 及其存储算子。跨集群数据库引导、提升与端到端恢复验证，还没有被抽象成完全通用的模型。",
        title: "当前边界",
      },
      paragraphs: [
        "`fugue app move` 与 `/v1/apps/{id}/migrate` 依然是 stateless handoff。只要应用还挂着 Fugue-managed PostgreSQL 或 persistent workspace，这条路径就会被故意挡住。",
        "managed failover 是 controller 编排路径。声明好 failover target 后，它可以做 fence、等待最后一次 workspace sync、切 runtime，再恢复 replicas。",
      ],
      tables: [
        {
          columns: ["路径", "适合场景", "硬边界"],
          rows: [
            [
              "Migrate",
              "应用能在没有托管状态附着的前提下切 runtime。",
              "managed PostgreSQL 与 persistent workspace 都会阻断这条路径。",
            ],
            [
              "Failover",
              "需要 controller 编排的 runtime 切换与 state-aware recovery。",
              "必须先声明 failover target，而且最适合同控制面环境。",
            ],
          ],
          title: "Migrate 与 failover 的分界",
        },
      ],
      title: "Stateless migrate 与 managed failover 的区别",
    },
    {
      bulletGroups: [
        {
          items: [
            "`fugue app fs` 可以浏览 persistent storage，也可以浏览 live container filesystem；`--source persistent` 与 `--source live` 不能混着理解。",
            "`fugue app request --header-from-env` 比把 service secret 直接粘进终端历史安全得多。",
            "`fugue runtime doctor shared` 会把 location-specific 的 managed-shared runtime ID 折叠进 shared 视图里，便于排查真实 backing node。",
            "控制面会直接发布 `/openapi.yaml`、`/openapi.json` 与 `/docs`；这才是 HTTP 契约的事实源。",
          ],
          title: "诊断里最值钱的细节",
        },
      ],
      codeExamples: [
        {
          caption:
            "先 inspect，再用 route、logs、filesystem、runtime 与原始 HTTP 诊断命令排查，不要先 SSH。",
          code: DIAGNOSE_SNIPPET,
          filename: "diagnose.sh",
          language: "bash",
          title: "Inspect 与 troubleshooting 工作流",
        },
      ],
      id: "diagnose",
      intro:
        "很多问题最短的排查路径其实不是 SSH，而是先跑 inspect 或 diagnose 命令。Fugue 已经把拓扑、route、日志、runtime 与 HTTP timing probe 都直接暴露到 CLI 了。",
      label: "诊断",
      paragraphs: [
        "在导入陌生仓库前，优先做 template inspection。它能在不产生任何 mutation 的前提下，把 `primary_service`、warning、template metadata 和可编辑 seed file 都摊开给你看。",
        "需要确认到底是契约形状、控制面延迟，还是应用侧行为不一致时，用 `fugue api request` 和 `fugue diagnose timing`，不要只看页面上的单层错误提示。",
      ],
      tables: [
        {
          columns: ["命令", "最佳用途", "为什么比猜更快"],
          rows: [
            [
              "`fugue template inspect github owner/repo`",
              "导入前先看仓库拓扑",
              "能直接看到 topology、template metadata、warning 和 seed file。",
            ],
            [
              "`fugue app overview my-app`",
              "读取当前应用全景状态",
              "把 route、域名、binding、operation、镜像和 rollout 上下文放到一个视图里。",
            ],
            [
              "`fugue app logs pods my-app`",
              "看当前与最近 pod group",
              "在 rollout 之后，单看 current runtime log 往往解释不了到底换了什么。",
            ],
            [
              "`fugue app logs query ...`",
              "排查业务日志表",
              "当真正的请求日志在数据库表里时，比每次手写 SQL 更直接。",
            ],
            [
              "`fugue runtime doctor shared`",
              "检查 runtime 健康与挂接状态",
              "一次看到 status、endpoint、recent heartbeat 和匹配节点。",
            ],
            [
              "`fugue api request GET /v1/apps`",
              "排查控制面 API",
              "直接输出 status、header、body、server-timing 和传输耗时。",
            ],
            [
              "`fugue diagnose timing -- app overview my-app`",
              "做延迟归因",
              "会把一个正常 CLI 命令内部每个 HTTP 请求的 DNS / connect / TLS / TTFB / total 都拆开。",
            ],
          ],
          title: "诊断捷径",
        },
      ],
      title: "Inspect、diagnose 与契约优先",
    },
  ],
  skipToContent: "跳到正文",
};

export function readDocsContent(locale: Locale): DocsPageContent {
  if (locale === "en") {
    return EN_CONTENT;
  }

  return ZH_CN_CONTENT;
}
