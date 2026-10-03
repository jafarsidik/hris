# ADR 0005: One response envelope, with explicit opt-out

- **Status**: Accepted
- **Date**: 2026-10-03

## Context

The API returns JSON from many endpoints. Clients need to handle success and failure
uniformly, and — more importantly — the platform must never leak an internal error
message to a user.

That last requirement is the one that shapes this decision. An endpoint that returns
a bare error string, or an unhandled exception that reaches the client verbatim, turns
a stack trace or a database message into a UI.

## Decision

Every business endpoint returns a standard envelope:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": { "code": "...", "message": "...", "correlationId": "..." } }
```

A single global exception filter produces the failure shape, and a single
interceptor produces the success shape. Endpoints that must return something else —
health probes, file downloads, server-sent events — declare `@RawResponse()` and
return their payload directly.

The envelope and the error codes live in `@hris/shared-types`, so clients branch on
a typed union rather than on strings.

## Rationale

**One place decides what a client may see.** The filter is the single choke point
where an internal exception becomes a safe message. Endpoints cannot forget to be
safe, because they never construct an error response themselves.

**Clients stop defensively parsing.** A uniform failure shape means one error path
in each client, keyed on a stable `code`, rather than per-endpoint guessing.

**The opt-out is explicit and narrow.** `@RawResponse()` is opt-in per handler. A new
endpoint is enveloped by default, so "returns something unusual" is a visible,
reviewable decision rather than an accident.

## Consequences

**Accepted costs**

- Every business response carries an extra wrapper. Negligible.
- Clients must know which endpoints are raw. **This is the real cost, and it has
  already caused a bug**: a health probe was fetched through the enveloped client,
  which rejected the bare payload for lacking a `success` field and reported a
  healthy service as `Unavailable`. Both containers were individually healthy while
  the page claimed an outage.
- The fix is that `@RawResponse()` on the API and the non-enveloping client helper
  must be changed together. Both live in one package pair, and both now have tests
  that assert the raw shape is accepted.

**Mitigations**

- Raw endpoints are listed in [API.md](../API.md).
- Clients expose two clearly named helpers, `apiRequest` and `platformApiRequest`,
  so choosing correctly is visible at the call site.
- `platformApiRequest` has a regression test asserting it accepts a payload with no
  `success` field.

## Alternatives considered

- **Raw responses everywhere**: clients would have to infer the shape from the
  endpoint, and error safety would depend on every handler doing it correctly.
- **HTTP status codes only, no envelope**: still needed error codes and a correlation
  id. The envelope carries them without inventing a parallel error channel.
- **JSON:API or a HAL-style standard**: well-specified, but considerably more
  machinery than the platform needs, and a poor fit for action endpoints such as
  "approve" or "run payroll".
