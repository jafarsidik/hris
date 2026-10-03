# Deployment

## Environments

| Environment | Purpose                                | Data                | Notes                                    |
| ----------- | -------------------------------------- | ------------------- | ---------------------------------------- |
| Local       | Development on a workstation           | Synthetic          | Docker Compose                           |
| CI         | Automated verification                 | None                | Builds images, boots the stack, tears down |
| Staging    | Integration and pre-release verification | Anonymised production-shaped data | Same images as production |
| Production | Live system                            | Real                | No OpenAPI, strict origins, HSTS         |

Staging runs the same images as production, built from the same commit, differing
only in configuration. A staging deployment that is not reproducible from a
production build configuration is a second, untested system.

## Local development

```bash
cp .env.example .env
npm ci

npm run infra:up     # PostgreSQL on 5435, Redis on 6381
npm run dev          # API on 3001, web on 3000, mobile via `npm run start -w @hris/mobile`
```

Or run everything in containers:

```bash
npm run stack:up     # builds and starts the full stack
npm run stack:logs
npm run stack:down
```

### The two port numbers that cause confusion

| Context   | PostgreSQL | Redis | API | Web |
| --------- | ---------- | ----- | --- | --- |
| From host | 5435       | 6381  | 3001 | 3000 |
| From container | 5432 | 6379 | 3001 | 3000 |

`.env.example` describes the host-side values, because that is what an
application running directly on your machine needs. `docker-compose.yml` overrides
the host and port to the service name and container port, because that is what an
application inside the network needs.

An application must read these from configuration and never hard-code either. A
container configured with `POSTGRES_HOST=localhost` connects to itself and fails
with a connection error that looks nothing like a misconfiguration.

## Images

| Image         | Dockerfile                | Notes                                                            |
| ------------- | ------------------------- | ---------------------------------------------------------------- |
| `hris-api`    | `docker/api.Dockerfile`   | Multi-stage, non-root, `tini`, production dependencies only       |
| `hris-web`    | `docker/web.Dockerfile`   | Multi-stage, Next standalone output, non-root                     |

Both Dockerfiles scope `npm ci` to the workspaces each image needs. Installing the
whole monorepo would pull Expo and React Native into a server image, and would
make `@hris/ui` build inside the API image where its React peer dependency is
deliberately absent.

### Bind address and the `HOSTNAME` trap

Two containers in this project bound to the wrong interface, both while logging a
successful startup:

- **The API** defaulted `API_HOST` to `localhost`. Node resolves `localhost`
  through the system resolver, which prefers `::1` on most modern hosts, so the
  process listened on the IPv6 loopback only. IPv4 clients — including the
  container health check — got `ECONNREFUSED`. The API now rejects `localhost` as a
  bind host outright, and maps `0.0.0.0` to an unspecified host so Node opens a
  dual-stack socket that serves IPv4 and IPv6 alike.
- **The web server** binds to `$HOSTNAME`, which Docker populates with the
  container ID. Next's standalone server therefore listened only on the container's
  own address. The published port worked, so the page appeared healthy while every
  in-container health check failed. `HOSTNAME=0.0.0.0` is now set explicitly.

The general lesson: in a container, verify a health check from *inside* the
container. A published port responding proves the port mapping, not the process.

## Configuration

Every variable is documented in `.env.example`. The ones that must be set
explicitly per environment:

| Variable            | Notes                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`          | `production` in production. Also controls whether Swagger is enabled     |
| `API_HOST`          | A concrete interface. `localhost` is rejected                           |
| `CORS_ORIGINS`      | Explicit list. Never `*` with credentials                               |
| `POSTGRES_*`        | Host differs inside and outside the network                             |
| `JWT_SECRET`        | From the secret manager. Phase 2. `openssl rand -base64 48`             |
| `TRUST_PROXY_HOPS`  | Number of proxies in front of the API. Wrong value corrupts client IPs   |
| `NEXT_PUBLIC_*`     | Build-time, inlined into the client bundle                              |
| `API_BASE_URL`, `API_PLATFORM_URL` | Runtime, used for server-side rendering only         |

### Build-time versus runtime configuration

`NEXT_PUBLIC_*` values are inlined into the browser bundle when the image is
built. They must therefore be reachable **from the user's machine** and cannot be
an internal service name such as `api`.

Server-side rendering uses `API_BASE_URL` and `API_PLATFORM_URL`, which are read at
**runtime**. Inside Docker these are `http://api:3001`, resolved over the private
network. This is what allows one image to be promoted from staging to production
with no rebuild.

