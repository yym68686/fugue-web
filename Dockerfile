FROM oven/bun:1.3.1-alpine@sha256:514fe15804f8ad3772ba323c2298daf121bb4b42386e2522998de5e87f16a94c AS deps

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1

COPY package.json bun.lock turbo.json biome.json ./
COPY patches ./patches
COPY apps/web/package.json ./apps/web/package.json
COPY apps/ui/package.json ./apps/ui/package.json
COPY apps/examples/fugue-console/package.json ./apps/examples/fugue-console/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
RUN bun install --frozen-lockfile --ignore-scripts

FROM deps AS builder

COPY . .
RUN bunx turbo run build --filter=@fugue/web

FROM node:26-alpine@sha256:e88a35be04478413b7c71c455cd9865de9b9360e1f43456be5951032d7ac1a66 AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --output-document=- http://127.0.0.1:3000/healthz >/dev/null || exit 1

CMD ["node", "apps/web/server.js"]
