# COSS upstream provenance and license gate

This manifest records the COSS architectural reference and every source-bearing import used by Fugue Web. It is both a reproducibility artifact and the allow-list consumed by the license/provenance CI check.

## Locked upstream

- Repository: `https://github.com/cosscom/coss`
- Commit: `1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4`
- Git tree: `eaf870eca9a89da365b5134056e31a6c9db4f35f`
- Upstream package manager: `bun@1.3.1`
- Registry baseline: 54 primitive source files and 567 total files below `apps/ui/registry`; 566 prebuilt registry files below `apps/ui/public/r`

Reference-file SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `README.md` | `8af22217a330eeb51ff410e74a5ea054379f3e272140728590fe44566b5b8eb8` |
| `LICENSE` | `20b067f86de375aae6db0f283ab2e65de24d537733b89bd58432c101259d84cf` |
| `LICENSING.md` | `bdc4f6e1e67ebf59372ea6498e5b93a4c6d6b177a82e59e1e28cd542219182f8` |
| `package.json` | `03865493d63debc3db9f7ee6952d5e5c6ed99a4d3ec7f1e99fe85ae23a733534` |
| `apps/ui/package.json` | `b5a5fcc95f86f5a30f9cd6f9fe0d0ea034bc4c8f22fa0177b3d006ab0cb3f315` |
| `packages/ui/package.json` | `d9ebb19bd1fb0c846ccb0852a51b0f6ee2ca1001f0e1ad4be24887519d80ef4c` |
| `turbo.json` | `7c15981442dc07bea7dcf4b99d5ba278eafb349f1cbe26124a4658a121179f8a` |
| `biome.json` | `495667755c154b965777c32182a64428d57b176afff6baf9773ecdfb5090d777` |

## License decision

Upstream `LICENSING.md` places `apps/ui/` and `apps/origin/` under MIT; the repository default and `packages/ui/` package are AGPL-3.0-or-later. Fugue therefore applies this hard gate:

1. Architecture, directory boundaries and build concepts are independently implemented in Fugue-owned configuration.
2. Source code may be imported only from the MIT `apps/ui/` tree or obtained through the official shadcn registry, unless the project owner separately accepts AGPL obligations or obtains another license.
3. `apps/origin/` is not used because it is the legacy Radix path rather than the active Base UI architecture.
4. No file from upstream `packages/ui/`, root tooling or another default-AGPL path may be copied under this allow-list.
5. Imported files retain an MIT notice and are listed individually below with local modifications.

This is an engineering gate and does not replace legal advice.

## Source import allow-list

The machine-readable, per-file allow-list is `docs/upstream/coss-files.json`; it records all 68 imported MIT files, their upstream SHA-256 values and every local deviation. The table below records the architecture-only portions for which no upstream source was copied. Every later source import must be added to the JSON manifest before it is committed.

| Upstream source path | Commit | License | Local path | Local modifications |
| --- | --- | --- | --- | --- |
| Architecture only: root workspace/Bun/Turbo/Biome boundaries | `1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4` | No copied source | root configuration | Independently authored for Fugue scripts and quality gates |
| Architecture only: registry → package one-way flow | `1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4` | No copied source | `apps/ui/scripts`, `packages/ui` | Independently authored sync and drift-check implementation |
| Architecture only: shared runtime font module → package export → root layout variables | `1664a7f0b3be9f25f5ff0ac846667633b4ccd6b4` | No copied source | `packages/ui/src/fonts/index.ts`, application root layouts | Independently authored with Next.js `next/font/local`; no source from the upstream AGPL `packages/ui/src/fonts` path was copied |

## Verification

Run `bun run coss:upstream:verify` to fetch the exact pinned commit into an isolated temporary checkout and verify its tree, licensing declaration, reference files and every recorded source hash. Run `bun run coss:upstream:diff -- --to <full-sha>` before considering an upgrade; it produces a read-only license/source preview and never changes registry source or the pinned manifest. Production builds never fetch COSS.

The provenance CI runner must fail when:

- a recorded upstream commit differs from the locked commit;
- an imported local file has no allow-list row;
- a source path falls outside `apps/ui/` without an explicit approved license exception;
- an MIT notice or required attribution is missing;
- synced `packages/ui` output drifts from the recorded registry source.
