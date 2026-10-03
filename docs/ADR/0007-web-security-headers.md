# ADR 0007: Nonce-based CSP and dynamic rendering

- **Status**: Accepted
- **Date**: 2026-10-03

## Context

The web application needs a Content-Security-Policy. A CSP is one of the highest-value
controls available: it is the control that turns a successful script injection from
session theft and payroll manipulation into a blocked script.

The obstacle is that Next.js emits inline bootstrap and hydration scripts. A CSP
without `'unsafe-inline'` in `script-src` blocks them, and a CSP *with*
`'unsafe-inline'` allows any injected inline script — which is most of what a CSP
exists to stop. The two cancel out, so the header looks like protection while
providing very little.

A second, smaller defect: `connect-src` was built by appending the API base URL,
which included the path `/api/v1`. CSP source expressions match scheme, host and
port; a path is not part of the match, so the entry was meaningless and could not
have restricted anything.

## Decision

1. **Mint a nonce per request in middleware** and set the policy on both the request
   (so Next attaches the nonce to the scripts it renders) and the response.
   `script-src` is `'self' 'nonce-…' 'strict-dynamic'` with no `'unsafe-inline'`.
2. **Render every page dynamically** via `export const dynamic = 'force-dynamic'`
   in the root layout.
3. **Derive `connect-src` with `new URL(value).origin`**, falling back to a fixed
   origin on a malformed value rather than widening to `*`.

## Rationale

**The nonce is the only way to have both.** Next's official pattern for strict CSP is
exactly this: a per-request nonce, set on the request headers, with `strict-dynamic`
allowing the nonced bootstrap to load the rest.

**Static prerendering and nonces are mutually exclusive.** This was found
empirically: `/` was statically prerendered, the middleware set a nonce that never
reached the prebuilt HTML, and all nine inline scripts shipped without a nonce —
every one of them blocked. The build output moved from `○ (Static)` to
`ƒ (Dynamic)` and all inline scripts then carried the nonce.

**Dynamic rendering is independently correct here.** An HRIS page is scoped to a
session, a tenant and a permission set. Serving one user's prerendered HTML to
another from a shared cache is a data leak regardless of CSP. No page in this
application is genuinely public and cacheable.

**A malformed value must fail closed.** If the configured API URL cannot be parsed,
the policy falls back to a known-good origin. Widening to `*` on a parse error would
turn a configuration typo into an open policy.

## Consequences

**Accepted costs**

- No static optimisation. Every request renders. For an authenticated internal
  application this is the right trade, and it removes a class of cache-poisoning and
  cross-user leakage risk.
- Middleware runs on every request. It is a header rewrite and a UUID, so the cost is
  negligible.
- Assets under `/_next/static` are excluded by the middleware matcher, so they keep
  their long cache lifetimes.
- CSP nonce policy cannot be verified by a unit test that renders a component in
  isolation. It is verified by inspecting a real response: the header carries a
  nonce, the nonce differs between requests, and no inline script lacks it.

## Notes for maintainers

Do not reintroduce `'unsafe-inline'` into `script-src` to fix a blocked script. The
correct fix is to identify which directive is failing and add the specific source. A
CSP that has been weakened once tends to be weakened again.

The same class of bug appeared twice in this project, in different forms: both the
API and the web server bound to an unintended interface while logging a successful
startup, and a health page reported an outage while both containers were healthy. The
general rule is to verify behaviour from *inside* the container and from a real HTTP
response, not from a startup log.
