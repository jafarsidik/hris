# ADR 0006: Session tokens in httpOnly cookies

- **Status**: Accepted
- **Applies from**: Phase 2. No authentication is implemented yet; this records the
  decision so implementation does not drift.
- **Date**: 2026-10-03

## Context

The platform needs browser sessions for employees and administrators, and mobile
sessions for field staff. The API is stateless and deployed behind a reverse proxy.

The candidates are:

1. JWT access and refresh tokens in `localStorage`.
2. JWT access and refresh tokens in `httpOnly` cookies.
3. Opaque session identifiers in cookies, with state on the server.

## Decision

**JWT access and refresh tokens in `httpOnly`, `Secure`, `SameSite=Strict` cookies**,
with refresh-token rotation and reuse detection, and a server-side session record
that makes revocation possible.

Access tokens are short-lived (15 minutes by default). Refresh tokens are rotated on
every use; presenting a rotated token invalidates the entire token family, because
that pattern indicates a stolen token being replayed alongside the legitimate one.

## Rationale

**XSS resistance is the deciding factor.** A token in `localStorage` is readable by
any script running on the page. One successful injection — a dependency, a stored
XSS in a rich-text field, an injected third-party script — becomes full session
theft. `httpOnly` makes the token unreachable from JavaScript entirely.

This platform renders rich text (announcements, policy documents, help articles),
stores employee-submitted attachments, and integrates with several external
providers. That is a meaningful XSS surface for an application holding payroll data.

**Revocation must be possible.** A stateless bearer token cannot be revoked before
it expires. For payroll and personnel access, an employee whose access is withdrawn
must lose it immediately. A server-side session record alongside the token provides
that, while keeping the access token cheap to validate.

**`SameSite=Strict` removes the CSRF exposure** for the common case, and an explicit
CSRF token covers state-changing requests in browsers that need more.

## Consequences

**Accepted costs**

- CSRF protection becomes necessary. `SameSite=Strict` is defence in depth, not the
  whole answer.
- Cross-origin deployments need precise `CORS_ORIGINS` and `credentials`
  configuration, since cookies are not sent on a wildcard origin. Already
  implemented for CORS in phase 0.
- Cookie-based auth is vulnerable to CSRF, not to XSS; the two require different
  defences and both must be present.
- Mobile clients do not use cookies. They hold tokens in the platform secure
  keystore (`expo-secure-store`) and use short-lived access tokens with refresh.

**Requirements this creates**

- Access tokens must not carry data that must not be readable by the client. The
  token carries an identifier and a role claim only; permissions and data scope are
  resolved from the database on every request, so a stale or forged role claim
  cannot grant access.
- Token size matters, because cookies are sent on every request. Claims are kept
  minimal for this reason.
- Logout must invalidate the server-side record, not merely clear the cookie.

## Alternatives considered

- **`localStorage`**: simplest, and the most common choice. Rejected because a single
  successful XSS yields a session token that survives page reloads and cannot be
  scoped or revoked client-side.
- **Opaque session ids with server-side state only**: the strongest option —
  immediate revocation, no token contents to leak, and role changes take effect
  instantly. Rejected for now only because it makes every authenticated request a
  database lookup. **This is the preferred design if the platform moves to
  server-side session storage in Redis, which phase 2 should evaluate.**
- **JWT with a long lifetime and no refresh**: simple, and unacceptable here.
  Withdrawal of access must not wait for a long-lived token to expire.

## Revisit when

Phase 2 implements session storage. If Redis is available, option 3 (opaque session
identifiers) is strictly stronger and should be preferred; the interface to the
session store should be abstracted so this remains a configuration-level change.
