# syntax=docker/dockerfile:1.7
#
# HRIS web image (Next.js, standalone output).
#
# `NEXT_PUBLIC_*` variables are inlined into the client bundle at build time, so
# they must be supplied as build arguments rather than runtime environment
# variables. Anything genuinely runtime-only must not be prefixed NEXT_PUBLIC_.

ARG NODE_VERSION=22.14.0

# ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1

# ------------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
COPY apps/web/package.json apps/web/package.json

RUN mkdir -p apps/api apps/mobile \
 && printf '{"name":"@hris/api","version":"0.0.0-stub","private":true}\n' > apps/api/package.json \
 && printf '{"name":"@hris/mobile","version":"0.0.0-stub","private":true}\n' > apps/mobile/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund \
      --workspace @hris/eslint-config \
      --workspace @hris/shared-types \
      --workspace @hris/config \
      --workspace @hris/web

# ------------------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_API_PLATFORM_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_API_PLATFORM_URL=${NEXT_PUBLIC_API_PLATFORM_URL}

COPY tsconfig.base.json ./
COPY packages/eslint-config packages/eslint-config
COPY packages/shared-types packages/shared-types
COPY packages/config packages/config
COPY apps/web apps/web

# Workspace packages are compiled here because Next resolves their "main" fields
# to dist output rather than transpiling TypeScript from source.
RUN npm run build -w @hris/shared-types -w @hris/config \
 && npm run build -w @hris/web

# ------------------------------------------------------------------------------
# Next's standalone output bundles only the server runtime and the modules it
# traced, so the runtime stage copies the generated tree instead of node_modules.
FROM base AS runtime
ENV NODE_ENV=production \
    WEB_PORT=3000 \
    # Next's standalone server binds to $HOSTNAME, which Docker populates with the
    # container ID. Pinning it to the wildcard keeps the listener on every
    # interface so the loopback health check can reach it.
    HOSTNAME=0.0.0.0

RUN apk add --no-cache tini curl \
 && addgroup -S hris && adduser -S -G hris hris

WORKDIR /app
COPY --from=build --chown=hris:hris /app/apps/web/.next/standalone ./
COPY --from=build --chown=hris:hris /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=hris:hris /app/apps/web/public ./apps/web/public

USER hris
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${WEB_PORT}/" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
