# syntax=docker/dockerfile:1.7
#
# HRIS background worker image.
#
# Scoped like the API image to only the workspaces the worker needs, so the image
# does not carry the API's HTTP stack or the web/Expo toolchains. The workspace
# directories that `npm ci` expects but the worker does not build are stubbed.

ARG NODE_VERSION=22.14.0

# ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV CI=true

# ------------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY database/package.json database/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN mkdir -p apps/api apps/web apps/mobile \
 && printf '{"name":"@hris/api","version":"0.0.0-stub","private":true}\n' > apps/api/package.json \
 && printf '{"name":"@hris/web","version":"0.0.0-stub","private":true}\n' > apps/web/package.json \
 && printf '{"name":"@hris/mobile","version":"0.0.0-stub","private":true}\n' > apps/mobile/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund \
      --workspace @hris/eslint-config \
      --workspace @hris/shared-types \
      --workspace @hris/config \
      --workspace @hris/database \
      --workspace @hris/worker

# ------------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY database/package.json database/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN mkdir -p apps/api apps/web apps/mobile \
 && printf '{"name":"@hris/api","version":"0.0.0-stub","private":true}\n' > apps/api/package.json \
 && printf '{"name":"@hris/web","version":"0.0.0-stub","private":true}\n' > apps/web/package.json \
 && printf '{"name":"@hris/mobile","version":"0.0.0-stub","private":true}\n' > apps/mobile/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund \
      --workspace @hris/eslint-config \
      --workspace @hris/shared-types \
      --workspace @hris/config \
      --workspace @hris/database \
      --workspace @hris/worker

# ------------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/eslint-config packages/eslint-config
COPY packages/shared-types packages/shared-types
COPY packages/config packages/config
COPY database database
COPY apps/worker apps/worker

# Packages first: the worker compiles against their emitted declarations, and
# `@hris/database` generates its Prisma client during its own build.
RUN npm run build -w @hris/shared-types -w @hris/config -w @hris/database \
 && npm run build -w @hris/worker

# ------------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

RUN apk add --no-cache tini \
 && addgroup -S hris && adduser -S -G hris hris

COPY --from=prod-deps --chown=hris:hris /app/node_modules ./node_modules
COPY --from=build --chown=hris:hris /app/package.json ./package.json
COPY --from=build --chown=hris:hris /app/packages ./packages
COPY --from=build --chown=hris:hris /app/database ./database
COPY --from=build --chown=hris:hris /app/apps/worker ./apps/worker

USER hris

# tini forwards SIGTERM so the worker drains in-flight jobs before exiting, which is
# what lets a rolling deploy complete sends instead of leaving them half-processed.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/worker/dist/main.js"]
