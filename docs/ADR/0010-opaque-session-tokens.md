# ADR 0010: Opaque session tokens in Redis, with a durable session record

- **Status**: Accepted
- **Date**: 2026-10-03
- **Revises**: [ADR 0006](0006-session-tokens.md)

## Context

ADR 0006 chose JWT access and refresh tokens in `httpOnly` cookies, and recorded the
reason carefully: `httpOnly` makes a token unreachable from JavaScript, and a
server-side record is needed so access can be revoked before a token expires.

It also flagged its own weak point, under "Revisit when":

> Phase 2 implements session storage. If Redis is available, option 3 (opaque session
> identifiers) is strictly stronger and should be preferred.

Two things have since changed, and together they make the revisit condition true.

Phase 1 added Redis, for the job queue, with a bounded, persistent and
`noeviction`-configured instance. Phase 1 also created the `sessions` table, with
`token_hash`, `expires_at`, `revoked_at` and `last_seen_at`. The infrastructure the
stronger design depends on now exists.

The remaining objection to opaque identifiers was cost: every authenticated request
becomes a lookup. That objection is weaker than it looks, for two reasons specific to
this platform. The lookup is a single indexed `SELECT`, not a join, and the platform's
authorisation model already requires a database read on every request — ADR 0006 states
that permissions and data scope "are resolved from the database on every request, so a
stale or forged role claim cannot grant access". The session lookup is therefore not
new traffic to the database; it rides along with traffic that already exists.

## Decision

**An opaque, high-entropy token is stored in an `httpOnly`, `Secure`,
`SameSite=Strict` cookie. The token itself is not a database key.**

1. On login the API generates 32 random bytes, base64url-encodes them, and stores
   `sha256(token) -> sessionId` in Redis with a TTL equal to the session's absolute
   expiry.
2. The `sessions` row stores the same hash in `token_hash`, alongside `user_id`,
   `company_id`, `expires_at`, `revoked_at`, `last_seen_at`, `user_agent` and
   `ip_address`.
3. Every request resolves the session by hashing the presented token and reading Redis.
   A miss is an unauthenticated request, full stop.
4. Revocation deletes the Redis key. `revoked_at` is set for the audit trail and for the
   case where Redis has been lost and the row has to be the source of truth.

## Rationale

**Nothing about the token is inspectable.** An attacker who reads the cookie, or finds
it in a log, has a bearer secret and nothing else — no role claim to decode, no expiry
to reason about, no issuer to forge. With a JWT the token is also a set of claims, and
claims are the part that gets copied between contexts.

**Revocation is immediate and unconditional.** Access is withdrawn by deleting one key.
There is no window in which a withdrawn employee continues to hold a valid credential,
which is the property that matters most for personnel data.

**Role changes take effect on the next request.** Nothing is cached in the token, so
there is no propagation delay between a role being granted or removed and the next call
reflecting it.

**A database disclosure does not yield usable tokens.** Only the SHA-256 hash is stored.
An attacker with a dump of `sessions` cannot authenticate, and the hash cannot be
replayed as the cookie.

**The two-tier structure degrades honestly.** Redis is the fast path; the row is the
record of what should exist. If Redis is unavailable the honest answer is 503, not
"accept the token and hope" — accepting unverifiable credentials is how an outage turns
into a breach.

## Consequences

**Accepted costs**

- Every authenticated request reads Redis. That read replaces the signature
  verification it replaces, so it is not purely additional, but it is a network hop.
- Sessions are shared state, so the API is no longer fully stateless to scale out.
  Horizontal scaling is unaffected, since the state is in Redis rather than in a process.
- Absolute expiry is baked into the token at creation. Sliding expiry requires writing a
  new key, so it is deliberately not used; absolute expiry is simpler to reason about
  when auditing.

**Requirements this creates**

- **Every session query runs inside `withTenantContext()`.** `sessions` is a tenant
  table with RLS, and a lookup by token hash during login happens *before* a tenant is
  known. Login therefore resolves the session with the owner role or a dedicated
  function, never as an unauthenticated tenant read, and this boundary must be
  documented in the phase 2 implementation.
- The session store is behind an interface, so returning to stateless tokens remains a
  configuration-level change. ADR 0006 asked for this; it is a hard requirement here.
- Redis persistence matters more than before. `appendonly yes` and
  `appendfsync everysec` are already configured; losing Redis logs everyone out, which
  is safe but disruptive.

## Alternatives considered

- **Keep JWTs in cookies (ADR 0006 as written).** Still safe against XSS and still
  revocable, since a session record is consulted anyway. Rejected because the only
  remaining advantage over an opaque token is avoiding one lookup, and that lookup is
  not the bottleneck. It also carries claims that must be kept correct.
- **Store the token directly in `sessions.token_hash`.** One fewer moving part, and no
  Redis dependency for reads. Rejected: a database disclosure would then yield
  working credentials, which is precisely the risk the hash exists to remove.
- **Server-side sessions in PostgreSQL only, without Redis.** Equivalent security, one
  fewer component. Rejected because every request would add a write to the system of
  record for `last_seen_at`, and `sessions` is a high-churn table competing with
  payroll for vacuum and I/O.

## Revisit when

Session volume makes the per-request Redis read measurably expensive, at which point a
short-lived opaque token plus a longer-lived JWT becomes worth measuring. Revisit also
if Redis is dropped from the stack, since the two-tier design depends on it being there.