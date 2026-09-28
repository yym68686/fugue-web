<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Architecture Rule

Configuration and code must remain decoupled: a failed code release must not block configuration recovery, and configuration changes must not require code changes.

## Fugue Architecture

Keep these layers separate:

1. Configuration intent — what should be served.
2. Constraint policy — which changes are allowed.
3. Immutable artifacts — signed, digest-addressed traffic and DNS bundles.
4. Runtime facts — heartbeats, ACKs, loaded digests, and serving state.
5. Code execution — validates and applies artifacts; it must not own serving configuration.

A failed code release must not invalidate the currently serving artifact. A failed configuration rollout must preserve the previous positive LKG.