Mixing the two up is a real failure: a server-side fetch to `http://localhost:3001`
inside the web container points at the web container itself, and a health page
reports a healthy API as unavailable while both containers are individually
healthy.

## Release

1. Merge to `main` behind a passing CI run: verification, end-to-end tests, image
   builds and a booted stack with a successful web-to-API probe.
2. Build images once, tagged with the commit SHA.
3. Promote the same digest to staging. Run end-to-end tests and a smoke check.
4. Promote the identical digest to production.
5. Run migrations as a separate, explicit step before the new application version
   starts.

Images are promoted by digest, never rebuilt per environment. Rebuilding per
environment means shipping code that was never tested in the form it runs.

### Migrations on deploy

- Backward-compatible for one release: the previous application version must
  tolerate the new schema.
- Deploy order: expand (add nullable columns and tables) → deploy code → migrate
  data → contract (add constraints, drop old columns).
- A failure halts the deployment. It never continues with the new code against a
  half-migrated schema.
- Long-running migrations run outside the deployment lock so a rolling deploy is
  not blocked, and are themselves idempotent.

## Health checks

| Endpoint       | Meaning                                                        | Used by |
| -------------- | -------------------------------------------------------------- | ------- |
| `/health/live` | The process is running                                         | Liveness probe; restart on failure |
| `/health/ready`| The process can serve traffic                                  | Readiness probe; take out of rotation on failure |

Phase 0 readiness reflects process health only. It does not yet check PostgreSQL
or the queue, so a container stays in rotation while its database connection is
broken. Phase 1 replaces it with a probe that reports those dependencies, and
`docker/api.Dockerfile` points its `HEALTHCHECK` at whichever endpoint is the
correct readiness signal.

Liveness must not check dependencies. A database outage should remove the instance
from rotation, not trigger a restart loop that makes the outage worse.

## Reverse proxy and TLS

The proxy terminates TLS and forwards to the API and the web container.

- HSTS with `max-age` of at least one year and `includeSubDomains`.
- HTTP redirected to HTTPS.
- `X-Forwarded-For` and `X-Forwarded-Proto` set by the proxy, with the API's
  `TRUST_PROXY_HOPS` set to the exact number of proxies in front of it.

`TRUST_PROXY_HOPS` is a security setting, not a convenience. Trusting more proxies
than actually exist lets a client forge `X-Forwarded-For` and defeat IP-based
rate limiting and audit attribution. Trusting too few logs the proxy's address
instead of the user's.

## Rollback

1. Redeploy the previous image digest. This is the primary mechanism and takes
   minutes.
2. Roll the schema back only if the migration is reversible. A destructive
   migration is not, which is why destructive changes are deferred to a later
   release.
3. If data was written by the newer version, assess before redeploying: the older
   code must be able to read rows the newer code wrote.

Because the expand/contract sequence keeps the schema backward compatible for a
release, application rollback does not normally require a schema rollback.

## Backup and restore

Defined in [DATABASE.md](DATABASE.md): 15-minute RPO, 1-hour RTO, quarterly restore
drills. A deploy is not complete until post-deploy verification confirms the health
endpoints, a login, and one representative business transaction.

## Operational checklist before production

- [ ] `NODE_ENV=production`, and `/api/docs` returns 404
- [ ] `CORS_ORIGINS` lists only real origins
- [ ] Every secret comes from the secret manager; no defaults in use
- [ ] `TRUST_PROXY_HOPS` matches the real proxy depth
- [ ] HSTS enabled, HTTP redirected to HTTPS
- [ ] Backups running, and a restore has been rehearsed
- [ ] Readiness checks database and queue connectivity
- [ ] Log shipping excludes request and response bodies
- [ ] Container images pinned to digests
