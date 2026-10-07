# syntax=docker/dockerfile:1.7
#
# HRIS API image.
#
# The build is scoped to the workspaces the API actually needs. Installing the
# whole monorepo would drag Expo and React Native into a server image for no
# reason, so only the relevant workspaces are materialised before `npm ci`.
# `npm ci` requires every workspace directory named in the root manifest to
# exist, so the unused ones are stubbed rather than omitted.

ARG NODE_VERSION=22.14.0

# ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV CI=true

# ------------------------------------------------------------------------------
FROM base AS deps
# Copy manifests only: this layer is reused until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY database/package.json database/package.json
COPY apps/api/package.json apps/api/package.json

# Stub the workspaces the API image does not build. npm needs the directories to
# exist to resolve the workspace graph; their contents are never read.
RUN mkdir -p apps/web apps/mobile \
 && printf '{"name":"@hris/web","version":"0.0.0-stub","private":true}\n' > apps/web/package.json \
 && printf '{"name":"@hris/mobile","version":"0.0.0-stub","private":true}\n' > apps/mobile/package.json

# Dev dependencies are kept because the build stage compiles with them. The
# runtime stage installs production dependencies separately.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund \
      --workspace @hris/eslint-config \
      --workspace @hris/shared-types \
      --workspace @hris/config \
      --workspace @hris/database \
      --workspace @hris/api

# ------------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY database/package.json database/package.json
COPY apps/api/package.json apps/api/package.json
RUN mkdir -p apps/web apps/mobile \
 && printf '{"name":"@hris/web","version":"0.0.0-stub","private":true}\n' > apps/web/package.json \
 && printf '{"name":"@hris/mobile","version":"0.0.0-stub","private":true}\n' > apps/mobile/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund \
      --workspace @hris/eslint-config \
      --workspace @hris/shared-types \
      --workspace @hris/config \
      --workspace @hris/database \
      --workspace @hris/api

# ------------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/eslint-config packages/eslint-config
COPY packages/shared-types packages/shared-types
COPY packages/config packages/config
COPY database database
COPY apps/api apps/api

# Packages first: the API compiles against their emitted type declarations.
# `@hris/database` runs `prisma generate` as part of its build, because the client it
# re-exports is generated output and is deliberately not committed.
RUN npm run build -w @hris/shared-types -w @hris/config -w @hris/database \
 && npm run build -w @hris/api

# ------------------------------------------------------------------------------
# Runtime ships production dependencies only. `@hris/shared-types` resolves
# through its package.json "main" to dist/index.js, so the built output of the
# workspace packages must be present here alongside node_modules.
FROM base AS runtime
ENV NODE_ENV=production \
    API_PORT=3001

RUN apk add --no-cache tini curl \
 && addgroup -S hris && adduser -S -G hris hris

COPY --from=prod-deps --chown=hris:hris /app/node_modules ./node_modules
COPY --from=build --chown=hris:hris /app/package.json ./package.json
COPY --from=build --chown=hris:hris /app/packages ./packages
COPY --from=build --chown=hris:hris /app/database ./database
COPY --from=build --chown=hris:hris /app/apps/api ./apps/api

USER hris
EXPOSE 3001

# Readiness covers PostgreSQL, Redis and the queue from phase 1 onward, so this
# probe fails while a dependency is unreachable, and the orchestrator stops routing
# traffic to an instance that cannot serve a request.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${API_PORT}/health/ready" || exit 1

# tini reaps zombies and forwards SIGTERM so the Nest shutdown hooks run and
# in-flight requests are drained before the container exits.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
