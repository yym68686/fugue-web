# ADR 0001: Adopt the complete COSS frontend architecture

- Status: Accepted for architecture; explicit mixed-license sign-off pending
- Date: 2026-07-12
- Decision owner: Fugue project owner (architecture); license approval pending explicit owner sign-off
- Upstream reference: `cosscom/coss@1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4`

## Context

Fugue Web had a single Next.js application, several hand-written visual systems and no registry/package boundary. Reproducing only COSS styling would leave component ownership, Base UI behavior, package consumption, documentation and quality gates unresolved. The project owner therefore required full architectural adoption.

## Decision

Fugue Web uses a Bun 1.3.1 and Turborepo workspace with these boundaries:

- `apps/web`: the only production product runtime and BFF;
- `apps/ui`: private Fumadocs documentation and the editable `@fugue/*` shadcn registry;
- `apps/examples/fugue-console`: isolated product-composition and visual fixture;
- `packages/ui`: source-consumed `@fugue/ui` package generated from the registry;
- `packages/typescript-config`: strict shared TypeScript policy.

Registry source flows in one direction:

```text
apps/ui/registry/default/{base-ui,hooks,lib,ui}
  -> validate -> registry build -> packages/ui sync
  -> @fugue/ui direct subpath exports
  -> apps/web and apps/examples/fugue-console
```

Base UI is the only primitive foundation. Consumers use `render` composition, semantic CSS variables, Tailwind CSS v4, `data-slot`, CVA and direct package subpaths. Server Components remain the default outside the smallest interactive boundary.

## License boundary

COSS is mixed-license. Only files below upstream `apps/ui/`, declared MIT by upstream `LICENSING.md`, are source-import eligible. Root configuration, upstream `packages/ui`, `packages/typescript-config`, workflows, `apps/origin`, brand assets and fonts were not copied. Fugue workspace configuration, sync/build tooling, docs, particles, examples and product integration are independently authored.

Every imported file is pinned with SHA-256 and local modifications in `docs/upstream/coss-files.json`. No AGPL source enters the product build under this decision.

## Non-goals

- Copying Cal.com/COSS brand, business data, marketing copy, IA or example records.
- Deploying the registry app on the product origin or giving it Fugue credentials.
- Replacing server authorization with client UI state.
- Loading every registry item or particle into product bundles.
- Switching the production server runtime from Node to Bun without a separate compatibility decision.

## Consequences

- Primitive changes are made once in registry source and regenerated; direct edits to synced package trees fail CI.
- Product applications depend on `@fugue/ui/components/*` rather than internal registry paths or a barrel.
- The repository carries Bun, Turbo, Biome, registry, license/SBOM and duplicate-version gates in addition to existing OpenAPI/security checks.
- COSS upstream upgrades require a license diff, source diff, provenance update and full regression suite before the pinned SHA changes.

## Rollback

Workspace/tooling, UI package and each product vertical slice are delivered as independent commits. A bad consumer migration rolls back that slice while keeping the registry/package boundary. A bad upstream component update restores the previous pinned source hashes and regenerates `packages/ui`; it does not reactivate Morlane or hand-written parallel primitives. Security fixes, OpenAPI synchronization and session authorization are never rolled back to their vulnerable behavior.
